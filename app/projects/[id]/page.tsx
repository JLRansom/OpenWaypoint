import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getProject } from '@/lib/store'
import { KanbanBoard } from '@/components/KanbanBoard'

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = getProject(id)

  if (!project) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/projects"
          className="flex items-center gap-1 text-xs text-dracula-blue hover:text-dracula-light mb-2 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          Projects
        </Link>
        <h1 className="text-2xl font-bold text-dracula-light">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-dracula-blue mt-1">{project.description}</p>
        )}
      </div>

      <KanbanBoard projectId={id} />
    </div>
  )
}
