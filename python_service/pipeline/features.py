import pandas as pd
import numpy as np
from collections import defaultdict


def aggregate_innings(df):
    innings_data = []
    for (match_id, innings_val), group in df.groupby(['match_id', 'innings']):
        team = group['batting_team'].iloc[0]
        bowling_team = group['bowling_team'].iloc[0]

        total_runs = group['runs_total'].sum()
        valid_balls = (group['valid_ball'] == 1).sum()
        wickets = (group['wicket_kind'].notna() & (group['wicket_kind'] != '')).sum()
        run_rate = total_runs / (valid_balls / 6) if valid_balls > 0 else 0

        powerplay = group[group['over'] < 6]
        middle = group[(group['over'] >= 6) & (group['over'] < 16)]
        death = group[group['over'] >= 16]

        pp_runs = powerplay['runs_total'].sum()
        pp_wickets = (powerplay['wicket_kind'].notna() & (powerplay['wicket_kind'] != '')).sum()
        pp_balls = (powerplay['valid_ball'] == 1).sum()

        middle_runs = middle['runs_total'].sum()
        middle_wickets = (middle['wicket_kind'].notna() & (middle['wicket_kind'] != '')).sum()
        middle_balls = (middle['valid_ball'] == 1).sum()

        death_runs = death['runs_total'].sum()
        death_wickets = (death['wicket_kind'].notna() & (death['wicket_kind'] != '')).sum()
        death_balls = (death['valid_ball'] == 1).sum()
        death_economy = death_runs / (death_balls / 6) if death_balls > 0 else 0

        boundaries = ((group['runs_not_boundary'] == 0) & (group['runs_batter'] >= 4)).sum()
        dot_balls = ((group['runs_total'] == 0) & (group['valid_ball'] == 1)).sum()
        extras = group['runs_extras'].sum()

        innings_data.append({
            'match_id': match_id,
            'inning': innings_val,
            'team': team,
            'bowling_team': bowling_team,
            'total_runs': total_runs,
            'valid_balls': valid_balls,
            'wickets': wickets,
            'run_rate': round(run_rate, 2),
            'powerplay_runs': pp_runs,
            'powerplay_wickets': pp_wickets,
            'powerplay_balls': pp_balls,
            'middle_runs': middle_runs,
            'middle_wickets': middle_wickets,
            'middle_balls': middle_balls,
            'death_runs': death_runs,
            'death_wickets': death_wickets,
            'death_balls': death_balls,
            'death_economy': round(death_economy, 2),
            'boundaries': boundaries,
            'dot_balls': dot_balls,
            'extras': extras,
        })

    return pd.DataFrame(innings_data)


def build_match_features(df, innings_df):
    matches = df[['match_id', 'date_parsed', 'season', 'venue', 'city',
                  'toss_winner', 'toss_decision', 'stage',
                  'match_won_by', 'runs_target', 'team_runs',
                  'team_balls', 'team_wicket']].drop_duplicates(subset='match_id').copy()

    inn1 = innings_df[innings_df['inning'] == 1].copy()
    inn2 = innings_df[innings_df['inning'] == 2].copy()
    inn1 = inn1.rename(columns={'inning': 'innings'})
    inn2 = inn2.rename(columns={'inning': 'innings'})

    inn1 = inn1.rename(columns={c: f'inn1_{c}' for c in inn1.columns if c not in ['match_id']})
    inn2 = inn2.rename(columns={c: f'inn2_{c}' for c in inn2.columns if c not in ['match_id']})

    matches = matches.merge(inn1, on='match_id', how='left')
    matches = matches.merge(inn2, on='match_id', how='left')

    matches['team1'] = matches['inn1_team']
    matches['team2'] = matches['inn2_team']

    consistent_teams = []
    for _, row in matches.iterrows():
        t1, t2 = sorted([row['team1'], row['team2']])
        consistent_teams.append((t1, t2))
    matches[['team1', 'team2']] = pd.DataFrame(consistent_teams, index=matches.index)

    is_team1_first_inning = matches.apply(
        lambda r: r['inn1_team'] == r['team1'], axis=1
    )

    matches['team1_is_batting_first'] = is_team1_first_inning

    target_col = 'inn1_runs_target' if 'inn1_runs_target' in matches.columns else 'inn2_runs_target'
    if target_col not in matches.columns:
        target_col = 'runs_target'

    runs_target_col = target_col if target_col in matches.columns else None

    matches['target'] = matches.get(runs_target_col or 'runs_target', 0)

    matches['team1_won'] = (matches['match_won_by'] == matches['team1']).astype(int)

    matches = matches.sort_values('date_parsed').reset_index(drop=True)

    return matches


