import React, { useEffect, useState } from "react"

import { apiFetch } from "~lib/api"

import SavedJobs from "./SavedJobs"

interface StatusCounts {
  saved: number
  applied: number
  interview: number
  offered: number
  rejected: number
}

interface Props {
  onAuthError: () => void
}

export default function Dashboard({ onAuthError }: Props) {
  const [counts, setCounts] = useState<StatusCounts>({
    saved: 0,
    applied: 0,
    interview: 0,
    offered: 0,
    rejected: 0
  })

  useEffect(() => {
    fetchCounts()
  }, [])

  async function fetchCounts() {
    try {
      const res = await apiFetch("/jobs")
      if (!res.ok) return

      const { data } = await res.json()
      const jobs = data || []

      const statusCounts: StatusCounts = {
        saved: 0,
        applied: 0,
        interview: 0,
        offered: 0,
        rejected: 0
      }

      for (const job of jobs) {
        if (job.status in statusCounts) {
          statusCounts[job.status as keyof StatusCounts]++
        }
      }

      setCounts(statusCounts)
    } catch (err) {
      if (err.message === "Token expired" || err.message === "No token") {
        onAuthError()
      }
    }
  }

  return (
    <div className="dashboard">
      <div className="status-cards">
        <div className="status-card saved">
          <span className="count">{counts.saved}</span>
          <span className="label">Saved</span>
        </div>
        <div className="status-card applied">
          <span className="count">{counts.applied}</span>
          <span className="label">Applied</span>
        </div>
        <div className="status-card interview">
          <span className="count">{counts.interview}</span>
          <span className="label">Interview</span>
        </div>
        <div className="status-card offered">
          <span className="count">{counts.offered}</span>
          <span className="label">Offered</span>
        </div>
        <div className="status-card rejected">
          <span className="count">{counts.rejected}</span>
          <span className="label">Rejected</span>
        </div>
      </div>

      <h3>Recent Jobs</h3>
      <SavedJobs onAuthError={onAuthError} />
    </div>
  )
}
