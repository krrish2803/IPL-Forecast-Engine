'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { FlaskConical, Upload, Loader2, Trophy, Target, Table2 } from 'lucide-react'
import { simulateSeason } from '@/lib/api'
import type { SimulateResponse } from '@/lib/types'

export default function SimulatePage() {
  const [useDemo, setUseDemo] = useState(true)
  const [nSimulations, setNSimulations] = useState(1000)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SimulateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSimulate = async () => {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await simulateSeason({
        use_demo: useDemo,
        n_simulations: nSimulations,
      })
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Simulation failed')
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
        <h1 className="font-heading text-3xl font-bold text-text-primary">Season Simulator</h1>
        <p className="text-text-secondary mt-1">Monte Carlo simulation using trained model predictions</p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        <motion.div className="glass-panel p-6 space-y-5 lg:col-span-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="font-heading text-lg font-semibold text-text-primary">Simulation Settings</h2>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Fixture Source</label>
            <div className="flex gap-3">
              <button
                onClick={() => setUseDemo(true)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  useDemo ? 'bg-accent text-background border-accent' : 'border-border text-text-secondary hover:border-accent/50'
                }`}
              >
                Demo Round-Robin
              </button>
              <button
                onClick={() => setUseDemo(false)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  !useDemo ? 'bg-accent text-background border-accent' : 'border-border text-text-secondary hover:border-accent/50'
                }`}
              >
                Upload CSV
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Number of Simulations</label>
            <input
              type="number"
              min={100}
              max={10000}
              value={nSimulations}
              onChange={(e) => setNSimulations(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
              className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={handleSimulate}
            disabled={running}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            {running ? `Running ${nSimulations.toLocaleString()} simulations...` : 'Run Simulation'}
          </button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          {!useDemo && (
            <div className="text-xs text-text-secondary space-y-2">
              <p>Upload fixture CSV with columns: match_id, team1, team2, venue, stage</p>
              <input type="file" accept=".csv" className="text-xs text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:bg-surface2 file:text-text-primary hover:file:bg-surface" />
            </div>
          )}
        </motion.div>

        <motion.div className="lg:col-span-2 space-y-6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          {result ? (
            <>
              <div className="glass-panel p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-accent" />
                  <h3 className="font-heading text-lg font-semibold text-text-primary">Title Probabilities</h3>
                </div>
                <div className="space-y-3">
                  {titleData.map((team, i) => {
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
                              <span className="text-sm text-text-primary truncate">{team.team}</span>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-text-secondary">
                                  Top 4: <span className="text-text-primary font-medium">{(team.top4 * 100).toFixed(1)}%</span>
                                </span>
                                <span className="text-sm font-mono font-bold text-accent w-14 text-right">
                                  {team.titlePct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-4 bg-surface2 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  background: 'linear-gradient(90deg, #00D4AA, #00F5C8)',
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
                    <Target className="w-5 h-5 text-accent" />
                    <h3 className="font-heading text-lg font-semibold text-text-primary">Top 4 Probabilities</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={result.top4_probabilities.map(tp => ({ ...tp, probability: tp.probability * 100 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" vertical={false} />
                      <XAxis dataKey="team" stroke="#8B8E96" fontSize={10} angle={-20} textAnchor="end" height={50} />
                      <YAxis domain={[0, 100]} stroke="#8B8E96" fontSize={11} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#13151A', border: '1px solid #2A2D35', borderRadius: '8px' }}
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                      />
                      <Bar dataKey="probability" fill="#4ECDC4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-panel p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Table2 className="w-5 h-5 text-accent" />
                    <h3 className="font-heading text-lg font-semibold text-text-primary">Average Points Table</h3>
                  </div>
                  <div className="overflow-y-auto max-h-[280px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-text-secondary font-medium">#</th>
                          <th className="text-left py-2 text-text-secondary font-medium">Team</th>
                          <th className="text-right py-2 text-text-secondary font-medium">Avg Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.avg_points_table.map((row, i) => (
                          <tr key={row.team} className="border-b border-border/50">
                            <td className="py-2 text-text-secondary font-mono text-xs">{i + 1}</td>
                            <td className="py-2 text-text-primary">{row.team}</td>
                            <td className="py-2 text-right font-mono text-text-primary">{row.avg_points.toFixed(1)}</td>
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
              <FlaskConical className="w-16 h-16 text-muted mb-4" />
              <p className="text-text-secondary text-sm">Configure settings and run a season simulation</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
