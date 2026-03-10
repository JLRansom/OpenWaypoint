'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { useStream } from '@/components/StreamProvider'
import { KanbanColumn } from '@/components/KanbanColumn'
import { BulkActionBar } from '@/components/BulkActionBar'
import { BulkDeleteModal } from '@/components/BulkDeleteModal'
import { TaskStatus, BoardType } from '@/lib/types'

const COLUMNS_BY_TYPE: Record<BoardType, TaskStatus[]> = {
  coding:   ['backlog', 'planning', 'in-progress', 'review', 'testing', 'changes-requested', 'done'],
  research: ['backlog', 'in-progress', 'done'],
  general:  ['backlog', 'in-progress', 'done'],
}

export function KanbanBoard({ projectId, initialCardId, boardType }: { projectId: string; initialCardId?: string; boardType: BoardType }) {
  const { tasks, agents } = useStream()
  const [activeAddColumn, setActiveAddColumn] = useState<TaskStatus | null>(null)
  const [autoOpenCardId, setAutoOpenCardId] = useState<string | undefined>(initialCardId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Clear the ?card= param from the URL after we've consumed it
  useEffect(() => {
    if (initialCardId) {
      router.replace(pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const projectTasks = tasks.filter((t) => t.projectId === projectId && !t.archived)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function bulkFetch(body: object) {
    await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSelectedIds(new Set())
  }

  async function handleBulkArchive() {
    await bulkFetch({ action: 'archive', taskIds: [...selectedIds] })
  }

  async function handleBulkMove(status: string) {
    await bulkFetch({ action: 'move', taskIds: [...selectedIds], status })
  }

  async function handleBulkDelete() {
    setShowDeleteModal(false)
    await bulkFetch({ action: 'delete', taskIds: [...selectedIds] })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const newStatus = over.id as TaskStatus
    const task = projectTasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    const triggerResearcher =
      (boardType === 'coding' && task.status === 'backlog' && newStatus === 'planning') ||
      (boardType === 'research' && task.status === 'backlog' && newStatus === 'in-progress')

    if (triggerResearcher) {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'researcher' }),
      })
      if (!res.ok) {
        // No idle researcher — fall back to manual status move
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      }
      return
    }

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  const columns = COLUMNS_BY_TYPE[boardType]

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-6 min-h-[70vh] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-dracula-darker [&::-webkit-scrollbar-thumb]:bg-dracula-dark [&::-webkit-scrollbar-thumb]:rounded-full">
          <div className="flex gap-3 w-full items-start">
            {columns.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={projectTasks.filter((t) => t.status === status)}
                agents={agents}
                projectId={projectId}
                boardType={boardType}
                isAddActive={activeAddColumn === status}
                onAddActivate={() => setActiveAddColumn(status)}
                onAddDeactivate={() => setActiveAddColumn(null)}
                autoOpenCardId={autoOpenCardId}
                onAutoOpenConsumed={() => setAutoOpenCardId(undefined)}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </div>
      </DndContext>

      <BulkActionBar
        selectedIds={selectedIds}
        boardType={boardType}
        onArchive={handleBulkArchive}
        onMove={handleBulkMove}
        onDelete={() => setShowDeleteModal(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      {showDeleteModal && (
        <BulkDeleteModal
          count={selectedIds.size}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  )
}