def compute_team_form(matches):
    form_cols = []
    for team_col in ['team1', 'team2']:
        opp_col = 'team2' if team_col == 'team1' else 'team1'
        for window in [3, 5, 10]:
            col_name = f'{team_col}_last{window}_win_rate'
            form_cols.append(col_name)
            win_rates = []
            for idx, row in matches.iterrows():
                team = row[team_col]
                prior = matches.iloc[:idx]
                team_matches = prior[(prior['team1'] == team) | (prior['team2'] == team)]
                team_matches = team_matches.tail(window)
                if len(team_matches) == 0:
                    win_rates.append(0.5)
                else:
                    wins = 0
                    for _, pm in team_matches.iterrows():
                        if pm['match_won_by'] == team:
                            wins += 1
                    win_rates.append(wins / len(team_matches))
            matches[col_name] = win_rates
    return matches


def compute_head_to_head(matches):
    h2h_wins_team1 = []
    h2h_total = []

    for idx, row in matches.iterrows():
        t1, t2 = row['team1'], row['team2']
        prior = matches.iloc[:idx]
        h2h_matches = prior[((prior['team1'] == t1) & (prior['team2'] == t2)) |
                            ((prior['team1'] == t2) & (prior['team2'] == t1))]
        total = len(h2h_matches)
        h2h_total.append(total)
        if total > 0:
            t1_wins = (h2h_matches['match_won_by'] == t1).sum()
            h2h_wins_team1.append(t1_wins / total)
        else:
            h2h_wins_team1.append(0.5)

    matches['h2h_team1_win_rate'] = h2h_wins_team1
    matches['h2h_total_matches'] = h2h_total
    return matches


def compute_venue_features(matches, innings_df):
    t1_venue_win_rate = []
    t2_venue_win_rate = []
    avg_first_innings = []
    chasing_win_rate = []

    venue_first_innings_cache = {}

    for idx, row in matches.iterrows():
        venue = row['venue']
        t1, t2 = row['team1'], row['team2']
        prior = matches.iloc[:idx]

        venue_matches = prior[prior['venue'] == venue]

        t1_at_venue = venue_matches[(venue_matches['team1'] == t1) | (venue_matches['team2'] == t1)]
        t1_vw = 0.5
        if len(t1_at_venue) > 0:
            t1_wins = (t1_at_venue['match_won_by'] == t1).sum()
            t1_vw = t1_wins / len(t1_at_venue)
        t1_venue_win_rate.append(t1_vw)

        t2_at_venue = venue_matches[(venue_matches['team1'] == t2) | (venue_matches['team2'] == t2)]
        t2_vw = 0.5
        if len(t2_at_venue) > 0:
            t2_wins = (t2_at_venue['match_won_by'] == t2).sum()
            t2_vw = t2_wins / len(t2_at_venue)
        t2_venue_win_rate.append(t2_vw)

        if venue not in venue_first_innings_cache:
            inn1_at_venue = innings_df[
                (innings_df['inning'] == 1) &
                (innings_df['match_id'].isin(prior['match_id']))
            ]
            venue_inns = inn1_at_venue[inn1_at_venue['match_id'].isin(
                venue_matches['match_id']
            )]
            if len(venue_inns) > 0:
                venue_first_innings_cache[venue] = venue_inns['total_runs'].mean()
            else:
                venue_first_innings_cache[venue] = 160

        avg_first_innings.append(venue_first_innings_cache.get(venue, 160))

        chase_matches = venue_matches[venue_matches['toss_decision'] == 'field']
        if len(chase_matches) > 0:
            chase_wins = (chase_matches['match_won_by'] == chase_matches['team2']).sum()
            chasing_win_rate.append(chase_wins / len(chase_matches))
        else:
            chasing_win_rate.append(0.5)

    matches['team1_venue_win_rate'] = t1_venue_win_rate
    matches['team2_venue_win_rate'] = t2_venue_win_rate
    matches['avg_first_innings_venue'] = avg_first_innings
    matches['chasing_win_rate_venue'] = chasing_win_rate
    return matches


