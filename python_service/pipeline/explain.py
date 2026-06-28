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


def explain_prediction(features_row, model, preprocessor, feature_names):
    importances = getattr(model, 'feature_importances_', None)
    if importances is None:
        coef = getattr(model, 'coef_', None)
        if coef is not None:
            importances = np.abs(coef[0]) if coef.ndim > 1 else np.abs(coef)
        else:
            return [{'feature': 'Explanation unavailable', 'importance': 0, 'direction': 'neutral', 'value': 0}]

    paired = [(name, float(imp)) for name, imp in zip(feature_names, importances)]
    paired.sort(key=lambda x: x[1], reverse=True)
    return [
        {
            'feature': name,
            'importance': imp,
            'direction': 'neutral',
            'value': imp,
        }
        for name, imp in paired[:5]
    ]


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
