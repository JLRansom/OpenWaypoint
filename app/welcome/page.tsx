import Link from 'next/link'
import {
  Bot,
  FolderKanban,
  Activity,
  History,
  LayoutDashboard,
  Zap,
} from 'lucide-react'

const features = [
  {
    icon: LayoutDashboard,
    iconColor: 'text-dracula-purple',
    title: 'Agent Dashboard',
    description:
      'Spawn AI agents across five specialisations — researcher, coder, writer, senior-coder, and tester — then monitor their status and output in real time.',
  },
  {
    icon: FolderKanban,
    iconColor: 'text-dracula-cyan',
    title: 'Projects & Kanban',
    description:
      'Organise work into projects and break them down into tasks on a drag-and-drop Kanban board. Assign agents to tasks and track progress at a glance.',
  },
  {
    icon: Activity,
    iconColor: 'text-dracula-green',
    title: 'Real-time Monitoring',
    description:
      'Live Server-Sent Event streams keep every status badge, log line, and event counter up to date without polling — no page refresh required.',
  },
  {
    icon: History,
    iconColor: 'text-dracula-orange',
    title: 'Execution History',
    description:
      'Browse a full audit trail of past agent runs. Filter by agent type or outcome and replay logs to understand exactly what happened and why.',
  },
]

export default function WelcomePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-dracula-purple/15 border border-dracula-purple/30">
          <Bot className="w-7 h-7 text-dracula-purple" />
        </div>
        <h1 className="text-3xl font-bold text-dracula-light">
          Welcome to Agents Galore
        </h1>
        <p className="max-w-xl text-dracula-blue text-base leading-relaxed">
          A real-time dashboard for spawning, directing, and monitoring AI agents
          as they tackle research, code, writing, and testing tasks — all in one place.
        </p>
      </div>

      {/* ── Feature cards ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-dracula-blue/60 px-1">
          What's inside
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, iconColor, title, description }) => (
            <div
              key={title}
              className="bg-dracula-surface border border-dracula-dark rounded-lg p-6 space-y-3 hover:border-dracula-purple/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
                <h3 className="font-semibold text-dracula-light">{title}</h3>
              </div>
              <p className="text-sm text-dracula-blue leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quick-start CTA ───────────────────────────────────── */}
      <section className="bg-dracula-surface border border-dracula-dark rounded-lg p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Zap className="w-4 h-4 text-dracula-purple" />
            <h3 className="font-semibold text-dracula-light">Ready to dive in?</h3>
          </div>
          <p className="text-sm text-dracula-blue">
            Head to the Dashboard to spawn your first agent, or open Projects to
            organise your work.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/projects"
            className="rounded-full font-medium transition-colors text-xs px-3 py-1 bg-dracula-dark text-dracula-blue border border-dracula-dark/80 hover:text-dracula-light hover:border-dracula-purple/40"
          >
            Projects
          </Link>
          <Link
            href="/"
            className="rounded-full font-medium transition-colors text-xs px-3 py-1 bg-dracula-purple text-dracula-darker border border-dracula-purple hover:bg-dracula-purple/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>
    </div>
  )
}
