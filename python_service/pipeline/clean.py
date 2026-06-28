import pandas as pd
import numpy as np
import os
import json
from datetime import datetime

REQUIRED_COLUMNS = [
    'match_id', 'date', 'innings', 'batting_team', 'bowling_team',
    'over', 'ball', 'batter', 'bowler', 'runs_total', 'valid_ball',
    'wicket_kind', 'player_out', 'match_won_by', 'venue', 'city',
    'day', 'month', 'year', 'season', 'toss_winner', 'toss_decision',
    'gender', 'team_type', 'result_type', 'method', 'stage',
    'player_of_match', 'review_batter', 'team_reviewed',
    'review_decision', 'umpire', 'umpires_call', 'superover_winner',
    'runs_batter', 'runs_bowler', 'runs_extras', 'extra_type',
    'runs_not_boundary', 'non_striker', 'bat_pos', 'balls_faced',
    'fielders', 'runs_target', 'power_surge_start', 'new_batter',
    'batting_partners', 'next_batter', 'striker_out',
    'team_runs', 'team_balls', 'team_wicket',
    'batter_runs', 'batter_balls', 'bowler_wicket'
]

TEAM_RENAMES = {
    'Delhi Daredevils': 'Delhi Capitals',
    'Kings XI Punjab': 'Punjab Kings',
    'Rising Pune Supergiant': 'Rising Pune Supergiants',
    'Rising Pune Supergiants': 'Rising Pune Supergiants',
    'Deccan Chargers': 'Sunrisers Hyderabad',
    'Pune Warriors': 'Pune Warriors India',
    'Kochi Tuskers Kerala': 'Kochi Tuskers Kerala',
    'Gujarat Lions': 'Gujarat Lions',
}

LEAKAGE_COLUMNS = {
    'player_of_match': 'Awarded after match ends',
    'review_batter': 'Review data not available pre-match',
    'team_reviewed': 'Review data not available pre-match',
    'review_decision': 'Review data not available pre-match',
    'umpire': 'Umpire assignment not known pre-match',
    'umpires_call': 'Umpire decision data not available pre-match',
}

DROP_CONDITIONS = {
    'no result': 'Match abandoned, no outcome to predict',
    'DL': 'Duckworth-Lewis adjusted target, non-standard conditions',
}


def auto_detect_file(data_dir='data/raw'):
    for f in os.listdir(data_dir):
        if f.endswith('.csv'):
            return os.path.join(data_dir, f)
    raise FileNotFoundError(f'No CSV found in {data_dir}')


def validate_columns(df):
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    found = [c for c in REQUIRED_COLUMNS if c in df.columns]
    return found, missing


def normalize_team_names(df):
    renames_applied = {}
    for old, new in TEAM_RENAMES.items():
        if old in df['batting_team'].values:
            renames_applied[old] = new
    df['batting_team'] = df['batting_team'].replace(TEAM_RENAMES)
    df['bowling_team'] = df['bowling_team'].replace(TEAM_RENAMES)
    df['toss_winner'] = df['toss_winner'].replace(TEAM_RENAMES)
    df['match_won_by'] = df['match_won_by'].replace(TEAM_RENAMES)
    return df, renames_applied


def parse_date(df):
    df['date_parsed'] = pd.to_datetime(df[['year', 'month', 'day']].astype(str).agg('-'.join, axis=1), errors='coerce')
    df = df.dropna(subset=['date_parsed'])
    return df


def fill_missing_venue_city(df):
    venue_city_map = df.groupby('venue')['city'].agg(lambda x: x.mode().iloc[0] if not x.mode().empty else 'Unknown').to_dict()
    df['city'] = df['city'].fillna(df['venue'].map(venue_city_map))
    df['city'] = df['city'].fillna('Unknown')
    return df


def remove_duplicate_matches(df):
    before = len(df)
    df = df.drop_duplicates(subset=['match_id', 'innings', 'over', 'ball'], keep='first')
    after = len(df)
    return df, before - after


def drop_leakage_columns(df):
    cols_to_drop = list(LEAKAGE_COLUMNS.keys())
    existing = [c for c in cols_to_drop if c in df.columns]
    df = df.drop(columns=existing, errors='ignore')
    return df, {c: LEAKAGE_COLUMNS[c] for c in existing}


def filter_rows(df):
    dropped_reasons = {}
    before = len(df)

    if 'gender' in df.columns:
        mask_gender = df['gender'].str.lower() == 'male'
        df = df[mask_gender]
        dropped_reasons['gender_filter'] = int(before - len(df))
        before = len(df)

    if 'result_type' in df.columns:
        mask_result = df['result_type'].str.lower() != 'no result'
        df = df[mask_result]
        dropped_reasons['no_result'] = int(before - len(df))
        before = len(df)

    if 'method' in df.columns:
        mask_method = df['method'] != 'D/L'
        df = df[mask_method]
        dropped_reasons['dl_method'] = int(before - len(df))
        before = len(df)

    superover_ids = set()
    if 'superover_winner' in df.columns:
        superover_mask = df['superover_winner'].notna() & (df['superover_winner'] != 'NA') & (df['superover_winner'] != '')
        superover_ids = set(df.loc[superover_mask, 'match_id'].unique())
        df = df[~df['match_id'].isin(superover_ids)]
        dropped_reasons['superover_matches'] = int(len(superover_ids))

    return df, dropped_reasons, list(superover_ids)


def generate_cleaning_report(df_before, df_after, renames, leakage_dropped, filter_reasons, dupes_dropped, missing_summary):
    return {
        'rows_before': len(df_before),
        'rows_after': len(df_after),
        'rows_dropped': len(df_before) - len(df_after),
        'duplicate_rows_removed': dupes_dropped,
        'team_renames_applied': renames,
        'leakage_columns_dropped': leakage_dropped,
        'filter_reasons': filter_reasons,
        'missing_value_summary': missing_summary,
        'unique_matches': df_after['match_id'].nunique(),
        'unique_teams': sorted(set(df_after['batting_team'].unique()) | set(df_after['bowling_team'].unique())),
        'seasons': sorted(df_after['season'].unique().tolist()),
        'venues': sorted(df_after['venue'].unique().tolist()),
    }


def run_cleaning_pipeline(data_path=None):
    if data_path is None:
        data_path = auto_detect_file()

    df = pd.read_csv(data_path, low_memory=False)
    df_before = df.copy()

    found, missing = validate_columns(df)
    if missing:
        raise ValueError(f'Missing required columns: {missing}')

    df, renames = normalize_team_names(df)
    df = parse_date(df)
    df = fill_missing_venue_city(df)
    df, dupes_dropped = remove_duplicate_matches(df)
    df, leakage_dropped = drop_leakage_columns(df)
    df, filter_reasons, superover_ids = filter_rows(df)

    missing_summary = {
        col: int(df[col].isna().sum())
        for col in df.columns
        if df[col].isna().sum() > 0
    }

    report = generate_cleaning_report(
        df_before, df, renames, leakage_dropped,
        filter_reasons, dupes_dropped, missing_summary
    )

    df = df.sort_values(['date_parsed', 'match_id', 'innings', 'over', 'ball']).reset_index(drop=True)

    return df, report
