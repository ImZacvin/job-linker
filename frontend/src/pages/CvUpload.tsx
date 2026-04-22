import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { ArrowLeft, CheckCircle2, FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { fetchActiveCv, uploadCv } from "@/lib/api"
import type { Cv } from "@/types/match"

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const POLL_INTERVAL_MS = 2500

export default function CvUpload() {
  const [cv, setCv] = useState<Cv | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnnouncedStatusRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(initial: boolean) {
      try {
        const existing = await fetchActiveCv()
        if (cancelled) return

        setCv(existing)

        if (initial) setLoading(false)

        if (existing && existing.embedding_status === "pending") {
          pollTimerRef.current = setTimeout(() => load(false), POLL_INTERVAL_MS)
        } else if (
          existing &&
          existing.embedding_status === "done" &&
          lastAnnouncedStatusRef.current === "pending"
        ) {
          toast.success("CV embedded — matches will start computing")
        } else if (
          existing &&
          existing.embedding_status === "failed" &&
          lastAnnouncedStatusRef.current !== "failed"
        ) {
          toast.error("CV embedding failed — try uploading again")
        }

        if (existing) lastAnnouncedStatusRef.current = existing.embedding_status
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load CV")
        if (initial && !cancelled) setLoading(false)
      }
    }

    load(true)

    return () => {
      cancelled = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const next = await uploadCv(file)
      setCv(next)
      lastAnnouncedStatusRef.current = next.embedding_status
      toast.success("CV uploaded — embedding in progress…")

      if (next.embedding_status === "pending") {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        pollTimerRef.current = setTimeout(async function poll() {
          try {
            const fresh = await fetchActiveCv()
            setCv(fresh)
            if (fresh && fresh.embedding_status === "pending") {
              pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
            } else if (fresh && fresh.embedding_status === "done") {
              toast.success("CV embedded — matches will start computing")
              lastAnnouncedStatusRef.current = "done"
            } else if (fresh && fresh.embedding_status === "failed") {
              toast.error("CV embedding failed — try uploading again")
              lastAnnouncedStatusRef.current = "failed"
            }
          } catch {
            /* swallow poll errors */
          }
        }, POLL_INTERVAL_MS)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const status = cv?.embedding_status ?? null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between max-w-[1200px] mx-auto px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <h1 className="text-lg font-semibold">CV</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Your CV</h2>
          <p className="text-sm text-muted-foreground">
            Upload a PDF or DOCX. Replacing your CV re-computes the match score for every saved job.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : cv ? (
          <div className="border rounded-lg p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{cv.filename}</p>
              <p className="text-xs text-muted-foreground">
                {cv.text_length.toLocaleString()} chars · uploaded {new Date(cv.uploaded_at).toLocaleDateString()}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                {status === "pending" && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Embedding in progress…
                  </span>
                )}
                {status === "done" && (
                  <span className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready — matches active
                  </span>
                )}
                {status === "failed" && (
                  <span className="text-red-700">Embedding failed. Try another file.</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No CV uploaded yet.</p>
        )}

        <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            {cv ? "Upload a new CV to replace the current one." : "Drop a PDF or DOCX, or click the button below."}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : cv ? "Replace CV" : "Upload CV"}
          </Button>
        </div>
      </main>
    </div>
  )
}
