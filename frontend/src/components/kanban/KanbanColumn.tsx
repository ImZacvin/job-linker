import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"

import JobCard from "@/components/kanban/JobCard"
import type { Job, JobStatus } from "@/types/job"

interface KanbanColumnProps {
  status: JobStatus
  title: string
  jobs: Job[]
  onJobClick: (job: Job) => void
}

export default function KanbanColumn({ status, title, jobs, onJobClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  })

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] bg-muted/40 rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="text-xs text-muted-foreground bg-background rounded px-2 py-0.5">
          {jobs.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 flex flex-col gap-2 min-h-[200px] transition-colors ${
          isOver ? "bg-muted/70" : ""
        }`}>
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onClick={() => onJobClick(job)} />
          ))}
        </SortableContext>
        {jobs.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            Drop jobs here
          </div>
        )}
      </div>
    </div>
  )
}
