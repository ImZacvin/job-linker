import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import JobCard from "@/components/kanban/JobCard"
import JobDetailSheet from "@/components/kanban/JobDetailSheet"
import KanbanColumn from "@/components/kanban/KanbanColumn"
import { Button } from "@/components/ui/button"
import { updateJobStatus } from "@/lib/api"
import { JOB_STATUSES, type Job, type JobStatus } from "@/types/job"

type SortMode = "newest" | "bestFit"

interface KanbanBoardProps {
  jobs: Job[]
  onJobsChange: (updater: (prev: Job[]) => Job[]) => void
  hasActiveCv: boolean
  threshold: number
}

function sortJobs(jobs: Job[], mode: SortMode): Job[] {
  if (mode === "bestFit") {
    return [...jobs].sort((a, b) => {
      const as = a.match_score ?? -Infinity
      const bs = b.match_score ?? -Infinity
      if (bs !== as) return bs - as
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }
  return [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export default function KanbanBoard({
  jobs,
  onJobsChange,
  hasActiveCv,
  threshold,
}: KanbanBoardProps) {
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>("newest")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { pendingCount, doneCount } = useMemo(() => {
    let pending = 0
    let done = 0
    for (const j of jobs) {
      if (j.match_status === "pending") pending++
      else if (j.match_status === "done") done++
    }
    return { pendingCount: pending, doneCount: done }
  }, [jobs])

  const visibleJobs = useMemo(() => {
    if (threshold === 0) return jobs
    return jobs.filter((j) => (j.match_score ?? -Infinity) >= threshold)
  }, [jobs, threshold])

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

    let targetStatus: JobStatus | null = null
    if (over.data.current?.type === "column") {
      targetStatus = over.data.current.status as JobStatus
    } else if (over.data.current?.type === "job") {
      targetStatus = (over.data.current.job as Job).status
    }

    if (!targetStatus || targetStatus === job.status) return

    onJobsChange((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: targetStatus! } : j))
    )

    try {
      await updateJobStatus(jobId, targetStatus)
      toast.success(`Moved to ${targetStatus}`)
    } catch {
      onJobsChange((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: job.status } : j))
      )
      toast.error("Failed to update status")
    }
  }

  function handleJobClick(job: Job) {
    setSelectedJob(job)
    setSheetOpen(true)
  }

  function handleStatusChange(jobId: number, status: JobStatus) {
    onJobsChange((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)))
    setSelectedJob((prev) => (prev ? { ...prev, status } : null))
  }

  function handleDelete(jobId: number) {
    onJobsChange((prev) => prev.filter((j) => j.id !== jobId))
  }

  const sortedJobs = sortJobs(visibleJobs, sortMode)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <div className="inline-flex rounded-md border overflow-hidden">
            <Button
              type="button"
              size="sm"
              variant={sortMode === "newest" ? "default" : "ghost"}
              className="rounded-none border-0"
              onClick={() => setSortMode("newest")}>
              Newest
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortMode === "bestFit" ? "default" : "ghost"}
              className="rounded-none border-0"
              onClick={() => setSortMode("bestFit")}
              disabled={!hasActiveCv}
              title={hasActiveCv ? "" : "Upload a CV to enable"}>
              Best fit
            </Button>
          </div>
        </div>

        {hasActiveCv && pendingCount > 0 && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Matching {doneCount} of {doneCount + pendingCount} jobs…
          </div>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {JOB_STATUSES.map(({ value, label }) => (
            <KanbanColumn
              key={value}
              status={value}
              title={label}
              jobs={sortedJobs.filter((j) => j.status === value)}
              onJobClick={handleJobClick}
              hasActiveCv={hasActiveCv}
            />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? (
            <JobCard job={activeJob} onClick={() => {}} hasActiveCv={hasActiveCv} />
          ) : null}
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
