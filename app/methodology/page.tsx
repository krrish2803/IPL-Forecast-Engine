'use client'

import { motion } from 'framer-motion'
import { Shield, GitBranch, BarChart3, Cpu, TrendingUp, AlertTriangle, Lightbulb, Eye, Layers } from 'lucide-react'

const sections = [
  {
    id: 'cleaning',
    icon: Eye,
    title: 'Data Cleaning',
    desc: 'Real sports data is messy. The pipeline handles multiple edge cases before any feature engineering.',
    details: [
      'Team franchise renames: Delhi Daredevils → Delhi Capitals, Kings XI Punjab → Punjab Kings, Deccan Chargers → Sunrisers Hyderabad',
      'Inconsistent player name formatting normalized across seasons',
      'Missing venue/city values filled using mode per venue',
      'Duplicate match rows removed by (match_id, inning, over, ball)',
      'Date parsed from day/month/year columns',
    ],
    beforeAfter: {
      before: '280,000+ raw rows with missing values, inconsistent names, no-result matches',
      after: 'Cleaned dataset with normalized teams, no leakage, no D/L or super over matches',
    },
  },
  {
    id: 'leakage',
    icon: Shield,
    title: 'Leakage Prevention',
    desc: 'The most critical ML pitfall in sports analytics is data leakage. Here is every precaution taken.',
    details: [
      'player_of_match: Awarded post-match, gives direct information about who played well',
      'umpire, umpires_call: Not known before the match begins',
      'review_batter, team_reviewed, review_decision: Review data is not available pre-match',
      'match_won_by: Strictly the target variable, never used as a feature',
      'All rolling/lagged features use only matches strictly prior to the current match date',
    ],
  },
  {
    id: 'split',
    icon: GitBranch,
    title: 'Train / Validation / Test Split',
    desc: 'Time-based split ensures the model is evaluated on truly unseen future data.',
    details: [
      'All matches sorted chronologically by date before any split',
      'Training set: All seasons except the last two',
      'Validation set: The second-to-last season (used for model selection)',
      'Test set: The last season (held out completely until final evaluation)',
      'No random shuffle — preserves temporal ordering',
      'This is the gold standard for time-series ML evaluation',
    ],
    timeline: [
      { year: '2008-2021', label: 'Training', color: 'bg-accent' },
      { year: '2022', label: 'Validation', color: 'bg-yellow-500' },
      { year: '2023', label: 'Test (Held Out)', color: 'bg-blue-500' },
    ],
  },
  {
    id: 'features',
    icon: Layers,
    title: 'Feature Engineering',
    desc: '85 features across 9 groups, all computed without leakage. Here is the complete breakdown.',
    groups: [
      {
        name: 'Team Form', items: 'Last 3/5/10 match win rates. Weighted recent form with exponential decay (higher weight to recent matches).',
      },
      {
        name: 'Head-to-Head', items: 'Head-to-head win rate over the last 5 meetings. Total head-to-head match count.',
      },
      {
        name: 'Venue Intelligence', items: 'Per-team win rate at venue. Average first innings score at venue. Chasing win rate at venue.',
      },
      {
        name: 'ELO Ratings', items: 'Dynamic ELO system with K-factor=32. Starting rating 1500. Rating and differential before each match. Updated after each match chronologically.',
      },
      {
        name: 'Batting Strength', items: 'Recent 5-match average runs, powerplay average, death overs average, boundary rate (4s+6s per ball).',
      },
      {
        name: 'Bowling Strength', items: 'Recent 5-match average wickets, economy rate, powerplay wickets, death overs economy.',
      },
      {
        name: 'Match Context', items: 'Toss winner indicator, toss decision (bat/field), playoff flag, home team indicators (venue city matches team city).',
      },
      {
        name: 'Net Run Rate Proxy', items: 'Average batting run rate minus average bowling run rate over last 5 matches — approximates NRR without using ball-by-ball data.',
      },
      {
        name: 'Momentum', items: 'Exponentially weighted win rate trend. Batting momentum (slope of runs over last 3 matches). Positive slope = improving form.',
      },
    ],
  },
  {
    id: 'models',
    icon: Cpu,
    title: 'Model Selection',
    desc: 'Four diverse models are trained and compared. The best by validation ROC-AUC is used for predictions.',
    models: [
      {
        name: 'Logistic Regression',
        desc: 'Simple, interpretable baseline. Uses L2 regularization. Good for understanding feature direction.',
        pros: ['Fast training', 'Interpretable coefficients', 'Low variance'],
      },
      {
        name: 'Random Forest',
        desc: '300 trees, max depth 12, min samples leaf 5. Ensemble of decision trees with bagging.',
        pros: ['Handles non-linearity', 'Feature importance built-in', 'Robust to outliers'],
      },
      {
        name: 'XGBoost',
        desc: '300 estimators, depth 6, learning rate 0.05, subsample 0.8, colsample 0.8. Gradient boosted trees.',
        pros: ['State-of-the-art tabular', 'Regularization built-in', 'Handles missing values'],
      },
      {
        name: 'CatBoost',
        desc: '300 iterations, depth 6, learning rate 0.05. Handles categorical features natively.',
        pros: ['Great with categoricals', 'Ordered boosting', 'Less tuning needed'],
      },
    ],
  },
  {
    id: 'simulation',
    icon: TrendingUp,
    title: 'Season Simulation',
    desc: 'Monte Carlo simulation using the trained model as the outcome generator.',
    details: [
      'Input: Fixture list with team1, team2, venue for each match',
      'For each match, the model predicts win probability for team1',
      'A random draw samples the outcome from these probabilities',
      'Points awarded: 2 for win, 0 for loss (standard IPL format)',
      'ELO ratings updated after each match within the simulation',
      'Process repeated 1000+ times for statistical significance',
      'Output: Title probability, top-4 probability, average points table',
    ],
  },
  {
    id: 'limitations',
    icon: AlertTriangle,
    title: 'Known Limitations',
    desc: 'No model is perfect. Here are the important caveats.',
    details: [
      'Does not account for player injuries or team lineup changes',
      'Toss is treated as known input — in a true pre-match setting, toss hasn\'t happened yet',
      'Venue-based home advantage is approximate (teams may play at neutral venues)',
      'Early IPL seasons have fewer prior matches, so rolling features are noisier',
      'The model does not use player-level data (no player quality metric)',
      'Power Surge / Impact Player rules (2023+) not explicitly modeled',
    ],
  },
  {
    id: 'future',
    icon: Lightbulb,
    title: 'Future Improvements',
    desc: 'Planned enhancements for the next version.',
    details: [
      'Player quality scores from historical performance (weighted recent averages)',
      'Head-to-head bowler vs batter matchup data',
      'Weather and pitch report data (external API integration)',
      'Live in-play prediction during matches',
      'Deep learning model (Transformer over ball sequences)',
      'Real-time model retraining as new matches are played',
      'Auction and squad data integration for pre-season predictions',
    ],
  },
]

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl font-bold text-text-primary">Methodology</h1>
        <p className="text-text-secondary mt-1">How the IPL Forecast Engine works, end to end</p>
      </motion.div>

      {sections.map((section, idx) => (
        <motion.section
          key={section.id}
          id={section.id}
          className="space-y-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <section.icon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold text-text-primary">{section.title}</h2>
              <p className="text-sm text-text-secondary">{section.desc}</p>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            {'details' in section && section.details && (
              <ul className="space-y-2">
                {section.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/60 mt-2 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            )}

            {'beforeAfter' in section && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="bg-surface2 rounded-lg p-4 border border-border">
                  <div className="text-xs text-red-400 font-medium mb-1">Before Cleaning</div>
                  <div className="text-sm text-text-secondary">{section.beforeAfter!.before}</div>
                </div>
                <div className="bg-surface2 rounded-lg p-4 border border-border">
                  <div className="text-xs text-accent font-medium mb-1">After Cleaning</div>
                  <div className="text-sm text-text-secondary">{section.beforeAfter!.after}</div>
                </div>
              </div>
            )}

            {'timeline' in section && (
              <div className="flex items-center gap-2 mt-4">
                {section.timeline!.map((t) => (
                  <div key={t.year} className="flex-1 text-center">
                    <div className={`h-2 rounded-full ${t.color} mb-2`} />
                    <div className="text-xs font-mono text-text-primary">{t.year}</div>
                    <div className="text-xs text-text-secondary">{t.label}</div>
                  </div>
                ))}
              </div>
            )}

            {'groups' in section && (
              <div className="space-y-3">
                {section.groups!.map((g) => (
                  <div key={g.name} className="bg-surface2 rounded-lg p-4 border border-border">
                    <div className="text-sm font-medium text-text-primary mb-1">{g.name}</div>
                    <div className="text-xs text-text-secondary">{g.items}</div>
                  </div>
                ))}
              </div>
            )}

            {'models' in section && (
              <div className="grid sm:grid-cols-2 gap-4">
                {section.models!.map((m) => (
                  <div key={m.name} className="bg-surface2 rounded-lg p-4 border border-border">
                    <div className="text-sm font-medium text-accent mb-1">{m.name}</div>
                    <div className="text-xs text-text-secondary mb-2">{m.desc}</div>
                    <ul className="space-y-1">
                      {m.pros.map((p) => (
                        <li key={p} className="text-xs text-text-secondary flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-accent" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      ))}
    </div>
  )
}
