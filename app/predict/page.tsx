'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Zap, TrendingUp, TrendingDown, Info, Loader2 } from 'lucide-react'
import { getTeams, getVenues, predictMatch } from '@/lib/api'
import type { PredictResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

const FEATURE_LABELS: Record<string, string> = {
  weighted_recent_form_team1: 'Recent Form',
  weighted_recent_form_team2: 'Opponent Recent Form',
  home_team1: 'Home Advantage',
  venue_familiarity_team1: 'Venue Familiarity',
  venue_familiarity_team2: 'Opponent Venue Familiarity',
  head_to_head_win_pct: 'Head-to-Head Record',
  elo_rating_team1: 'Team Strength (ELO)',
  elo_rating_team2: 'Opponent Strength (ELO)',
  team1_rest_days: 'Rest Advantage',
  team2_rest_days: 'Opponent Rest Days',
  team1_momentum: 'Momentum',
  team2_momentum: 'Opponent Momentum',
  elo_team1: 'Team Strength (ELO)',
  elo_team2: 'Opponent Strength (ELO)',
  recent_form_team1: 'Recent Form',
  recent_form_team2: 'Opponent Recent Form',
  h2h_win_pct: 'Head-to-Head Record',
  season_win_pct_team1: 'Season Record',
  season_win_pct_team2: 'Opponent Season Record',
  venue_win_pct_team1: 'Venue Record',
  venue_win_pct_team2: 'Opponent Venue Record',
  toss_win_pct_team1: 'Toss Record',
  toss_win_pct_team2: 'Opponent Toss Record',
  elo_probability: 'ELO Rating Difference',
  weighted_recent_form_diff: 'Form Difference',
}

function labelFor(feature: string): string {
  return FEATURE_LABELS[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getConfidenceLevel(prob: number): { label: string; color: string } {
  const confidence = Math.max(prob, 1 - prob)
  if (confidence >= 0.65) return { label: 'High Confidence', color: 'text-accent' }
  if (confidence >= 0.50) return { label: 'Medium Confidence', color: 'text-yellow-400' }
  return { label: 'Coin Flip', color: 'text-red-400' }
}

export default function PredictPage() {
  const [teams, setTeams] = useState<string[]>([])
  const [venues, setVenues] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictResponse | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    team1: '',
    team2: '',
    venue: '',
    toss_winner: '',
    toss_decision: 'bat',
    stage: 'League',
  })

  useEffect(() => {
    Promise.all([getTeams(), getVenues()])
      .then(([t, v]) => {
        setTeams(t.teams)
        setVenues(v.venues)
      })
      .catch(() => setError('Could not load teams/venues. Ensure the Python service is running.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!form.team1 || !form.team2 || !form.venue || !form.toss_winner) return
    if (form.team1 === form.team2) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      handlePredict()
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [form.team1, form.team2, form.venue, form.toss_winner, form.toss_decision, form.stage])

  const handlePredict = async () => {
    if (!form.team1 || !form.team2 || !form.venue || !form.toss_winner) return
    if (form.team1 === form.team2) { setError('Team 1 and Team 2 must be different'); return }

    setPredicting(true)
    setError(null)
    setResult(null)

    try {
      const res = await predictMatch({
        ...form,
        season: '2024',
      })
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Prediction failed')
    } finally {
      setPredicting(false)
    }
  }

  const probData = result ? [
    { name: form.team1, probability: result.team1_win_probability },
    { name: form.team2, probability: result.team2_win_probability },
  ] : []

  const shapData = result
    ? result.explanation.top_factors.map((f) => ({
        label: labelFor(f.factor),
        impact: f.impact,
        direction: f.direction === 'supports' ? 'positive' : 'negative',
        absImpact: Math.abs(f.impact),
      })).sort((a, b) => b.absImpact - a.absImpact).slice(0, 5)
    : []

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl font-bold text-text-primary">Match Predictor</h1>
        <p className="text-text-secondary mt-1">Select teams and match context to predict the winner</p>
      </motion.div>

      {error && (
        <div className="glass-panel p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <Info className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <motion.div className="glass-panel p-6 space-y-5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="font-heading text-lg font-semibold text-text-primary">Match Details</h2>

          <SelectField label="Team 1" value={form.team1} onChange={(v) => setForm(f => ({ ...f, team1: v, toss_winner: f.toss_winner === f.team1 ? v : f.toss_winner === f.team2 ? f.team2 : f.toss_winner }))} options={teams} placeholder="Select team" />
          <SelectField label="Team 2" value={form.team2} onChange={(v) => setForm(f => ({ ...f, team2: v, toss_winner: f.toss_winner === f.team2 ? v : f.toss_winner === f.team1 ? f.team1 : f.toss_winner }))} options={teams.filter(t => t !== form.team1)} placeholder="Select team" />
          <SelectField label="Venue" value={form.venue} onChange={(v) => setForm(f => ({ ...f, venue: v, toss_winner: f.toss_winner || '' }))} options={venues} placeholder="Select venue" />

          <SelectField label="Toss Winner" value={form.toss_winner} onChange={(v) => setForm(f => ({ ...f, toss_winner: v }))} options={[form.team1, form.team2].filter(Boolean)} placeholder="Select toss winner" />

          <div>
            <label className="block text-sm text-text-secondary mb-2">Toss Decision</label>
            <div className="flex gap-3">
              {['bat', 'field'].map((d) => (
                <button
                  key={d}
                  onClick={() => setForm(f => ({ ...f, toss_decision: d }))}
                  className={cn(
                    'flex-1 py-3 rounded-lg border text-sm font-medium transition-all',
                    form.toss_decision === d
                      ? 'bg-accent text-background border-accent'
                      : 'border-border text-text-secondary hover:border-accent/50'
                  )}
                >
                  {d === 'bat' ? 'Bat First' : 'Field First'}
                </button>
              ))}
            </div>
          </div>

          <SelectField label="Stage" value={form.stage} onChange={(v) => setForm(f => ({ ...f, stage: v }))} options={['League', 'Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final']} placeholder="Select stage" />

          <button
            onClick={handlePredict}
            disabled={predicting || !form.team1 || !form.team2 || !form.venue || !form.toss_winner}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {predicting ? 'Predicting...' : 'Predict Winner'}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-6 space-y-6"
              >
                <div>
                  <h2 className="font-heading text-lg font-semibold text-text-primary mb-1">Prediction Result</h2>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <span className="text-accent font-heading font-bold text-xl">{result.predicted_winner}</span>
                    <span className="text-text-secondary text-sm">wins</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', getConfidenceLevel(result.team1_win_probability).color, 'border-current/30')}>
                      {getConfidenceLevel(result.team1_win_probability).label}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {probData.map((team, i) => {
                    const isWinner = team.name === result.predicted_winner
                    const pct = team.probability * 100
                    return (
                      <div key={team.name}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={cn('text-sm font-medium', isWinner ? 'text-text-primary' : 'text-text-secondary')}>
                            {team.name}
                            {isWinner && <span className="ml-2 text-accent text-xs">WINNER</span>}
                          </span>
                          <span className={cn('text-sm font-mono font-bold', isWinner ? 'text-accent' : 'text-text-secondary')}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-3 bg-surface2 rounded-full overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full', isWinner ? 'bg-accent' : 'bg-muted')}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div>
                  <h3 className="font-heading font-semibold text-text-primary mb-3">Key Factors</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shapData} layout="vertical" barCategoryGap={12}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" horizontal={false} />
                        <XAxis type="number" stroke="#8B8E96" fontSize={11} />
                        <YAxis type="category" dataKey="label" stroke="#8B8E96" fontSize={11} width={150} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#13151A', border: '1px solid #2A2D35', borderRadius: '8px' }}
                          formatter={(_: any, __: any, props: any) => {
                            const d = props.payload
                            return [`${d.direction === 'positive' ? '+' : ''}${d.impact.toFixed(4)}`, d.direction === 'positive' ? `Helps ${form.team1}` : `Hurts ${form.team1}`]
                          }}
                          labelFormatter={() => ''}
                        />
                        <Bar
                          dataKey="absImpact"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={20}
                          shape={(props: any) => {
                            const { x, y, width, height, payload } = props
                            const fill = payload.direction === 'positive' ? '#00D4AA' : '#EF4444'
                            return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {result.explanation.top_factors.slice(0, 3).map((f, i) => {
                    const isPositive = f.direction === 'supports'
                    return (
                      <div key={i} className="flex items-center justify-between glass-panel p-3 mt-2">
                        <span className="text-sm text-text-primary">{labelFor(f.factor)}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-mono', isPositive ? 'text-accent' : 'text-red-400')}>
                            {isPositive ? '+' : ''}{f.impact.toFixed(4)}
                          </span>
                          {isPositive
                            ? <TrendingUp className="w-3 h-3 text-accent" />
                            : <TrendingDown className="w-3 h-3 text-red-400" />
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel p-12 text-center h-full flex flex-col items-center justify-center"
              >
                <Zap className="w-12 h-12 text-muted mb-4" />
                <p className="text-text-secondary text-sm">Fill in match details and click Predict to see results</p>
                {predicting && (
                  <div className="flex items-center gap-2 mt-4 text-accent">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Predicting...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string
}) {
  return (
    <div>
      <label className="block text-sm text-text-secondary mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-text-primary text-sm
                   focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