def compute_batting_strength(matches, innings_df):
    for team_col in ['team1', 'team2']:
        avg_runs = []
        pp_avg = []
        death_avg = []
        boundary_rate = []

        for idx, row in matches.iterrows():
            team = row[team_col]
            prior = matches.iloc[:idx]
            prior_ids = set(prior['match_id'])
            team_inns = innings_df[
                (innings_df['team'] == team) &
                (innings_df['match_id'].isin(prior_ids))
            ].tail(5)

            if len(team_inns) > 0:
                avg_runs.append(team_inns['total_runs'].mean())
                pp_avg.append(team_inns['powerplay_runs'].mean())
                death_avg.append(team_inns['death_runs'].mean())
                total_boundaries = team_inns['boundaries'].sum()
                total_valid_balls = team_inns['valid_balls'].sum()
                br = total_boundaries / total_valid_balls if total_valid_balls > 0 else 0
                boundary_rate.append(br)
            else:
                avg_runs.append(150)
                pp_avg.append(40)
                death_avg.append(40)
                boundary_rate.append(0.05)

        matches[f'{team_col}_recent_avg_runs'] = avg_runs
        matches[f'{team_col}_powerplay_avg'] = pp_avg
        matches[f'{team_col}_death_overs_avg'] = death_avg
        matches[f'{team_col}_boundary_rate'] = boundary_rate

    return matches


def compute_bowling_strength(matches, innings_df):
    for team_col in ['team1', 'team2']:
        avg_wkts = []
        recent_econ = []
        pp_wkts = []
        death_econ = []

        for idx, row in matches.iterrows():
            team = row[team_col]
            prior = matches.iloc[:idx]
            prior_ids = set(prior['match_id'])

            bowled_inns = innings_df[
                (innings_df['bowling_team'] == team) &
                (innings_df['match_id'].isin(prior_ids))
            ].tail(5)

            if len(bowled_inns) > 0:
                avg_wkts.append(bowled_inns['wickets'].mean())
                total_runs = bowled_inns['total_runs'].sum()
                total_balls = bowled_inns['valid_balls'].sum()
                econ = total_runs / (total_balls / 6) if total_balls > 0 else 8
                recent_econ.append(econ)
                pp_wkts.append(bowled_inns['powerplay_wickets'].mean())
                death_econ.append(bowled_inns['death_economy'].mean())
            else:
                avg_wkts.append(5)
                recent_econ.append(8)
                pp_wkts.append(1)
                death_econ.append(10)

        matches[f'{team_col}_recent_avg_wickets'] = avg_wkts
        matches[f'{team_col}_recent_economy'] = recent_econ
        matches[f'{team_col}_powerplay_wickets'] = pp_wkts
        matches[f'{team_col}_death_overs_economy'] = death_econ

    return matches


def compute_match_context(matches):
    matches['toss_winner_is_team1'] = (matches['toss_winner'] == matches['team1']).astype(int)
    matches['toss_decision_bat'] = (matches['toss_decision'] == 'bat').astype(int)

    playoff_stages = ['final', 'semifinal', 'qualifier', 'eliminator', 'qualifier 1', 'qualifier 2']
    matches['is_playoff'] = matches['stage'].str.lower().isin(playoff_stages).astype(int)

    home_city_map = {
        'Chennai Super Kings': 'Chennai',
        'Mumbai Indians': 'Mumbai',
        'Royal Challengers Bangalore': 'Bangalore',
        'Kolkata Knight Riders': 'Kolkata',
        'Sunrisers Hyderabad': 'Hyderabad',
        'Delhi Capitals': 'Delhi',
        'Punjab Kings': 'Mohali',
        'Rajasthan Royals': 'Jaipur',
        'Lucknow Super Giants': 'Lucknow',
        'Gujarat Titans': 'Ahmedabad',
        'Gujarat Lions': 'Rajkot',
        'Deccan Chargers': 'Hyderabad',
        'Kochi Tuskers Kerala': 'Kochi',
        'Pune Warriors': 'Pune',
        'Pune Warriors India': 'Pune',
        'Rising Pune Supergiants': 'Pune',
    }

    matches['team1_is_home'] = matches.apply(
        lambda r: 1 if r['city'] == home_city_map.get(r['team1'], '') else 0, axis=1
    )
    matches['team2_is_home'] = matches.apply(
        lambda r: 1 if r['city'] == home_city_map.get(r['team2'], '') else 0, axis=1
    )

    matches['season'] = matches['season'].astype(str)

    return matches


