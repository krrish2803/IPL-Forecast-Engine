import pandas as pd
import numpy as np
import json
import os
from collections import defaultdict


def generate_demo_fixture(teams):
    np.random.seed(42)
    fixtures = []
    match_id = 1
    n = len(teams)
    venues = [
        'Wankhede Stadium, Mumbai', 'M Chinnaswamy Stadium, Bangalore',
        'Eden Gardens, Kolkata', 'MA Chidambaram Stadium, Chennai',
        'Arun Jaitley Stadium, Delhi', 'Rajiv Gandhi International Stadium, Hyderabad',
        'Punjab Cricket Association Stadium, Mohali', 'Sawai Mansingh Stadium, Jaipur',
        'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow',
        'Narendra Modi Stadium, Ahmedabad',
    ]

    for i in range(n):
        for j in range(i + 1, n):
            home_team = teams[i]
            away_team = teams[j]
            venue = venues[(i + j) % len(venues)]
            fixtures.append({
                'match_id': match_id,
                'team1': home_team,
                'team2': away_team,
                'venue': venue,
                'stage': 'League',
            })
            match_id += 1
            fixtures.append({
                'match_id': match_id,
                'team1': away_team,
                'team2': home_team,
                'venue': venues[(i + j + 1) % len(venues)],
                'stage': 'League',
            })
            match_id += 1

    np.random.seed()
    return pd.DataFrame(fixtures)


def predict_match_proba(model, preprocessor, features_df):
    processed = preprocessor.transform(features_df)
    if hasattr(processed, 'toarray'):
        processed = processed.toarray()
    proba = model.predict_proba(processed)[0, 1]
    return proba


def simulate_season(fixture_df, model, preprocessor, feature_fn, n_simulations=1000, feature_cols=None):
    teams = sorted(set(fixture_df['team1'].unique()) | set(fixture_df['team2'].unique()))

    base_probs = {}
    neutral_elo = {t: 1500 for t in teams}
    for _, match in fixture_df.iterrows():
        t1, t2 = match['team1'], match['team2']
        venue = match['venue']
        key = (t1, t2, venue)
        features_dict = feature_fn(t1, t2, venue, neutral_elo)
        features_df = pd.DataFrame([features_dict])
        if feature_cols:
            for c in feature_cols:
                if c not in features_df.columns:
                    features_df[c] = 0
            features_df = features_df[feature_cols]
        base_probs[key] = predict_match_proba(model, preprocessor, features_df)

    title_wins = defaultdict(int)
    top4_counts = defaultdict(int)
    all_points_tables = []

    for sim in range(n_simulations):
        points = {team: 0 for team in teams}
        elo = {team: 1500 for team in teams}

        for _, match in fixture_df.iterrows():
            t1, t2 = match['team1'], match['team2']
            venue = match['venue']
            key = (t1, t2, venue)

            base_p = base_probs[key]
            elo_p = 1.0 / (1.0 + 10.0 ** ((elo[t2] - elo[t1]) / 400.0))
            proba = base_p + (elo_p - 0.5) * 0.5
            proba = np.clip(proba, 0.01, 0.99)

            if np.random.random() < proba:
                winner = t1
            else:
                winner = t2

            points[winner] += 2

            expected_t1 = 1.0 / (1.0 + 10.0 ** ((elo[t2] - elo[t1]) / 400.0))
            elo[t1] = elo[t1] + 32 * ((1.0 if winner == t1 else 0.0) - expected_t1)
            elo[t2] = elo[t2] + 32 * ((1.0 if winner == t2 else 0.0) - (1.0 - expected_t1))

        sorted_teams = sorted(points.items(), key=lambda x: x[1], reverse=True)
        all_points_tables.append(sorted_teams)

        title_wins[sorted_teams[0][0]] += 1
        for i in range(min(4, len(sorted_teams))):
            top4_counts[sorted_teams[i][0]] += 1

    title_probs = {team: round(count / n_simulations, 4) for team, count in title_wins.items()}
    top4_probs = {team: round(count / n_simulations, 4) for team, count in top4_counts.items()}

    avg_points = defaultdict(float)
    for table in all_points_tables:
        for team, pts in table:
            avg_points[team] += pts / n_simulations

    sorted_by_title = sorted(title_probs.items(), key=lambda x: x[1], reverse=True)
    sorted_title = [{'team': t, 'probability': p} for t, p in sorted_by_title]

    sorted_by_top4 = sorted(top4_probs.items(), key=lambda x: x[1], reverse=True)
    sorted_top4 = [{'team': t, 'probability': p} for t, p in sorted_by_top4]

    sorted_by_pts = sorted(avg_points.items(), key=lambda x: x[1], reverse=True)
    sorted_points = [{'team': t, 'avg_points': round(p, 1)} for t, p in sorted_by_pts]

    return {
        'n_simulations': n_simulations,
        'title_probabilities': sorted_title,
        'top4_probabilities': sorted_top4,
        'avg_points_table': sorted_points,
    }


