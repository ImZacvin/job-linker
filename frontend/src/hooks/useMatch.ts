import { useEffect, useRef, useState } from "react"

import { fetchJobMatch } from "@/lib/api"
import type { JobMatch } from "@/types/match"

const POLL_INTERVAL_MS = 3000

export function useMatch(jobId: number | null) {
  const [match, setMatch] = useState<JobMatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!jobId) {
      setMatch(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const m = await fetchJobMatch(jobId as number)
        if (cancelled) return
        setMatch(m)
        setLoading(false)

        if (m && m.status === "pending") {
          timerRef.current = setTimeout(load, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Unknown error")
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [jobId])

  return { match, loading, error, setMatch }
}
