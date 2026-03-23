import React, { useEffect, useState } from "react"

import { apiFetch } from "~lib/api"

interface Job {
  id: number
  title: string
  company_name: string
  platform: string
  status: string
  url: string
  created_at: string
}

interface Props {
  onAuthError: () => void
}

const STATUS_COLORS: Record<string, string> = {
  saved: "#6b7280",
  applied: "#3b82f6",
  interview: "#f59e0b",
  offered: "#10b981",
  rejected: "#ef4444"
}

export default function SavedJobs({ onAuthError }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    fetchJobs()
  }, [filter])

  async function fetchJobs() {
    try {
      setLoading(true)
      const query = filter ? `?status=${filter}` : ""
      const res = await apiFetch(`/jobs${query}`)
      const { data } = await res.json()
      setJobs(data)
    } catch (err) {
      if (err.message === "Token expired" || err.message === "No token") {
        onAuthError()
      }
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(jobId: number, status: string) {
    try {
      await apiFetch(`/jobs/${jobId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      })
      await fetchJobs()
    } catch (err) {
      if (err.message === "Token expired" || err.message === "No token") {
        onAuthError()
      }
    }
  }

  if (loading) {
    return <div className="loading">Loading jobs...</div>
  }

  return (
    <div className="saved-jobs">
      <div className="filter-bar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="saved">Saved</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offered">Offered</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {jobs.length === 0 ? (
        <p className="empty">No jobs found</p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id} className="job-item">
              <div className="job-info">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="job-title">
                  {job.title}
                </a>
                <span className="job-company">{job.company_name}</span>
                <div className="job-meta">
                  <span className="platform-badge">{job.platform}</span>
                  <select
                    value={job.status}
                    onChange={(e) => updateStatus(job.id, e.target.value)}
                    className="status-select"
                    style={{
                      color: STATUS_COLORS[job.status] || "#6b7280"
                    }}>
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="interview">Interview</option>
                    <option value="offered">Offered</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
