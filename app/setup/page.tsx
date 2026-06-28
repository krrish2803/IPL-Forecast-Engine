'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, CheckCircle2, XCircle, Loader2, ArrowRight, Clock, Table2 } from 'lucide-react'
import { trainModel } from '@/lib/api'
import type { TrainResponse } from '@/lib/types'
import { formatDuration, cn } from '@/lib/utils'

const EXPECTED_COLUMNS = [
  'match_id', 'inning', 'batting_team', 'bowling_team', 'over', 'ball',
  'batter', 'bowler', 'runs_total', 'valid_ball', 'wicket_kind', 'player_out',
  'match_won_by', 'venue', 'city', 'day', 'month', 'year', 'season',
  'toss_winner', 'toss_decision', 'gender', 'team_type', 'result_type', 'method',
  'stage', 'player_of_match',
]

export default function SetupPage() {
  const [training, setTraining] = useState(false)
  const [trained, setTrained] = useState(false)
  const [result, setResult] = useState<TrainResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTrain = async () => {
    setTraining(true)
    setError(null)
    try {
      const res = await trainModel()
      setResult(res)
      setTrained(true)
    } catch (e: any) {
      setError(e.message || 'Training failed. Is the Python service running on port 8000?')
    } finally {
      setTraining(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl font-bold text-text-primary">Dataset Setup</h1>
        <p className="text-text-secondary mt-1">Configure and train the model on your IPL dataset</p>
      </motion.div>

      <motion.div className="glass-panel p-6 space-y-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="font-heading text-lg font-semibold text-text-primary flex items-center gap-2">
          <Database className="w-5 h-5 text-accent" />
          Step 1: Place Dataset
        </h2>
        <div className="bg-surface2 rounded-lg p-4 text-sm space-y-3">
          <p className="text-text-secondary">
            Place your IPL ball-by-ball CSV file in <code className="text-accent font-mono text-xs bg-background px-2 py-1 rounded">/data/raw/</code>
          </p>
          <p className="text-text-secondary">The pipeline auto-detects any CSV in that directory.</p>
          <div className="border border-border rounded-lg p-3">
            <p className="text-xs text-text-secondary mb-2 font-medium">Expected columns (26+):</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPECTED_COLUMNS.map((col) => (
                <span key={col} className="text-xs font-mono bg-background px-2 py-1 rounded text-text-secondary border border-border">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div className="glass-panel p-6 space-y-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="font-heading text-lg font-semibold text-text-primary">Step 2: Train Models</h2>
        <p className="text-sm text-text-secondary">
          This runs the full pipeline: clean → aggregate → feature engineer → train 4 models → evaluate → save artifacts.
          May take several minutes depending on dataset size.
        </p>

        <button
          onClick={handleTrain}
          disabled={training}
          className={cn(
            'btn-primary flex items-center gap-2',
            trained && 'bg-accent/50 hover:bg-accent/60'
          )}
        >
          {training ? <Loader2 className="w-4 h-4 animate-spin" /> : trained ? <CheckCircle2 className="w-4 h-4" /> : <Database className="w-4 h-4" />}
          {training ? 'Training Pipeline...' : trained ? 'Retrain Model' : 'Start Training'}
        </button>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-2 text-red-400 text-sm">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-accent text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Training completed successfully
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-xs text-text-secondary mb-1">Duration</div>
                <div className="font-mono text-accent text-sm">{formatDuration(result.duration_seconds)}</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-xs text-text-secondary mb-1">Best Model</div>
                <div className="font-mono text-accent text-sm">{result.best_model}</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-xs text-text-secondary mb-1">Best AUC</div>
                <div className="font-mono text-accent text-sm">{result.best_model_auc.toFixed(3)}</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-xs text-text-secondary mb-1">Train / Val / Test</div>
                <div className="font-mono text-accent text-sm">{result.train_size}/{result.val_size}/{result.test_size}</div>
              </div>
            </div>
            <div className="pt-2">
              <a href="/dashboard" className="btn-primary inline-flex items-center gap-2">
                View Dashboard <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </motion.div>

      <motion.div className="glass-panel p-6 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <h3 className="font-heading font-semibold text-text-primary flex items-center gap-2">
          <Table2 className="w-4 h-4 text-accent" />
          What the Pipeline Does
        </h3>
        <div className="space-y-2 text-sm text-text-secondary">
          {[
            'Reads raw CSV and validates all required columns',
            'Normalizes team franchise renames (DD → DC, KXIP → PBKS, etc.)',
            'Filters to men\'s T20 matches, drops no-result and D/L matches',
            'Removes super over matches and duplicate rows',
            'Drops leakage columns (player_of_match, umpire, reviews)',
            'Aggregates ball-by-ball to innings then match level',
            'Engineers 85+ features from strictly prior matches',
            'Computes ELO ratings chronologically',
            'Trains Logistic Regression, Random Forest, XGBoost, CatBoost',
            'Time-based split: last 2 seasons held out',
            'Generates SHAP feature importance',
            'Saves all artifacts to /models and /reports',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
              {step}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
