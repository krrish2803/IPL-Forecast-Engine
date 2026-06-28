import pandas as pd
import numpy as np


class EloSystem:
    def __init__(self, k=32, starting_elo=1500):
        self.k = k
        self.starting_elo = starting_elo
        self.ratings = {}

    def get_rating(self, team):
        return self.ratings.get(team, self.starting_elo)

    def expected_score(self, rating_a, rating_b):
        return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))

    def update(self, team_a, team_b, winner):
        rating_a = self.get_rating(team_a)
        rating_b = self.get_rating(team_b)

        expected_a = self.expected_score(rating_a, rating_b)
        expected_b = 1.0 - expected_a

        score_a = 1.0 if winner == team_a else 0.0
        score_b = 1.0 if winner == team_b else 0.0

        new_rating_a = rating_a + self.k * (score_a - expected_a)
        new_rating_b = rating_b + self.k * (score_b - expected_b)

        self.ratings[team_a] = new_rating_a
        self.ratings[team_b] = new_rating_b

    def get_elo_features(self, matches_df):
        elo = EloSystem()
        elo_team1 = []
        elo_team2 = []
        elo_diff = []

        for _, row in matches_df.iterrows():
            t1, t2 = row['team1'], row['team2']
            r1 = elo.get_rating(t1)
            r2 = elo.get_rating(t2)

            elo_team1.append(r1)
            elo_team2.append(r2)
            elo_diff.append(r1 - r2)

            winner = row['match_won_by']
            if winner in [t1, t2]:
                elo.update(t1, t2, winner)

        matches_df['elo_team1'] = elo_team1
        matches_df['elo_team2'] = elo_team2
        matches_df['elo_diff'] = elo_diff

        return matches_df


def compute_elo_ratings(matches_df):
    elo_system = EloSystem()
    return elo_system.get_elo_features(matches_df)