def compute_nrr_proxy(matches, innings_df):
    for team_col in ['team1', 'team2']:
        nrr = []
        for idx, row in matches.iterrows():
            team = row[team_col]
            prior = matches.iloc[:idx]
            prior_ids = set(prior['match_id'])

            team_batting = innings_df[
                (innings_df['team'] == team) &
                (innings_df['match_id'].isin(prior_ids))
            ].tail(5)

            team_bowling = innings_df[
                (innings_df['bowling_team'] == team) &
                (innings_df['match_id'].isin(prior_ids))
            ].tail(5)

            if len(team_batting) > 0 and len(team_bowling) > 0:
                bat_rr = team_batting['run_rate'].mean()
                bowl_rr = team_bowling['run_rate'].mean()
                nrr.append(bat_rr - bowl_rr)
            else:
                nrr.append(0)

        matches[f'{team_col}_nrr_proxy'] = nrr
    return matches


def compute_momentum(matches):
    for team_col in ['team1', 'team2']:
        opp_col = 'team2' if team_col == 'team1' else 'team1'
        weighted_form = []
        batting_momentum = []

        for idx, row in matches.iterrows():
            team = row[team_col]
            prior = matches.iloc[:idx]
            team_matches = prior[(prior['team1'] == team) | (prior['team2'] == team)].tail(5)

            if len(team_matches) > 0:
                weights = np.exp(np.linspace(-1, 0, len(team_matches)))
                weights = weights / weights.sum()
                wins = np.array([
                    1 if pm['match_won_by'] == team else 0
                    for _, pm in team_matches.iterrows()
                ])
                weighted_form.append(float(np.dot(weights, wins)))
            else:
                weighted_form.append(0.5)

            if len(team_matches) >= 3:
                recent_3 = team_matches.tail(3)
                innings_data = []
                for _, pm in recent_3.iterrows():
                    if pm['team1'] == team:
                        innings_data.append(pm.get('inn1_total_runs', pm.get('team_runs', 150)))
                    else:
                        innings_data.append(pm.get('inn2_total_runs', pm.get('team_runs', 150)))
                if len(innings_data) >= 2:
                    x = np.arange(len(innings_data))
                    y = np.array(innings_data)
                    slope = np.polyfit(x, y, 1)[0]
                    batting_momentum.append(float(slope))
                else:
                    batting_momentum.append(0)
            else:
                batting_momentum.append(0)

        matches[f'weighted_recent_form_{team_col}'] = weighted_form
        matches[f'batting_momentum_{team_col}'] = batting_momentum

    return matches


def run_feature_pipeline(df, innings_df, matches):
    matches = compute_team_form(matches)
    matches = compute_head_to_head(matches)
    matches = compute_venue_features(matches, innings_df)
    matches = compute_batting_strength(matches, innings_df)
    matches = compute_bowling_strength(matches, innings_df)
    matches = compute_match_context(matches)
    matches = compute_nrr_proxy(matches, innings_df)
    matches = compute_momentum(matches)

    feature_cols = [c for c in matches.columns if c not in [
        'match_id', 'date_parsed', 'season', 'venue', 'city',
        'toss_winner', 'toss_decision', 'stage',
        'match_won_by', 'team1', 'team2',
        'inn1_team', 'inn1_bowling_team', 'inn1_total_runs',
        'inn1_valid_balls', 'inn1_wickets', 'inn1_run_rate',
        'inn1_powerplay_runs', 'inn1_powerplay_wickets', 'inn1_powerplay_balls',
        'inn1_middle_runs', 'inn1_middle_wickets', 'inn1_middle_balls',
        'inn1_death_runs', 'inn1_death_wickets', 'inn1_death_balls',
        'inn1_death_economy', 'inn1_boundaries', 'inn1_dot_balls', 'inn1_extras',
        'inn2_team', 'inn2_bowling_team', 'inn2_total_runs',
        'inn2_valid_balls', 'inn2_wickets', 'inn2_run_rate',
        'inn2_powerplay_runs', 'inn2_powerplay_wickets', 'inn2_powerplay_balls',
        'inn2_middle_runs', 'inn2_middle_wickets', 'inn2_middle_balls',
        'inn2_death_runs', 'inn2_death_wickets', 'inn2_death_balls',
        'inn2_death_economy', 'inn2_boundaries', 'inn2_dot_balls', 'inn2_extras',
        'team1_is_batting_first', 'target', 'runs_target',
        'team_runs', 'team_balls', 'team_wicket',
        'team1_won',
    ]]

    return matches, feature_cols
