'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Area, AreaChart,
} from 'recharts'
import { motion } from 'framer-motion'
import { Activity, BarChart3, Trophy, Shield, TrendingUp, Target } from 'lucide-react'
import { getMetrics, getDataQuality, getFeatureImportance } from '@/lib/api'
import type { TrainingMetrics, CleaningReport, FeatureImportance } from '@/lib/types'
import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-surface2 rounded-lg animate-pulse', className)} />
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null)
  const [quality, setQuality] = useState<CleaningReport | null>(null)
  const [importance, setImportance] = useState<FeatureImportance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getMetrics().catch(() => null),
      getDataQuality().catch(() => null),
      getFeatureImportance().catch(() => null),
    ]).then(([m, q, i]) => {
      if (m) setMetrics(m)
      if (q) setQuality(q)
      if (i) setImportance(i.features || [])
      if (!m && !q && !i) setError('No data found. Train the model first on /setup.')
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState message={error} />

  const bestModelName = metrics?.best_model || ''
  const bestModelData = metrics?.models?.[bestModelName]

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Model performance, data quality, and feature analysis</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={Trophy} label="Matches" value={quality?.unique_matches || 0} />
        <StatCard icon={Shield} label="Teams" value={quality?.unique_teams?.length || 0} />
        <StatCard icon={TrendingUp} label="Seasons" value={quality?.seasons?.length || 0} />
        <StatCard icon={LayersIcon} label="Features" value={85} />
        <StatCard icon={Activity} label="Best AUC" value={metrics?.best_model_auc || 0} format="percent" />
        <StatCard icon={Target} label="Best Model" value={bestModelName} format="text" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <ModelLeaderboard metrics={metrics} />
        <CalibrationCurve metrics={metrics} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <ROCCurve metrics={metrics} />
        <FeatureImportanceChart data={importance} />
      </div>

      <MetricsTable metrics={metrics} />
    </div>
  )
}

function StatCard({ icon: Icon, label, value, format }: {
  icon: React.ElementType; label: string; value: number | string; format?: 'number' | 'percent' | 'text'
}) {
  const display = format === 'percent'
    ? `${(Number(value) * 100).toFixed(1)}%`
    : format === 'text'
    ? value
    : Number(value).toLocaleString()

  return (
    <motion.div className="glass-panel-hover p-4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-accent" />
        <span className="text-xs text-text-secondary font-medium">{label}</span>
      </div>
      <div className="font-heading text-xl font-bold text-text-primary">{display}</div>
    </motion.div>
  )
}

function LayersIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

