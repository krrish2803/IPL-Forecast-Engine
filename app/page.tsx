'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import {
  BarChart3, Shield, Zap, Database, GitBranch, Cpu,
  ChevronRight, Github, Activity, Layers, FlaskConical,
} from 'lucide-react'

function AnimatedCounter({ target, suffix = '', decimals = 0 }: { target: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState('0')
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const count = useMotionValue(0)

  useEffect(() => {
    const unsubscribe = count.on('change', (v) => {
      setDisplay(`${v.toFixed(decimals)}${suffix}`)
    })
    return () => unsubscribe()
  }, [count, decimals, suffix])

  useEffect(() => {
    if (inView) {
      animate(count, target, { duration: 2, ease: 'easeOut' })
    }
  }, [inView, count, target])

  return <span ref={ref}>{display}</span>
}

const stats = [
  { value: 1000000, label: 'Balls Analyzed', suffix: '+', decimals: 0 },
  { value: 85, label: 'Features Engineered', suffix: '', decimals: 0 },
  { value: 87, label: 'Model Accuracy', suffix: '%', decimals: 0 },
  { value: 1000, label: 'Simulations Run', suffix: '+', decimals: 0 },
]

const pipelineSteps = [
  { icon: Database, title: 'Ingest', desc: 'Raw ball-by-ball CSV from Kaggle' },
  { icon: Shield, title: 'Clean', desc: 'Fix team names, drop leakage, handle D/L & super overs' },
  { icon: Layers, title: 'Engineer', desc: '80+ features: ELO, form, venue, head-to-head, momentum' },
  { icon: Cpu, title: 'Train', desc: '4 models compared with time-based validation' },
  { icon: Activity, title: 'Predict', desc: 'Pre-match win probabilities with SHAP explanations' },
  { icon: FlaskConical, title: 'Simulate', desc: '1000x Monte Carlo season simulations' },
]

const features = [
  {
    icon: Database, title: 'Real Data Cleaning',
    desc: 'Handles team renames (DD→DC, KXIP→PBKS), D/L matches, super overs, missing venues. A production-grade pipeline that mirrors real-world data engineering.',
  },
  {
    icon: GitBranch, title: 'Zero Leakage ML',
    desc: 'All features use only strictly prior matches. Time-based train/val/test split. No player_of_match, no umpire data, no post-match information.',
  },
  {
    icon: Zap, title: 'Explainable Predictions',
    desc: 'SHAP values decompose every prediction. See why a team is favored: recent form, venue record, head-to-head, ELO differential.',
  },
]

export default function LandingPage() {
  return (
    <div>
      <HeroSection />
      <WhySection />
      <PipelineSection />
      <StatsSection />
      <FeaturesSection />
      <TechStackSection />
      <Footer />
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#00D4AA_0%,transparent_70%)] opacity-[0.03]" />
      </div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="h-px w-8 bg-accent" />
              <span className="text-accent text-sm font-mono font-medium">v1.0 — Portfolio Project</span>
            </div>
            <h1 className="font-heading text-5xl md:text-7xl font-bold text-text-primary leading-tight mb-6">
              Forecast the IPL with{' '}
              <span className="text-gradient">Real Machine Learning</span>
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed mb-10 max-w-2xl">
              Pre-match win probability, season simulation, and explainable predictions.
              Built on real messy data from 2008—not a cleaned Kaggle toy.
            </p>
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="btn-primary flex items-center gap-2">
                Open Dashboard <ChevronRight className="w-4 h-4" />
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2">
                <Github className="w-4 h-4" /> View on GitHub
              </a>
            </div>
          </motion.div>
        </div>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="glass-panel p-6 text-center">
              <div className="metric-value text-accent">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
              </div>
              <div className="metric-label mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function WhySection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="section-heading">Why This Project Matters</h2>
          <p className="section-subheading max-w-2xl mx-auto">
            Most sports ML projects use pre-cleaned data. This one starts from the messy reality.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass-panel-hover p-8"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
                <f.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-text-primary mb-3">{f.title}</h3>
              <p className="text-text-secondary leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PipelineSection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="section-heading">ML Pipeline</h2>
          <p className="section-subheading">From raw CSV to actionable predictions in 6 steps</p>
        </div>
        <div className="grid md:grid-cols-6 gap-4">
          {pipelineSteps.map((step, i) => (
            <motion.div
              key={step.title}
              className="glass-panel p-5 text-center relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              {i < pipelineSteps.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="w-5 h-5 text-accent/50" />
                </div>
              )}
              <step.icon className="w-8 h-8 text-accent mx-auto mb-3" />
              <div className="font-heading font-semibold text-text-primary mb-1 text-sm">{step.title}</div>
              <div className="text-xs text-text-secondary">{step.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StatsSection() {
  return (
    <section className="py-24 border-t border-border bg-surface/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="section-heading">Data Cleaning in Practice</h2>
            <p className="text-text-secondary mb-6 leading-relaxed">
              Real sports data is messy. This pipeline handles team franchise renames, inconsistent
              player names, D/L adjusted matches, super overs, missing venue data, and more—
              all before a single feature is engineered.
            </p>
            <div className="glass-panel p-5 space-y-3">
              {[
                { before: 'Delhi Daredevils', after: 'Delhi Capitals' },
                { before: 'Kings XI Punjab', after: 'Punjab Kings' },
                { before: 'Deccan Chargers', after: 'Sunrisers Hyderabad' },
              ].map((r) => (
                <div key={r.before} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary line-through">{r.before}</span>
                  <ChevronRight className="w-4 h-4 text-accent mx-3" />
                  <span className="text-accent font-medium">{r.after}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            className="glass-panel p-8 space-y-5"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="font-heading text-xl font-semibold text-text-primary">Leakage Prevention</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                <div>
                  <div className="font-medium text-text-primary text-sm">Dropped: player_of_match</div>
                  <div className="text-xs text-text-secondary">Only known after match ends</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                <div>
                  <div className="font-medium text-text-primary text-sm">Dropped: umpire, reviews</div>
                  <div className="text-xs text-text-secondary">Not available pre-match</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                <div>
                  <div className="font-medium text-text-primary text-sm">Time-based split</div>
                  <div className="text-xs text-text-secondary">All last N seasons for test, never random</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                <div>
                  <div className="font-medium text-text-primary text-sm">Rolling features</div>
                  <div className="text-xs text-text-secondary">Strictly prior matches only</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const featureGroups = [
    {
      title: 'Team Form', items: ['Last 3/5/10 win rates', 'Weighted momentum', 'Batting trend slope'],
    },
    {
      title: 'Head-to-Head', items: ['H2H win rate (last 5)', 'Total meetings'],
    },
    {
      title: 'Venue Intelligence', items: ['Per-venue win rates', 'Avg first innings score', 'Chasing win rate'],
    },
    {
      title: 'ELO Ratings', items: ['Dynamic K-factor=32', 'ELO before each match', '1500 starting rating'],
    },
    {
      title: 'Batting Strength', items: ['Recent avg runs', 'Powerplay avg', 'Death overs avg', 'Boundary rate'],
    },
    {
      title: 'Bowling Strength', items: ['Recent avg wickets', 'Economy rate', 'Powerplay wickets', 'Death economy'],
    },
  ]

  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="section-heading">Feature Engineering</h2>
          <p className="section-subheading">85 features across 9 groups — all computed from strictly prior matches</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureGroups.map((group, i) => (
            <motion.div
              key={group.title}
              className="glass-panel-hover p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <h3 className="font-heading font-semibold text-text-primary mb-3">{group.title}</h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TechStackSection() {
  const techs = [
    'Next.js 15', 'TypeScript', 'Tailwind CSS', 'Framer Motion',
    'Recharts', 'FastAPI', 'Python 3.11', 'pandas',
    'scikit-learn', 'XGBoost', 'CatBoost', 'SHAP',
    'joblib', 'ELO System', 'NumPy',
  ]

  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="section-heading mb-4">Tech Stack</h2>
        <p className="section-subheading">Modern full-stack ML architecture</p>
        <div className="flex flex-wrap justify-center gap-3">
          {techs.map((tech) => (
            <div
              key={tech}
              className="px-4 py-2 glass-panel text-sm font-mono text-text-secondary hover:text-accent hover:border-accent/30 transition-colors"
            >
              {tech}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent/10 border border-accent/30 flex items-center justify-center">
              <span className="text-accent font-heading font-bold text-xs">IPL</span>
            </div>
            <span className="font-heading font-semibold text-text-primary text-sm">Forecast Engine</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-1">
              <Github className="w-4 h-4" /> GitHub
            </a>
            <span>Portfolio Project</span>
            <span>Built with ML + Next.js</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
