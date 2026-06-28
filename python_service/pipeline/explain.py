import pandas as pd
import numpy as np
import json
import os
import warnings
warnings.filterwarnings('ignore')


def compute_shap_explanations(model, X_processed, feature_names, reports_dir='reports'):
    try:
        import shap
    except ImportError:
        fallback_importance(model, X_processed, feature_names, reports_dir)
        return

    try:
        if hasattr(model, 'feature_importances_'):
            explainer = shap.TreeExplainer(model)
        else:
            explainer = shap.LinearExplainer(model, X_processed)
    except Exception:
        fallback_importance(model, X_processed, feature_names, reports_dir)
        return

    try:
        shap_values = explainer.shap_values(X_processed)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]

        mean_shap = np.abs(shap_values).mean(axis=0)
        importance = [
            {'feature': name, 'importance': float(score)}
            for name, score in zip(feature_names, mean_shap)
        ]
        importance.sort(key=lambda x: x['importance'], reverse=True)
        importance = importance[:20]

        with open(os.path.join(reports_dir, 'feature_importance.json'), 'w') as f:
            json.dump(importance, f, indent=2)

        return importance, shap_values, explainer
    except Exception:
        fallback_importance(model, X_processed, feature_names, reports_dir)
        return


def fallback_importance(model, X_processed, feature_names, reports_dir='reports'):
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    elif hasattr(model, 'coef_'):
        importances = np.abs(model.coef_[0])
    else:
        importances = np.ones(len(feature_names))

    importance = [
        {'feature': name, 'importance': float(score)}
        for name, score in zip(feature_names, importances)
    ]
    importance.sort(key=lambda x: x['importance'], reverse=True)
    importance = importance[:20]

    os.makedirs(reports_dir, exist_ok=True)
    with open(os.path.join(reports_dir, 'feature_importance.json'), 'w') as f:
        json.dump(importance, f, indent=2)


def explain_prediction(features_row, model, preprocessor, feature_names, shap_values=None, explainer=None):
    feature_names_clean = feature_names

    try:
        import shap
        if explainer is None:
            if hasattr(model, 'feature_importances_'):
                explainer = shap.TreeExplainer(model)
            else:
                return [{'feature': 'No SHAP available', 'importance': 0, 'direction': 'neutral'}]

        row_processed = preprocessor.transform(features_row)
        if hasattr(row_processed, 'toarray'):
            row_processed = row_processed.toarray()

        shap_row = explainer.shap_values(row_processed)
        if isinstance(shap_row, list):
            shap_row = shap_row[1]

        explanations = []
        for i, (name, val) in enumerate(zip(feature_names_clean, shap_row[0])):
            explanations.append({
                'feature': name,
                'importance': float(abs(val)),
                'direction': 'positive' if val > 0 else 'negative',
                'value': float(val),
            })

        explanations.sort(key=lambda x: x['importance'], reverse=True)
        return explanations[:5]
    except Exception:
        return [{'feature': 'Using model coefficients', 'importance': 0, 'direction': 'neutral'}]


def generate_human_readable_explanation(explanations, team1, team2, proba):
    top_factors = []
    for exp in explanations:
        direction = 'supports' if exp['direction'] == 'positive' else 'opposes'
        top_factors.append({
            'factor': exp['feature'],
            'direction': direction,
            'impact': round(exp['value'], 4),
        })

    predicted_team = team1 if proba > 0.5 else team2
    confidence = max(proba, 1 - proba)

    lines = []
    lines.append(f"{predicted_team} predicted to win ({confidence:.1%} confidence)")
    for f in top_factors[:3]:
        impact_str = f"+{f['impact']}" if f['direction'] == 'supports' else str(f['impact'])
        lines.append(f"  • {f['factor']}: {impact_str}")

    return {
        'predicted_winner': predicted_team,
        'confidence': round(confidence, 4),
        'top_factors': top_factors,
        'readable': '\n'.join(lines),
    }
