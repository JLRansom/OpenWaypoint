'use client'

import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { useStream } from '@/components/StreamProvider'
import { NewProjectModal } from '@/components/NewProjectModal'

export default function ProjectsPage() {
  const { projects, tasks } = useStream()

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dracula-light">Projects</h1>
          <p className="text-sm text-dracula-blue mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NewProjectModal />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-dracula-dark py-24 flex flex-col items-center gap-3 text-center">
          <FolderKanban className="w-10 h-10 text-dracula-dark" />
          <p className="text-dracula-blue text-sm font-medium">No projects yet</p>
          <p className="text-dracula-blue/60 text-xs">Hit &quot;+ New Project&quot; to create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const taskCount = tasks.filter((t) => t.projectId === project.id).length
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-xl border border-dracula-dark bg-dracula-surface p-5 hover:border-dracula-purple/50 hover:bg-dracula-dark/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-base font-semibold text-dracula-light group-hover:text-dracula-purple transition-colors">
                    {project.name}
                  </h2>
                  <span className="rounded-full bg-dracula-dark px-2 py-0.5 text-xs text-dracula-blue shrink-0">
                    {taskCount} task{taskCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {project.description && (
                  <p className="text-sm text-dracula-blue line-clamp-2">{project.description}</p>
                )}
                <p className="text-xs text-dracula-blue/50 mt-3">
                  Open Board →
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