def project_team_strengths(matches_df, teams, decay_factor=0.85):
    last_match = matches_df.iloc[-1]
    final_elos = {}
    for team in teams:
        team_matches = matches_df[(matches_df['team1'] == team) | (matches_df['team2'] == team)]
        if len(team_matches) > 0:
            last = team_matches.iloc[-1]
            elo_val = last['elo_team1'] if last['team1'] == team else last['elo_team2']
            final_elos[team] = 1500 + (elo_val - 1500) * decay_factor
        else:
            final_elos[team] = 1500
    return final_elos


def predict_season(matches_df, feature_cols, model, preprocessor, target_year, focus_team, n_simulations=1000):
    teams = sorted(set(matches_df['team1'].unique()) | set(matches_df['team2'].unique()))
    current_teams = [t for t in teams if t not in [
        'Gujarat Lions', 'Kochi Tuskers Kerala', 'Pune Warriors',
        'Pune Warriors India', 'Rising Pune Supergiants', 'Deccan Chargers'
    ]]
    if len(current_teams) < 4:
        current_teams = teams

    venues = [
        'Wankhede Stadium, Mumbai', 'M Chinnaswamy Stadium, Bangalore',
        'Eden Gardens, Kolkata', 'MA Chidambaram Stadium, Chennai',
        'Arun Jaitley Stadium, Delhi', 'Rajiv Gandhi International Stadium, Hyderabad',
        'Punjab Cricket Association Stadium, Mohali', 'Sawai Mansingh Stadium, Jaipur',
        'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow',
        'Narendra Modi Stadium, Ahmedabad',
    ]

    projected_elos = project_team_strengths(matches_df, current_teams)

    last5_form = {}
    for team in current_teams:
        team_matches = matches_df[(matches_df['team1'] == team) | (matches_df['team2'] == team)].tail(5)
        if len(team_matches) > 0:
            wins = (team_matches['match_won_by'] == team).sum()
            last5_form[team] = wins / len(team_matches)
        else:
            last5_form[team] = 0.5

    n = len(current_teams)
    fixtures = []
    match_id = 1
    for i in range(n):
        for j in range(i + 1, n):
            home = current_teams[i]
            away = current_teams[j]
            venue = venues[(i + j) % len(venues)]
            fixtures.append({'match_id': match_id, 'team1': home, 'team2': away, 'venue': venue, 'stage': 'League'})
            match_id += 1
            fixtures.append({'match_id': match_id, 'team1': away, 'team2': home, 'venue': venues[(i + j + 1) % len(venues)], 'stage': 'League'})
            match_id += 1
    fixture_df = pd.DataFrame(fixtures)

    base_probs = {}
    neutral_elo = {t: 1500 for t in current_teams}
    for _, match in fixture_df.iterrows():
        t1, t2 = match['team1'], match['team2']
        venue = match['venue']
        key = (t1, t2, venue)
        f = default_feature_fn(t1, t2, venue, neutral_elo)
        f['team1_last5_win_rate'] = last5_form.get(t1, 0.5)
        f['team2_last5_win_rate'] = last5_form.get(t2, 0.5)
        f['season'] = str(target_year)
        f['elo_team1'] = 1500
        f['elo_team2'] = 1500
        f['elo_diff'] = 0
        fd = pd.DataFrame([f])
        for c in feature_cols:
            if c not in fd.columns:
                fd[c] = 0
        fd = fd[feature_cols]
        base_probs[key] = predict_match_proba(model, preprocessor, fd)

    base_elo_probs = {}
    for t1 in current_teams:
        for t2 in current_teams:
            if t1 != t2:
                base_elo_probs[(t1, t2)] = 1.0 / (1.0 + 10.0 ** ((1500 - 1500) / 400.0))

    title_wins = defaultdict(int)
    top4_counts = defaultdict(int)
    all_points_tables = []
    total_wins = defaultdict(int)
    total_matches_played = defaultdict(int)

    for _ in range(n_simulations):
        points = {t: 0 for t in current_teams}
        elo = dict(projected_elos)
        sim_wins = defaultdict(int)

        for _, match in fixture_df.iterrows():
            t1, t2 = match['team1'], match['team2']
            venue = match['venue']
            key = (t1, t2, venue)

            base_p = base_probs[key]
            elo_p = 1.0 / (1.0 + 10.0 ** ((elo[t2] - elo[t1]) / 400.0))
            neutral_p = 0.5
            proba = base_p + (elo_p - neutral_p) * 0.5
            proba = np.clip(proba, 0.01, 0.99)

            if np.random.random() < proba:
                winner = t1
            else:
                winner = t2

            points[winner] += 2
            sim_wins[winner] += 1
            total_matches_played[t1] += 1
            total_matches_played[t2] += 1

            expected_t1 = 1.0 / (1.0 + 10.0 ** ((elo[t2] - elo[t1]) / 400.0))
            elo[t1] += 32 * ((1.0 if winner == t1 else 0.0) - expected_t1)
            elo[t2] += 32 * ((1.0 if winner == t2 else 0.0) - (1.0 - expected_t1))

        for t, w in sim_wins.items():
            total_wins[t] += w

        sorted_teams = sorted(points.items(), key=lambda x: x[1], reverse=True)
        all_points_tables.append(sorted_teams)
        title_wins[sorted_teams[0][0]] += 1
        for i in range(min(4, len(sorted_teams))):
            top4_counts[sorted_teams[i][0]] += 1

    title_probs = {t: round(c / n_simulations, 4) for t, c in title_wins.items()}
    top4_probs = {t: round(c / n_simulations, 4) for t, c in top4_counts.items()}
    avg_points = defaultdict(float)
    for table in all_points_tables:
        for t, pts in table:
            avg_points[t] += pts / n_simulations

    focus_results = None
    if focus_team in current_teams:
        projected_wins = total_wins.get(focus_team, 0) / n_simulations
        total_games = total_matches_played.get(focus_team, 0) / n_simulations
        focus_results = {
            'team': focus_team,
            'title_probability': title_probs.get(focus_team, 0),
            'top4_probability': top4_probs.get(focus_team, 0),
            'avg_points': round(avg_points.get(focus_team, 0), 1),
            'projected_win_rate': round(projected_wins / total_games, 4) if total_games > 0 else 0,
            'projected_wins': round(projected_wins, 1),
            'total_matches': round(total_games, 0),
        }

    sorted_title = sorted(title_probs.items(), key=lambda x: x[1], reverse=True)
    sorted_title = [{'team': t, 'probability': p} for t, p in sorted_title]
    sorted_top4 = sorted(top4_probs.items(), key=lambda x: x[1], reverse=True)
    sorted_top4 = [{'team': t, 'probability': p} for t, p in sorted_top4]
    sorted_pts = sorted(avg_points.items(), key=lambda x: x[1], reverse=True)
    sorted_pts = [{'team': t, 'avg_points': round(p, 1)} for t, p in sorted_pts]

    return {
        'target_season': target_year,
        'n_simulations': n_simulations,
        'focus_team': focus_results,
        'title_probabilities': sorted_title,
        'top4_probabilities': sorted_top4,
        'avg_points_table': sorted_pts,
    }


