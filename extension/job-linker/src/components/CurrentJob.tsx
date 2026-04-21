import React, { useEffect, useState } from "react"

import { apiFetch, saveJob } from "~lib/api"
import { scrapeCurrentTab } from "~lib/scraper"
import type { ScrapedJob } from "~lib/scrapers/types"

type JobSaveState = "idle" | "saving" | "saved" | "duplicate" | "error"

interface JobWithState extends ScrapedJob {
  _state: JobSaveState
  _errorMsg?: string
}

type PageState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "error"; message: string }
  | { kind: "list"; jobs: JobWithState[] }

interface Props {
  onSaved: () => void
}

function keyFor(job: ScrapedJob): string {
  return `${job.platform}:${job.external_id || job.url}`
}

export default function CurrentJob({ onSaved }: Props) {
  const [state, setState] = useState<PageState>({ kind: "loading" })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setState({ kind: "loading" })
    const { platform, jobs, error } = await scrapeCurrentTab()

    if (!platform) {
      setState({ kind: "unsupported" })
      return
    }

    if (error || jobs.length === 0) {
      setState({ kind: "error", message: error || "No jobs found on this page" })
      return
    }

    // Fetch already-saved jobs to mark duplicates
    const savedKeys = new Set<string>()
    try {
      const res = await apiFetch(`/jobs?platform=${platform}`)
      if (res.ok) {
        const { data } = await res.json()
        for (const j of data || []) {
          if (j.external_id) savedKeys.add(`${j.platform}:${j.external_id}`)
        }
      }
    } catch {
      // ignore
    }

    setState({
      kind: "list",
      jobs: jobs.map((j) => ({
        ...j,
        _state: savedKeys.has(keyFor(j)) ? "duplicate" : "idle"
      }))
    })
  }

  async function handleSave(key: string) {
    if (state.kind !== "list") return

    setState({
      ...state,
      jobs: state.jobs.map((j) => (keyFor(j) === key ? { ...j, _state: "saving" } : j))
    })

    const job = state.jobs.find((j) => keyFor(j) === key)
    if (!job) return

    const result = await saveJob(job)

    setState((prev) => {
      if (prev.kind !== "list") return prev
      return {
        ...prev,
        jobs: prev.jobs.map((j) => {
          if (keyFor(j) !== key) return j
          if (result.success) return { ...j, _state: "saved" }
          if (result.duplicate) return { ...j, _state: "duplicate" }
          return { ...j, _state: "error", _errorMsg: result.error }
        })
      }
    })

    if (result.success) onSaved()
  }

  if (state.kind === "loading") {
    return (
      <div className="current-job">
        <div className="current-job-label">Current page</div>
        <div className="current-job-empty">Scanning page...</div>
      </div>
    )
  }

  if (state.kind === "unsupported") {
    return (
      <div className="current-job">
        <div className="current-job-label">Current page</div>
        <div className="current-job-empty">
          Open a LinkedIn, SEEK, or Glints job page to save it
        </div>
      </div>
    )
  }

  if (state.kind === "error") {
    return (
      <div className="current-job">
        <div className="current-job-label">Current page</div>
        <div className="current-job-error">
          {state.message}
          <button className="btn-link" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="current-job">
      <div className="current-job-label">
        Found {state.jobs.length} job{state.jobs.length === 1 ? "" : "s"} on this page
      </div>
      <div className="current-job-list">
        {state.jobs.map((job) => {
          const key = keyFor(job)
          const isSaving = job._state === "saving"
          const isSaved = job._state === "saved" || job._state === "duplicate"
          return (
            <div key={key} className="current-job-card">
              <div className="current-job-header">
                <div className="current-job-title">{job.title}</div>
                <span className={`platform-badge platform-${job.platform}`}>{job.platform}</span>
              </div>
              {job.company_name && <div className="current-job-company">{job.company_name}</div>}
              {job.location && <div className="current-job-location">{job.location}</div>}
              {job._state === "error" && (
                <div className="current-job-err-msg">{job._errorMsg || "Save failed"}</div>
              )}
              {isSaved ? (
                <div className="current-job-saved">
                  ✓ {job._state === "duplicate" ? "Already saved" : "Saved"}
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-full current-job-save"
                  disabled={isSaving}
                  onClick={() => handleSave(key)}>
                  {isSaving ? "Saving..." : "Save to Tracker"}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
