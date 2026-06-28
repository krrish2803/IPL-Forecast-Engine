'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Calendar, Target, TrendingUp, Loader2, AlertTriangle, Trophy, Table2 } from 'lucide-react'
import { getTeams } from '@/lib/api'

const PYTHON_SERVICE_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8000'

interface FocusTeamResult {
  team: string
  title_probability: number
  top4_probability: number
  avg_points: number
  projected_win_rate: number
  projected_wins: number
  total_matches: number
}

interface SeasonPredictResponse {
  target_season: number
  n_simulations: number
  focus_team: FocusTeamResult | null
  title_probabilities: { team: string; probability: number }[]
  top4_probabilities: { team: string; probability: number }[]
  avg_points_table: { team: string; avg_points: number }[]
}

export default function SeasonPredictPage() {
  const [teams, setTeams] = useState<string[]>([])
  const [year, setYear] = useState(2027)
  const [focusTeam, setFocusTeam] = useState('')
  const [nSims, setNSims] = useState(1000)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SeasonPredictResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTeams()
      .then((t) => {
        const active = t.teams.filter((team) => ![
          'Gujarat Lions', 'Kochi Tuskers Kerala', 'Pune Warriors',
          'Pune Warriors India', 'Rising Pune Supergiants', 'Deccan Chargers',
        ].includes(team))
        setTeams(active)
        if (active.length > 0) setFocusTeam(active[0])
      })
      .catch(() => setError('Could not load teams. Is the Python service running?'))
  }, [])

  const handlePredict = async () => {
    if (!focusTeam) return
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${PYTHON_SERVICE_URL}/predict-season`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_year: year, focus_team: focusTeam, n_simulations: nSims }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const data: SeasonPredictResponse = await res.json()
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Prediction failed')
    } finally {
      setRunning(false)
    }
  }

  const titleData = result
    ? result.title_probabilities
        .map((tp) => ({
          team: tp.team,
          titlePct: tp.probability * 100,
          top4: result.top4_probabilities.find((t) => t.team === tp.team)?.probability || 0,
        }))
        .sort((a, b) => b.titlePct - a.titlePct)
    : []

  const maxTitlePct = titleData.length > 0 ? Math.max(...titleData.map((d) => d.titlePct)) : 100

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl font-bold text-text-primary">Season Predictor</h1>
        <p className="text-text-secondary mt-1">Project team strengths forward and simulate a future IPL season</p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        <motion.div className="glass-panel p-6 space-y-5 lg:col-span-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="font-heading text-lg font-semibold text-text-primary">Projection Settings</h2>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Target Season Year</label>
            <input
              type="number"
              min={2025}
              max={2040}
              value={year}
              onChange={(e) => setYear(Math.max(2025, Math.min(2040, parseInt(e.target.value) || 2027)))}
              className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Focus Team</label>
            <select
              value={focusTeam}
              onChange={(e) => setFocusTeam(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent appearance-none cursor-pointer"
            >
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Simulations</label>
            <input
              type="number"
              min={100}
              max={10000}
              value={nSims}
              onChange={(e) => setNSims(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
              className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={handlePredict}
            disabled={running || !focusTeam}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {running ? `Simulating ${nSims.toLocaleString()} seasons...` : `Predict ${year} Season`}
          </button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Projection based on current team strengths from historical data. Does not account for squad changes, retirements, or future transfers.</span>
          </div>
        </motion.div>

        <motion.div className="lg:col-span-2 space-y-6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          {result ? (
            <>
              {result.focus_team && (
                <motion.div
                  className="glass-panel p-6 border-accent/30 bg-acent/5"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-accent" />
                    <h3 className="font-heading text-lg font-semibold text-text-primary">{result.focus_team.team} — {result.target_season} Projection</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-surface2 rounded-lg p-4 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Title Probability</div>
                      <div className="font-heading text-2xl font-bold text-accent">
                        {(result.focus_team.title_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-surface2 rounded-lg p-4 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Top 4 Probability</div>
                      <div className="font-heading text-2xl font-bold text-accent">
                        {(result.focus_team.top4_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-surface2 rounded-lg p-4 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Avg Points</div>
                      <div className="font-heading text-2xl font-bold text-text-primary">
                        {result.focus_team.avg_points}
                      </div>
                    </div>
                    <div className="bg-surface2 rounded-lg p-4 text-center border border-border">
                      <div className="text-xs text-text-secondary mb-1">Projected Win Rate</div>
                      <div className="font-heading text-2xl font-bold text-text-primary">
                        {(result.focus_team.projected_win_rate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-text-secondary text-center">
                    Based on {result.n_simulations.toLocaleString()} simulations of a round-robin season
                    ({result.focus_team.projected_wins} projected wins in {result.focus_team.total_matches.toFixed(0)} matches)
                  </div>
                </motion.div>
              )}

              <div className="glass-panel p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-accent" />
                  <h3 className="font-heading text-lg font-semibold text-text-primary">Title Probabilities — All Teams</h3>
                </div>
                <div className="space-y-3">
                  {titleData.map((team, i) => {
                    const isFocus = team.team === focusTeam
                    const barWidth = maxTitlePct > 0 ? (team.titlePct / maxTitlePct) * 100 : 0
                    return (
                      <motion.div
                        key={team.team}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.4 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-text-secondary font-mono w-5 text-right shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-sm truncate ${isFocus ? 'text-accent font-medium' : 'text-text-primary'}`}>
                                {team.team}
                                {isFocus && <span className="ml-2 text-xs text-accent">(focus)</span>}
                              </span>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-text-secondary">
                                  Top 4: <span className="text-text-primary font-medium">{(team.top4 * 100).toFixed(1)}%</span>
                                </span>
                                <span className={`text-sm font-mono font-bold w-14 text-right ${isFocus ? 'text-accent' : 'text-text-primary'}`}>
                                  {team.titlePct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-4 bg-surface2 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  background: isFocus
                                    ? 'linear-gradient(90deg, #00D4AA, #00F5C8)'
                                    : 'linear-gradient(90deg, #2A2D35, #4A4D55)',
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="glass-panel p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    <h3 className="font-heading text-lg font-semibold text-text-primary">Top 4 Probabilities</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={result.top4_probabilities.map((tp) => ({ ...tp, pct: tp.probability * 100 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" vertical={false} />
                      <XAxis dataKey="team" stroke="#8B8E96" fontSize={10} angle={-25} textAnchor="end" height={60} />
                      <YAxis domain={[0, 100]} stroke="#8B8E96" fontSize={11} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#13151A', border: '1px solid #2A2D35', borderRadius: '8px' }}
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                      />
                      <Bar dataKey="pct" fill="#4ECDC4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-panel p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Table2 className="w-5 h-5 text-accent" />
                    <h3 className="font-heading text-lg font-semibold text-text-primary">Average Points Table</h3>
                  </div>
                  <div className="overflow-y-auto max-h-[320px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-text-secondary font-medium">#</th>
                          <th className="text-left py-2 text-text-secondary font-medium">Team</th>
                          <th className="text-right py-2 text-text-secondary font-medium">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.avg_points_table.map((row, i) => (
                          <tr key={row.team} className={`border-b border-border/50 ${row.team === focusTeam ? 'bg-accent/5' : ''}`}>
                            <td className="py-2 text-text-secondary font-mono text-xs">{i + 1}</td>
                            <td className={`py-2 ${row.team === focusTeam ? 'text-accent font-medium' : 'text-text-primary'}`}>
                              {row.team}
                            </td>
                            <td className={`py-2 text-right font-mono ${row.team === focusTeam ? 'text-accent' : 'text-text-primary'}`}>
                              {row.avg_points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-text-secondary">
                Based on {result.n_simulations.toLocaleString()} Monte Carlo simulated seasons
              </div>
            </>
          ) : (
            <div className="glass-panel p-12 text-center h-full flex flex-col items-center justify-center">
              <Calendar className="w-16 h-16 text-muted mb-4" />
              <p className="text-text-secondary text-sm">Select a target season year and team, then run the projection</p>
              <p className="text-text-secondary text-xs mt-2">Team strengths are projected forward using ELO decay and recent form</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