def default_feature_fn(team1, team2, venue, elo, matches_history=None):
    features = {
        'inn1_innings': 1,
        'inn2_innings': 2,
        'team1_last3_win_rate': 0.5,
        'team1_last5_win_rate': 0.5,
        'team1_last10_win_rate': 0.5,
        'team2_last3_win_rate': 0.5,
        'team2_last5_win_rate': 0.5,
        'team2_last10_win_rate': 0.5,
        'h2h_team1_win_rate': 0.5,
        'h2h_total_matches': 0,
        'team1_venue_win_rate': 0.5,
        'team2_venue_win_rate': 0.5,
        'avg_first_innings_venue': 160,
        'chasing_win_rate_venue': 0.5,
        'team1_recent_avg_runs': 160,
        'team2_recent_avg_runs': 160,
        'team1_powerplay_avg': 45,
        'team2_powerplay_avg': 45,
        'team1_death_overs_avg': 45,
        'team2_death_overs_avg': 45,
        'team1_boundary_rate': 0.06,
        'team2_boundary_rate': 0.06,
        'team1_recent_avg_wickets': 6,
        'team2_recent_avg_wickets': 6,
        'team1_recent_economy': 8.0,
        'team2_recent_economy': 8.0,
        'team1_powerplay_wickets': 1.5,
        'team2_powerplay_wickets': 1.5,
        'team1_death_overs_economy': 10.0,
        'team2_death_overs_economy': 10.0,
        'toss_winner_is_team1': 0,
        'toss_decision_bat': 1,
        'is_playoff': 0,
        'team1_is_home': 0,
        'team2_is_home': 0,
        'season': '2024',
        'team1_nrr_proxy': 0.0,
        'team2_nrr_proxy': 0.0,
        'weighted_recent_form_team1': 0.5,
        'weighted_recent_form_team2': 0.5,
        'batting_momentum_team1': 0,
        'batting_momentum_team2': 0,
        'elo_team1': elo.get(team1, 1500),
        'elo_team2': elo.get(team2, 1500),
        'elo_diff': elo.get(team1, 1500) - elo.get(team2, 1500),
    }
    return features