function ModelLeaderboard({ metrics }: { metrics: TrainingMetrics | null }) {
  if (!metrics) return null
  const models = Object.values(metrics.models || {})
  const sorted = [...models].sort((a, b) => b.roc_auc - a.roc_auc)

  return (
    <div className="glass-panel p-6">
      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Model Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 text-text-secondary font-medium">Model</th>
              <th className="text-right py-3 text-text-secondary font-medium">Accuracy</th>
              <th className="text-right py-3 text-text-secondary font-medium">AUC</th>
              <th className="text-right py-3 text-text-secondary font-medium">F1</th>
              <th className="text-right py-3 text-text-secondary font-medium">Log Loss</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr key={m.model} className={cn(
                'border-b border-border/50',
                i === 0 && 'bg-accent/5'
              )}>
                <td className="py-3">
                  <span className={cn(
                    'font-medium',
                    i === 0 ? 'text-accent' : 'text-text-primary'
                  )}>
                    {m.model} {i === 0 && '(best)'}
                  </span>
                </td>
                <td className="text-right font-mono text-text-primary">{m.accuracy.toFixed(3)}</td>
                <td className="text-right font-mono text-text-primary">{m.roc_auc.toFixed(3)}</td>
                <td className="text-right font-mono text-text-primary">{m.f1.toFixed(3)}</td>
                <td className="text-right font-mono text-text-primary">{m.log_loss.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {metrics.test_metrics && (
        <div className="mt-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
          <span className="text-xs text-accent font-medium">Test Set ({metrics.best_model}): </span>
          <span className="text-xs text-text-secondary">
            AUC {metrics.test_metrics.roc_auc.toFixed(3)} | Accuracy {metrics.test_metrics.accuracy.toFixed(3)} | F1 {metrics.test_metrics.f1.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  )
}

function CalibrationCurve({ metrics }: { metrics: TrainingMetrics | null }) {
  if (!metrics) return null
  const models = Object.values(metrics.models || {})

  return (
    <div className="glass-panel p-6">
      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Calibration Curves</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" />
          <XAxis dataKey="x" stroke="#8B8E96" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} />
          <YAxis domain={[0, 1]} stroke="#8B8E96" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <Tooltip
            contentStyle={{ background: '#13151A', border: '1px solid #2A2D35', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
          />
          <Line data={[
            { x: 0, perfect: 0 }, { x: 0.2, perfect: 0.2 }, { x: 0.4, perfect: 0.4 },
            { x: 0.6, perfect: 0.6 }, { x: 0.8, perfect: 0.8 }, { x: 1, perfect: 1 },
          ]} type="monotone" dataKey="perfect" stroke="#2A2D35" strokeDasharray="5 5" dot={false} name="Perfect" />
          {models.map((m, i) => {
            const cal = m.calibration
            const data = cal.calibration_x.map((x, j) => ({ x, [m.model]: cal.calibration_y[j] }))
            const colors = ['#00D4AA', '#FF6B6B', '#4ECDC4', '#FFE66D']
            return (
              <Line key={m.model} data={data} type="monotone" dataKey={m.model} stroke={colors[i % 4]} dot={false} name={m.model} strokeWidth={2} />
            )
          })}
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ROCCurve({ metrics }: { metrics: TrainingMetrics | null }) {
  if (!metrics) return null
  const models = Object.values(metrics.models || {})

  return (
    <div className="glass-panel p-6">
      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">ROC Curves</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" />
          <XAxis dataKey="fpr" stroke="#8B8E96" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <YAxis domain={[0, 1]} stroke="#8B8E96" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <Tooltip
            contentStyle={{ background: '#13151A', border: '1px solid #2A2D35', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
          />
          <Line data={[{ fpr: 0, random: 0 }, { fpr: 1, random: 1 }]} type="monotone" dataKey="random" stroke="#2A2D35" strokeDasharray="5 5" dot={false} name="Random" />
          {models.map((m, i) => {
            const rc = m.roc_curve
            const data = rc.fpr.map((fpr, j) => ({ fpr, [m.model]: rc.tpr[j] }))
            const colors = ['#00D4AA', '#FF6B6B', '#4ECDC4', '#FFE66D']
            return (
              <Line key={m.model} data={data} type="monotone" dataKey={m.model} stroke={colors[i % 4]} dot={false} name={`${m.model} (${m.roc_auc.toFixed(3)})`} strokeWidth={2} />
            )
          })}
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function FeatureImportanceChart({ data }: { data: FeatureImportance[] }) {
  const top15 = data.slice(0, 15).reverse()

  return (
    <div className="glass-panel p-6">
      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Top 15 Features by Importance</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={top15} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 150 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D35" horizontal={false} />
          <XAxis type="number" stroke="#8B8E96" fontSize={12} />
          <YAxis type="category" dataKey="feature" stroke="#8B8E96" fontSize={11} width={140} />
          <Tooltip
            contentStyle={{ background: '#13151A', border: '1px solid #2A2D35', borderRadius: '8px', fontSize: '12px' }}
          />
          <Bar dataKey="importance" fill="#00D4AA" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function MetricsTable({ metrics }: { metrics: TrainingMetrics | null }) {
  if (!metrics) return null
  const models = Object.values(metrics.models || {})

  return (
    <div className="glass-panel p-6">
      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Full Metrics Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 text-text-secondary font-medium">Metric</th>
              {models.map((m) => <th key={m.model} className="text-right py-3 text-text-secondary font-medium">{m.model}</th>)}
            </tr>
          </thead>
          <tbody>
            {['accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'log_loss'].map((metric) => (
              <tr key={metric} className="border-b border-border/50">
                <td className="py-3 text-text-primary font-medium capitalize">{metric.replace('_', ' ')}</td>
                {models.map((m) => {
                  const val = (m as any)[metric]
                  const isBest = metric === 'roc_auc' && val === Math.max(...models.map(x => x.roc_auc))
                  return (
                    <td key={m.model} className={cn(
                      'text-right font-mono',
                      isBest ? 'text-accent' : 'text-text-primary'
                    )}>
                      {val.toFixed ? val.toFixed(4) : val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96 mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-8">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid lg:grid-cols-2 gap-8">
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="glass-panel p-12 text-center">
        <Activity className="w-12 h-12 text-muted mx-auto mb-4" />
        <h2 className="font-heading text-2xl font-bold text-text-primary mb-2">No Data Available</h2>
        <p className="text-text-secondary mb-6">{message}</p>
        <a href="/setup" className="btn-primary">Go to Setup</a>
      </div>
    </div>
  )
}
