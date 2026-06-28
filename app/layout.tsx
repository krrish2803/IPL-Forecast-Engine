import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IPL Forecast Engine — Pre-Match Win Probability & Season Simulation',
  description: 'A portfolio-grade machine learning application that predicts IPL match winners, runs 1000+ season simulations, and provides explainable predictions through ELO ratings and engineered features.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <span className="text-accent font-heading font-bold text-sm">IPL</span>
              </div>
              <span className="font-heading font-semibold text-text-primary hidden sm:block">
                Forecast Engine
              </span>
            </a>
            <div className="flex items-center gap-1">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/predict">Predict</NavLink>
              <NavLink href="/season-predict">Season</NavLink>
              <NavLink href="/simulate">Simulate</NavLink>
              <NavLink href="/setup">Setup</NavLink>
              <NavLink href="/methodology">Methodology</NavLink>
            </div>
          </div>
        </nav>
        <main className="pt-16">
          {children}
        </main>
      </body>
    </html>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-2 text-sm text-text-secondary hover:text-accent transition-colors rounded-lg hover:bg-surface"
    >
      {children}
    </a>
  )
}
