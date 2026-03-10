import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getProject } from '@/lib/store'
import { KanbanBoard } from '@/components/KanbanBoard'
import { ArchivedCards } from '@/components/ArchivedCards'
import { EditProjectModal } from '@/components/EditProjectModal'
import { ProjectViewToggle } from '@/components/ProjectViewToggle'
import { AnalyticsPanel } from '@/components/AnalyticsPanel'

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ card?: string; view?: string }>
}) {
  const { id } = await params
  const { card, view } = await searchParams
  const project = getProject(id)

  if (!project) notFound()

  const activeView = view === 'analytics' ? 'analytics' : 'board'

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/projects"
          className="flex items-center gap-1 text-xs text-dracula-cyan hover:text-dracula-light mb-2 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          Projects
        </Link>
        <p className="text-[11px] font-bold uppercase tracking-widest text-dracula-comment mb-1 mt-2">Project</p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-dracula-light">{project.name}</h1>
          <EditProjectModal project={project} />
        </div>
        {project.description && (
          <div className="mt-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-dracula-comment mb-0.5">Description</p>
            <p className="text-sm text-dracula-comment">{project.description}</p>
          </div>
        )}
      </div>

      <ProjectViewToggle projectId={id} currentView={activeView} />

      {activeView === 'board' && (
        <>
          <KanbanBoard projectId={id} initialCardId={card} boardType={project.boardType ?? 'coding'} />
          <ArchivedCards projectId={id} />
        </>
      )}
      {activeView === 'analytics' && (
        <AnalyticsPanel projectId={id} />
      )}
    </div>
  )
}
