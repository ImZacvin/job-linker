import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { FileText, Sparkles } from "lucide-react"
import { toast } from "sonner"

import CvSummaryCard from "@/components/dashboard/CvSummaryCard"
import MatchThresholdCard, {
  type ThresholdValue,
} from "@/components/dashboard/MatchThresholdCard"
import KanbanBoard from "@/components/kanban/KanbanBoard"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { fetchActiveCv, fetchJobs } from "@/lib/api"
import type { Job } from "@/types/job"
import type { Cv } from "@/types/match"

const JOBS_POLL_MS = 5000
const CV_POLL_MS = 3000

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [cv, setCv] = useState<Cv | null>(null)
  const [cvLoaded, setCvLoaded] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [threshold, setThreshold] = useState<ThresholdValue>(0)
  const jobsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cvTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasActiveCv = Boolean(cv)

  useEffect(() => {
    let cancelled = false

    async function loadCv() {
      try {
        const fresh = await fetchActiveCv()
        if (cancelled) return
        setCv(fresh)
        setCvLoaded(true)

        if (fresh && fresh.embedding_status === "pending") {
          cvTimerRef.current = setTimeout(loadCv, CV_POLL_MS)
        }
      } catch {
        if (!cancelled) setCvLoaded(true)
      }
    }

    loadCv()
    return () => {
      cancelled = true
      if (cvTimerRef.current) clearTimeout(cvTimerRef.current)
    }
  }, [])

  const jobsCancelledRef = useRef(false)

  const loadJobs = useCallback(
    async (initial: boolean) => {
      try {
        const fresh = await fetchJobs()
        if (jobsCancelledRef.current) return
        setJobs(fresh)
        if (initial) setJobsLoading(false)

        const anyPending =
          hasActiveCv &&
          fresh.some((j) => j.match_status === "pending" || j.match_status == null)
        if (jobsTimerRef.current) clearTimeout(jobsTimerRef.current)
        if (anyPending) {
          jobsTimerRef.current = setTimeout(() => loadJobs(false), JOBS_POLL_MS)
        }
      } catch {
        if (!jobsCancelledRef.current) {
          toast.error("Failed to load jobs")
          if (initial) setJobsLoading(false)
        }
      }
    },
    [hasActiveCv]
  )

  useEffect(() => {
    jobsCancelledRef.current = false
    loadJobs(true)
    return () => {
      jobsCancelledRef.current = true
      if (jobsTimerRef.current) clearTimeout(jobsTimerRef.current)
    }
  }, [loadJobs])

  const refreshJobs = useCallback(() => loadJobs(false), [loadJobs])

  const matchedCount = useMemo(() => {
    if (threshold === 0) return jobs.length
    return jobs.filter((j) => (j.match_score ?? -Infinity) >= threshold).length
  }, [jobs, threshold])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto px-6 py-3">
          <h1 className="text-lg font-semibold">Job Linker</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/recommended">
                <Sparkles className="h-4 w-4 mr-1" />
                Recommended
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cv">
                <FileText className="h-4 w-4 mr-1" />
                CV
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground ml-2">{user?.full_name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Application Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Drag jobs between columns to update their status.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-5">
          <CvSummaryCard cv={cv} loading={!cvLoaded} onUploaded={setCv} />
          <MatchThresholdCard
            value={threshold}
            onChange={setThreshold}
            disabled={!hasActiveCv}
            matchedCount={matchedCount}
            totalCount={jobs.length}
          />
        </div>

        {jobsLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading jobs...</p>
          </div>
        ) : (
          <KanbanBoard
            jobs={jobs}
            onJobsChange={setJobs}
            hasActiveCv={hasActiveCv}
            threshold={threshold}
            onRefresh={refreshJobs}
          />
        )}
      </main>
    </div>
  )
}
