import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchActiveCv, fetchCvFile, uploadCv } from "@/lib/api"
import type { Cv } from "@/types/match"

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const POLL_INTERVAL_MS = 2500

export default function CvUpload() {
  const [cv, setCv] = useState<Cv | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnnouncedStatusRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function openPreview() {
    if (!cv) return
    setPreviewOpen(true)
    setPreviewError(null)
    if (previewUrl) {
      // Already loaded for this CV — reuse.
      return
    }
    setPreviewLoading(true)
    try {
      const blob = await fetchCvFile(cv.id)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load file")
    } finally {
      setPreviewLoading(false)
    }
  }

  function handlePreviewOpenChange(open: boolean) {
    setPreviewOpen(open)
  }

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
      // Invalidate cached preview — it points to the previous file's bytes.
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
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
          <button
            type="button"
            onClick={openPreview}
            className="border rounded-lg p-4 flex items-center gap-3 text-left hover:border-foreground/40 hover:bg-muted/30 transition-colors">
            <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{cv.filename}</p>
              <p className="text-xs text-muted-foreground">
                {cv.text_length.toLocaleString()} chars · uploaded {new Date(cv.uploaded_at).toLocaleDateString()}
                <span className="ml-1">· click to preview</span>
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
          </button>
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

      <Dialog open={previewOpen} onOpenChange={handlePreviewOpenChange}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="truncate">{cv?.filename ?? "CV"}</DialogTitle>
            <DialogDescription>Preview of your uploaded CV.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/20">
            {previewLoading && (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading file…
              </div>
            )}
            {previewError && !previewLoading && (
              <div className="h-full flex items-center justify-center p-6 text-sm text-red-700">
                {previewError}
              </div>
            )}
            {!previewLoading && !previewError && previewUrl && cv && (
              cv.mime_type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  title={cv.filename}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Inline preview is only supported for PDF files. Download to view this {cv.mime_type.includes("word") ? "DOCX" : "file"}.
                  </p>
                  <a
                    href={previewUrl}
                    download={cv.filename}
                    className={buttonVariants({ variant: "default", size: "default" })}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </a>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
