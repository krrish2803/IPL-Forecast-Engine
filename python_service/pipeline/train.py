import pandas as pd
import numpy as np
import json
import os
import time


class SafeFloatEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, float):
            if not np.isfinite(obj):
                return 0.0
            return round(obj, 6)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return 0.0 if not np.isfinite(obj) else round(float(obj), 6)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def clean_for_json(obj):
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    if isinstance(obj, float):
        if not np.isfinite(obj):
            return 0.0
        return round(obj, 6)
    if isinstance(obj, np.floating):
        return 0.0 if not np.isfinite(obj) else round(float(obj), 6)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


import joblib
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, log_loss, confusion_matrix, roc_curve
)
from sklearn.calibration import calibration_curve
import warnings
warnings.filterwarnings('ignore')


def prepare_calibration_data(y_true, y_pred_proba, n_bins=10):
    prob_true, prob_pred = calibration_curve(
        y_true, y_pred_proba, n_bins=n_bins, strategy='uniform'
    )
    prob_true = [0.0 if not np.isfinite(v) else round(float(v), 6) for v in prob_true]
    prob_pred = [0.0 if not np.isfinite(v) else round(float(v), 6) for v in prob_pred]
    return {
        'calibration_x': prob_pred,
        'calibration_y': prob_true,
    }


def to_json_safe(val):
    if isinstance(val, float):
        if not np.isfinite(val):
            return 0.0
        return round(val, 6)
    return val

def train_and_evaluate(model, model_name, X_train, y_train, X_val, y_val):
    model.fit(X_train, y_train)

    y_pred = model.predict(X_val)
    y_pred_proba = np.clip(model.predict_proba(X_val)[:, 1], 1e-15, 1 - 1e-15)

    metrics = {
        'model': model_name,
        'accuracy': to_json_safe(accuracy_score(y_val, y_pred)),
        'precision': to_json_safe(precision_score(y_val, y_pred, zero_division=0)),
        'recall': to_json_safe(recall_score(y_val, y_pred, zero_division=0)),
        'f1': to_json_safe(f1_score(y_val, y_pred, zero_division=0)),
        'roc_auc': to_json_safe(roc_auc_score(y_val, y_pred_proba)),
        'log_loss': to_json_safe(log_loss(y_val, y_pred_proba)),
        'calibration': prepare_calibration_data(y_val.values, y_pred_proba),
    }

    cm = confusion_matrix(y_val, y_pred)
    metrics['confusion_matrix'] = {
        'true_neg': int(cm[0, 0]),
        'false_pos': int(cm[0, 1]),
        'false_neg': int(cm[1, 0]),
        'true_pos': int(cm[1, 1]),
    }

    fpr, tpr, thresholds = roc_curve(y_val, y_pred_proba)
    metrics['roc_curve'] = {
        'fpr': fpr.tolist()[:100],
        'tpr': tpr.tolist()[:100],
        'thresholds': thresholds.tolist()[:100],
    }

    return model, metrics


