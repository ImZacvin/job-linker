import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import JobCard from "@/components/kanban/JobCard"
import JobDetailSheet from "@/components/kanban/JobDetailSheet"
import KanbanColumn from "@/components/kanban/KanbanColumn"
import { fetchJobs, updateJobStatus } from "@/lib/api"
import { JOB_STATUSES, type Job, type JobStatus } from "@/types/job"

export default function KanbanBoard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetchJobs()
      .then(setJobs)
      .catch(() => toast.error("Failed to load jobs"))
      .finally(() => setLoading(false))
  }, [])

  function handleDragStart(event: DragStartEvent) {
    const job = event.active.data.current?.job as Job | undefined
    if (job) setActiveJob(job)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null)
    const { active, over } = event
    if (!over) return

    const jobId = active.id as number
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return

    // Target can be a column (dropped on empty area) or another job (dropped on a card)
    let targetStatus: JobStatus | null = null
    if (over.data.current?.type === "column") {
      targetStatus = over.data.current.status as JobStatus
    } else if (over.data.current?.type === "job") {
      targetStatus = (over.data.current.job as Job).status
    }

    if (!targetStatus || targetStatus === job.status) return

    // Optimistic update
    const previousJobs = jobs
    setJobs(jobs.map((j) => (j.id === jobId ? { ...j, status: targetStatus! } : j)))

    try {
      await updateJobStatus(jobId, targetStatus)
      toast.success(`Moved to ${targetStatus}`)
    } catch {
      setJobs(previousJobs)
      toast.error("Failed to update status")
    }
  }

  function handleJobClick(job: Job) {
    setSelectedJob(job)
    setSheetOpen(true)
  }

  function handleStatusChange(jobId: number, status: JobStatus) {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)))
    setSelectedJob((prev) => (prev ? { ...prev, status } : null))
  }

  function handleDelete(jobId: number) {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading jobs...</p>
      </div>
    )
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {JOB_STATUSES.map(({ value, label }) => (
            <KanbanColumn
              key={value}
              status={value}
              title={label}
              jobs={jobs.filter((j) => j.status === value)}
              onJobClick={handleJobClick}
            />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? <JobCard job={activeJob} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <JobDetailSheet
        job={selectedJob}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </>
  )
}
