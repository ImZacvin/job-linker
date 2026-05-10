import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { ArrowLeft, ArrowRight, Building2, ExternalLink, MapPin, RefreshCw, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"

import JobDetailSheet from "@/components/kanban/JobDetailSheet"
import MatchBadge from "@/components/kanban/MatchBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchActiveCv, fetchJobs, updateJobStatus } from "@/lib/api"
import type { Job, JobStatus } from "@/types/job"

const POLL_INTERVAL_MS = 5000

type SortMode = "bestFit" | "newest"

function rank(jobs: Job[], mode: SortMode): Job[] {
  if (mode === "newest") {
    return [...jobs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }
  return [...jobs].sort((a, b) => {
    const as = a.match_score ?? -Infinity
    const bs = b.match_score ?? -Infinity
    if (bs !== as) return bs - as
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

const platformColors: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  seek: "bg-pink-100 text-pink-800 hover:bg-pink-100",
  glints: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
}

export default function Recommended() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [hasActiveCv, setHasActiveCv] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Job | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>("bestFit")
  const [refreshing, setRefreshing] = useState(false)
  const cancelledRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (initial: boolean) => {
    try {
      const [cv, fresh] = await Promise.all([fetchActiveCv(), fetchJobs()])
      if (cancelledRef.current) return
      setHasActiveCv(Boolean(cv))
      setJobs(fresh)
      if (initial) setLoading(false)

      const anyPending =
        cv && fresh.some((j) => j.match_status === "pending" || j.match_status == null)
      if (anyPending) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        pollTimerRef.current = setTimeout(() => load(false), POLL_INTERVAL_MS)
      }
    } catch {
      if (!cancelledRef.current) {
        toast.error("Failed to load recommendations")
        if (initial) setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    load(true)
    return () => {
      cancelledRef.current = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await load(false)
      toast.success("Refreshed")
    } finally {
      setRefreshing(false)
    }
  }

  const ranked = useMemo(() => rank(jobs, sortMode), [jobs, sortMode])

  async function moveToApplied(jobId: number) {
    const prev = jobs
    setJobs((cur) => cur.map((j) => (j.id === jobId ? { ...j, status: "applied" } : j)))
    try {
      await updateJobStatus(jobId, "applied")
      toast.success("Moved to Applied")
    } catch {
      setJobs(prev)
      toast.error("Failed to update status")
    }
  }

  function handleStatusChange(jobId: number, status: JobStatus) {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)))
    setSelected((prev) => (prev ? { ...prev, status } : null))
  }

  function handleDelete(jobId: number) {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between max-w-[1200px] mx-auto px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <h1 className="text-lg font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Recommended
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 py-8 flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Best-fit jobs for your CV</h2>
          <p className="text-sm text-muted-foreground">
            Ranked by match score. Click a row to see the skill gap, or jump straight to the listing.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => setSortMode("bestFit")}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                sortMode === "bestFit"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              Best fit
            </button>
            <button
              type="button"
              onClick={() => setSortMode("newest")}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                sortMode === "newest"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              Newest
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !hasActiveCv ? (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-6 flex items-center gap-4">
            <Upload className="h-6 w-6 text-amber-700" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Upload a CV to see recommendations</p>
              <p className="text-sm text-amber-800">
                Without a CV we can't score any of your saved jobs.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to="/cv">Upload CV</Link>
            </Button>
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved jobs yet — save some via the extension.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ranked.map((job) => (
              <li
                key={job.id}
                className="border rounded-lg p-4 flex flex-wrap items-start gap-4 hover:border-foreground/40 transition-colors">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-start gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(job)
                        setSheetOpen(true)
                      }}
                      className="text-left font-medium leading-tight hover:underline">
                      {job.title}
                    </button>
                    <Badge className={platformColors[job.platform] || ""} variant="secondary">
                      {job.platform}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {job.company_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {job.company_name}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    <span>status: {job.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <MatchBadge
                    score={job.match_score}
                    status={job.match_status}
                    hasActiveCv={hasActiveCv}
                    embeddingStatus={job.embedding_status}
                  />
                  {job.url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </a>
                    </Button>
                  )}
                  {job.status === "saved" && (
                    <Button size="sm" variant="outline" onClick={() => moveToApplied(job.id)}>
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Mark applied
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <JobDetailSheet
        job={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </div>
  )
}