def run_training_pipeline(matches_df, feature_cols, models_dir='models', reports_dir='reports'):
    matches_df = matches_df.dropna(subset=['team1_won']).copy()
    matches_df = matches_df.sort_values('date_parsed').reset_index(drop=True)

    seasons = sorted(matches_df['season'].unique())
    train_seasons = seasons[:-2]
    val_seasons = [seasons[-2]]
    test_seasons = [seasons[-1]]

    train_mask = matches_df['season'].isin(train_seasons)
    val_mask = matches_df['season'].isin(val_seasons)
    test_mask = matches_df['season'].isin(test_seasons)

    train_df = matches_df[train_mask].copy()
    val_df = matches_df[val_mask].copy()
    test_df = matches_df[test_mask].copy()

    X_train = train_df[feature_cols].copy()
    y_train = train_df['team1_won'].copy()
    X_val = val_df[feature_cols].copy()
    y_val = val_df['team1_won'].copy()
    X_test = test_df[feature_cols].copy()
    y_test = test_df['team1_won'].copy()

    categorical_cols = ['toss_decision_bat', 'is_playoff']
    existing_cat = [c for c in categorical_cols if c in X_train.columns]

    numeric_cols = [c for c in feature_cols if c not in existing_cat]

    transformers = []
    if numeric_cols:
        transformers.append(('num', Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler()),
        ]), numeric_cols))
    if existing_cat:
        transformers.append(('cat', Pipeline([
            ('imputer', SimpleImputer(strategy='constant', fill_value=0)),
            ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
        ]), existing_cat))

    preprocessor = ColumnTransformer(transformers, remainder='drop')

    X_train_processed = preprocessor.fit_transform(X_train)
    X_val_processed = preprocessor.transform(X_val)
    X_test_processed = preprocessor.transform(X_test)

    if hasattr(X_train_processed, 'toarray'):
        X_train_processed = X_train_processed.toarray()
        X_val_processed = X_val_processed.toarray()
        X_test_processed = X_test_processed.toarray()

    models = {
        'LogisticRegression': LogisticRegression(max_iter=1000, random_state=42, C=1.0),
        'RandomForest': RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=5,
            random_state=42, n_jobs=-1
        ),
    }

    try:
        import xgboost as xgb
        models['XGBoost'] = xgb.XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, eval_metric='logloss', verbosity=0
        )
    except ImportError:
        pass

    try:
        from catboost import CatBoostClassifier
        models['CatBoost'] = CatBoostClassifier(
            iterations=300, depth=6, learning_rate=0.05,
            random_seed=42, verbose=0
        )
    except ImportError:
        pass

    all_metrics = {}
    best_auc = -1
    best_model_name = None
    best_model = None
    trained_models = {}

    for name, model in models.items():
        trained, metrics = train_and_evaluate(
            model, name, X_train_processed, y_train, X_val_processed, y_val
        )
        all_metrics[name] = metrics
        trained_models[name] = trained

        if metrics['roc_auc'] > best_auc:
            best_auc = metrics['roc_auc']
            best_model_name = name
            best_model = trained

    test_metrics = {}
    if best_model is not None:
        y_test_pred = best_model.predict(X_test_processed)
        y_test_proba = np.clip(best_model.predict_proba(X_test_processed)[:, 1], 1e-15, 1 - 1e-15)
        test_metrics = {
            'accuracy': to_json_safe(accuracy_score(y_test, y_test_pred)),
            'precision': to_json_safe(precision_score(y_test, y_test_pred, zero_division=0)),
            'recall': to_json_safe(recall_score(y_test, y_test_pred, zero_division=0)),
            'f1': to_json_safe(f1_score(y_test, y_test_pred, zero_division=0)),
            'roc_auc': to_json_safe(roc_auc_score(y_test, y_test_proba)),
            'log_loss': to_json_safe(log_loss(y_test, y_test_proba)),
        }

    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)

    joblib.dump(best_model, os.path.join(models_dir, 'best_model.joblib'))
    joblib.dump(preprocessor, os.path.join(models_dir, 'preprocessing_pipeline.joblib'))

    feature_list = {
        'numeric_features': numeric_cols,
        'categorical_features': existing_cat,
        'all_features': feature_cols,
    }
    with open(os.path.join(models_dir, 'feature_list.json'), 'w') as f:
        json.dump(feature_list, f, indent=2)

    full_metrics = {
        'best_model': best_model_name,
        'best_model_auc': best_auc,
        'train_seasons': list(train_seasons),
        'val_seasons': val_seasons,
        'test_seasons': test_seasons,
        'train_size': len(X_train),
        'val_size': len(X_val),
        'test_size': len(X_test),
        'models': all_metrics,
        'test_metrics': test_metrics,
    }

    with open(os.path.join(reports_dir, 'model_metrics.json'), 'w') as f:
        json.dump(full_metrics, f, indent=2, cls=SafeFloatEncoder)

    return clean_for_json(full_metrics), best_model, preprocessor, feature_list


def predict_match(features_df, model, preprocessor, feature_list):
    processed = preprocessor.transform(features_df)
    if hasattr(processed, 'toarray'):
        processed = processed.toarray()
    proba = model.predict_proba(processed)[0, 1]
    return float(proba)
