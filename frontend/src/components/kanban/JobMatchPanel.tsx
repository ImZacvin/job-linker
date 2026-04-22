import { useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useMatch } from "@/hooks/useMatch"
import { recomputeJobMatch } from "@/lib/api"

interface JobMatchPanelProps {
  jobId: number
}

function scoreColor(pct: number) {
  if (pct >= 80) return "text-green-700"
  if (pct >= 50) return "text-amber-700"
  return "text-red-700"
}

export default function JobMatchPanel({ jobId }: JobMatchPanelProps) {
  const { match, loading, error, setMatch } = useMatch(jobId)
  const [recomputing, setRecomputing] = useState(false)

  async function handleRecompute() {
    setRecomputing(true)
    try {
      await recomputeJobMatch(jobId)
      setMatch((prev) =>
        prev
          ? { ...prev, status: "pending", score: null, summary: null }
          : {
              id: 0,
              job_id: jobId,
              cv_id: 0,
              score: null,
              required_skills: null,
              matched_skills: null,
              missing_skills: null,
              summary: null,
              status: "pending",
              error: null,
              matched_at: new Date().toISOString(),
            }
      )
      toast.success("Match queued — refreshing shortly…")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recompute failed")
    } finally {
      setRecomputing(false)
    }
  }

  if (loading && !match) {
    return <div className="text-sm text-muted-foreground">Loading match…</div>
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>
  }

  if (!match) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          No match yet. Upload a CV first, then compute a match for this job.
        </p>
        <Button size="sm" variant="outline" onClick={handleRecompute} disabled={recomputing}>
          <Sparkles className="h-3 w-3 mr-1" />
          Compute match
        </Button>
      </div>
    )
  }

  if (match.status === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Matching in progress…
      </div>
    )
  }

  if (match.status === "failed") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-600">Match failed: {match.error || "Unknown error"}</p>
        <Button size="sm" variant="outline" onClick={handleRecompute} disabled={recomputing}>
          Retry
        </Button>
      </div>
    )
  }

  const pct = match.score === null ? 0 : Math.round(match.score * 100)
  const llmOk = match.llm_status === "ok"
  const reasoning = match.llm_reasoning || match.summary
  const strengths = llmOk && match.llm_strengths ? match.llm_strengths : []
  const concerns = llmOk && match.llm_concerns ? match.llm_concerns : []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">CV fit</p>
          <p className={`text-3xl font-semibold ${scoreColor(pct)}`}>{pct}%</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRecompute} disabled={recomputing}>
          <RefreshCw className={`h-3 w-3 mr-1 ${recomputing ? "animate-spin" : ""}`} />
          Recompute
        </Button>
      </div>

      {reasoning && (
        <p className="text-sm border-l-2 pl-3 py-1 border-muted-foreground/30 text-muted-foreground italic">
          {reasoning}
        </p>
      )}

      {(strengths.length > 0 || concerns.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {concerns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">Concerns</p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                {concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {match.matched_skills && match.matched_skills.length > 0 && (
        <div>
          <p className="text-xs font-medium text-green-700 mb-1">You have</p>
          <div className="flex flex-wrap gap-1">
            {match.matched_skills.map((s) => (
              <Badge key={s} className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px]" variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {match.missing_skills && match.missing_skills.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-700 mb-1">Skill gaps</p>
          <div className="flex flex-wrap gap-1">
            {match.missing_skills.map((s) => (
              <Badge key={s} className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]" variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {match.llm_status && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {llmOk ? "LLM-verified" : "cosine-only"}
        </p>
      )}
    </div>
  )
}
