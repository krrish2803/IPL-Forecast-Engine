import os
import sys
import json
import time
import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

sys.path.insert(0, os.path.dirname(__file__))

from pipeline.clean import run_cleaning_pipeline
from pipeline.features import aggregate_innings, build_match_features, run_feature_pipeline
from pipeline.elo import compute_elo_ratings
from pipeline.train import run_training_pipeline, predict_match
from pipeline.explain import compute_shap_explanations, explain_prediction, generate_human_readable_explanation
from pipeline.simulate import simulate_season, generate_demo_fixture, default_feature_fn, predict_season

app = FastAPI(title='IPL Forecast Engine API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROCESSED_DIR = os.path.join(DATA_DIR, 'processed')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

_cleaned_df = None
_innings_df = None
_matches_df = None
_feature_cols = None
_best_model = None
_preprocessor = None
_feature_list = None
_model_metrics = None


class PredictRequest(BaseModel):
    team1: str
    team2: str
    venue: str
    toss_winner: str
    toss_decision: str
    season: str = '2024'
    stage: str = 'League'


class PredictResponse(BaseModel):
    team1_win_probability: float
    team2_win_probability: float
    confidence: float
    predicted_winner: str
    explanation: dict


class TrainResponse(BaseModel):
    status: str
    duration_seconds: float
    best_model: str
    best_model_auc: float
    train_size: int
    val_size: int
    test_size: int


class SimulateRequest(BaseModel):
    fixture_csv: Optional[str] = None
    use_demo: bool = True
    n_simulations: int = 1000


class SimulateResponse(BaseModel):
    n_simulations: int
    title_probabilities: list
    top4_probabilities: list
    avg_points_table: list


class PredictSeasonRequest(BaseModel):
    target_year: int = 2027
    focus_team: str = ''
    n_simulations: int = 1000


def load_artifacts():
    global _best_model, _preprocessor, _feature_list, _model_metrics
    try:
        _best_model = joblib.load(os.path.join(MODELS_DIR, 'best_model.joblib'))
        _preprocessor = joblib.load(os.path.join(MODELS_DIR, 'preprocessing_pipeline.joblib'))
        with open(os.path.join(MODELS_DIR, 'feature_list.json')) as f:
            _feature_list = json.load(f)
        with open(os.path.join(REPORTS_DIR, 'model_metrics.json')) as f:
            _model_metrics = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        pass


def build_prediction_features(t1, t2, venue, toss_winner, toss_decision, season, stage):
    elo = {}
    for team in [t1, t2]:
        elo[team] = 1500
    features = default_feature_fn(t1, t2, venue, elo)
    features['toss_winner_is_team1'] = 1 if toss_winner == t1 else 0
    features['toss_decision_bat'] = 1 if toss_decision == 'bat' else 0
    playoff_stages = ['final', 'semifinal', 'qualifier', 'eliminator', 'qualifier 1', 'qualifier 2']
    features['is_playoff'] = 1 if stage.lower() in playoff_stages else 0

    home_city_map = {
        'Chennai Super Kings': 'Chennai', 'Mumbai Indians': 'Mumbai',
        'Royal Challengers Bangalore': 'Bangalore', 'Kolkata Knight Riders': 'Kolkata',
        'Sunrisers Hyderabad': 'Hyderabad', 'Delhi Capitals': 'Delhi',
        'Punjab Kings': 'Mohali', 'Rajasthan Royals': 'Jaipur',
        'Lucknow Super Giants': 'Lucknow', 'Gujarat Titans': 'Ahmedabad',
        'Gujarat Lions': 'Rajkot', 'Deccan Chargers': 'Hyderabad',
        'Kochi Tuskers Kerala': 'Kochi', 'Pune Warriors': 'Pune',
        'Pune Warriors India': 'Pune', 'Rising Pune Supergiants': 'Pune',
    }
    venue_city_map = {
        'Wankhede Stadium, Mumbai': 'Mumbai',
        'M Chinnaswamy Stadium, Bangalore': 'Bangalore',
        'Eden Gardens, Kolkata': 'Kolkata',
        'MA Chidambaram Stadium, Chennai': 'Chennai',
        'Arun Jaitley Stadium, Delhi': 'Delhi',
        'Rajiv Gandhi International Stadium, Hyderabad': 'Hyderabad',
        'Punjab Cricket Association Stadium, Mohali': 'Mohali',
        'Sawai Mansingh Stadium, Jaipur': 'Jaipur',
        'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow': 'Lucknow',
        'Narendra Modi Stadium, Ahmedabad': 'Ahmedabad',
    }
    city = venue_city_map.get(venue, '')
    features['team1_is_home'] = 1 if city == home_city_map.get(t1, '') else 0
    features['team2_is_home'] = 1 if city == home_city_map.get(t2, '') else 0
    features['season'] = str(season)

    return features


@app.on_event('startup')
def startup():
    load_artifacts()


@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': _best_model is not None}


@app.post('/train', response_model=TrainResponse)
def train():
    global _cleaned_df, _innings_df, _matches_df, _feature_cols
    global _best_model, _preprocessor, _feature_list, _model_metrics

    start = time.time()
    try:
        csv_files = [f for f in os.listdir(RAW_DIR) if f.endswith('.csv')]
        if not csv_files:
            raise HTTPException(
                status_code=400,
                detail=f'No CSV found in {RAW_DIR}. Place your IPL dataset there.'
            )
        data_path = os.path.join(RAW_DIR, csv_files[0])

        df, cleaning_report = run_cleaning_pipeline(data_path)
        _cleaned_df = df

        df.to_csv(os.path.join(PROCESSED_DIR, 'cleaned_dataset.csv'), index=False)
        with open(os.path.join(REPORTS_DIR, 'cleaning_report.json'), 'w') as f:
            json.dump(cleaning_report, f, indent=2)

        innings_df = aggregate_innings(df)
        _innings_df = innings_df

        matches_df = build_match_features(df, innings_df)
        matches_df = compute_elo_ratings(matches_df)
        matches_df, feature_cols = run_feature_pipeline(df, innings_df, matches_df)
        _matches_df = matches_df
        _feature_cols = feature_cols

        matches_df.to_csv(os.path.join(PROCESSED_DIR, 'engineered_match_features.csv'), index=False)

        metrics, model, preprocessor, feature_list = run_training_pipeline(
            matches_df, feature_cols, MODELS_DIR, REPORTS_DIR
        )
        _best_model = model
        _preprocessor = preprocessor
        _feature_list = feature_list
        _model_metrics = metrics

        try:
            from pipeline.explain import compute_shap_explanations
            X = matches_df[feature_cols].copy()
            X_processed = preprocessor.transform(X)
            if hasattr(X_processed, 'toarray'):
                X_processed = X_processed.toarray()
            all_feature_names = feature_list['numeric_features'] + feature_list['categorical_features']
            compute_shap_explanations(model, X_processed, all_feature_names, REPORTS_DIR)
        except Exception:
            pass

        duration = round(time.time() - start, 2)

        return TrainResponse(
            status='success',
            duration_seconds=duration,
            best_model=metrics['best_model'],
            best_model_auc=metrics['best_model_auc'],
            train_size=metrics['train_size'],
            val_size=metrics['val_size'],
            test_size=metrics['test_size'],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/metrics')
def get_metrics():
    if _model_metrics is None:
        try:
            with open(os.path.join(REPORTS_DIR, 'model_metrics.json')) as f:
                return json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail='No metrics found. Run /train first.')
    return _model_metrics


@app.get('/teams')
def get_teams():
    if _cleaned_df is not None:
        teams = sorted(set(_cleaned_df['batting_team'].unique()) | set(_cleaned_df['bowling_team'].unique()))
        return {'teams': teams}
    try:
        df = pd.read_csv(os.path.join(PROCESSED_DIR, 'cleaned_dataset.csv'))
        teams = sorted(set(df['batting_team'].unique()) | set(df['bowling_team'].unique()))
        return {'teams': teams}
    except (FileNotFoundError, KeyError):
        return {'teams': []}


@app.get('/venues')
def get_venues():
    if _cleaned_df is not None:
        venues = sorted(_cleaned_df['venue'].unique().tolist())
        return {'venues': venues}
    try:
        df = pd.read_csv(os.path.join(PROCESSED_DIR, 'cleaned_dataset.csv'))
        venues = sorted(df['venue'].unique().tolist())
        return {'venues': venues}
    except (FileNotFoundError, KeyError):
        return {'venues': []}


@app.post('/predict-match', response_model=PredictResponse)
def predict_match_endpoint(req: PredictRequest):
    if _best_model is None or _preprocessor is None:
        load_artifacts()
    if _best_model is None:
        raise HTTPException(status_code=400, detail='No model trained. Run /train first.')

    features = build_prediction_features(
        req.team1, req.team2, req.venue,
        req.toss_winner, req.toss_decision,
        req.season, req.stage
    )

    features_df = pd.DataFrame([features])
    required_features = _feature_list.get('all_features', list(features.keys()))
    missing = [c for c in required_features if c not in features_df.columns]
    for m in missing:
        features_df[m] = 0
    features_df = features_df[required_features]

    proba = predict_match(features_df, _best_model, _preprocessor, _feature_list)
    team1_proba = proba
    team2_proba = 1 - proba

    processed = _preprocessor.transform(features_df)
    if hasattr(processed, 'toarray'):
        processed = processed.toarray()

    all_feature_names = _feature_list.get('numeric_features', []) + _feature_list.get('categorical_features', [])
    explanations = explain_prediction(features_df, _best_model, _preprocessor, all_feature_names)

    readable = generate_human_readable_explanation(explanations, req.team1, req.team2, proba)

    return PredictResponse(
        team1_win_probability=round(team1_proba, 4),
        team2_win_probability=round(team2_proba, 4),
        confidence=round(max(proba, 1 - proba), 4),
        predicted_winner=readable['predicted_winner'],
        explanation=readable,
    )


@app.post('/simulate-season', response_model=SimulateResponse)
def simulate_season_endpoint(req: SimulateRequest):
    if _best_model is None or _preprocessor is None:
        load_artifacts()
    if _best_model is None:
        raise HTTPException(status_code=400, detail='No model trained. Run /train first.')

    if req.use_demo or not req.fixture_csv:
        teams_list = get_teams().get('teams', [])
        if not teams_list:
            raise HTTPException(status_code=400, detail='No teams available for demo fixture.')
        fixtures = generate_demo_fixture(teams_list)
    else:
        import io
        try:
            fixtures = pd.read_csv(io.StringIO(req.fixture_csv))
            for col in ['team1', 'team2', 'venue']:
                if col not in fixtures.columns:
                    raise HTTPException(status_code=400, detail=f'Fixture CSV missing column: {col}')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Invalid fixture CSV: {str(e)}')

    def feature_fn(t1, t2, venue, elo):
        return build_prediction_features(t1, t2, venue, t1, 'bat', '2024', 'League')

    feature_cols = _feature_list.get('all_features', []) if _feature_list else []
    result = simulate_season(
        fixtures, _best_model, _preprocessor,
        feature_fn, req.n_simulations, feature_cols=feature_cols
    )

    result_path = os.path.join(REPORTS_DIR, 'title_probabilities.csv')
    pd.DataFrame(result['title_probabilities']).to_csv(result_path, index=False)

    return SimulateResponse(**result)


@app.post('/predict-season')
def predict_season_endpoint(req: PredictSeasonRequest):
    global _matches_df, _best_model, _preprocessor, _feature_list

    if _best_model is None or _preprocessor is None:
        load_artifacts()
    if _best_model is None:
        raise HTTPException(status_code=400, detail='No model trained. Run /train first.')
    if _matches_df is None:
        try:
            _matches_df = pd.read_csv(os.path.join(PROCESSED_DIR, 'engineered_match_features.csv'))
        except FileNotFoundError:
            raise HTTPException(status_code=400, detail='No match features found. Run /train first.')

    feature_cols = _feature_list.get('all_features', [])

    result = predict_season(
        matches_df=_matches_df,
        feature_cols=feature_cols,
        model=_best_model,
        preprocessor=_preprocessor,
        target_year=req.target_year,
        focus_team=req.focus_team,
        n_simulations=req.n_simulations,
    )

    return result


@app.get('/data-quality')
def data_quality():
    try:
        with open(os.path.join(REPORTS_DIR, 'cleaning_report.json')) as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail='No cleaning report found. Run /train first.')


@app.get('/feature-importance')
def feature_importance():
    try:
        with open(os.path.join(REPORTS_DIR, 'feature_importance.json')) as f:
            return {'features': json.load(f)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail='No feature importance found. Run /train first.')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
