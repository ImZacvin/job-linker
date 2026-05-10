import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { CheckCircle2, Download, FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchCvFile, uploadCv } from "@/lib/api"
import type { Cv } from "@/types/match"

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

interface CvSummaryCardProps {
  cv: Cv | null
  loading: boolean
  onUploaded: (cv: Cv) => void
}

export default function CvSummaryCard({ cv, loading, onUploaded }: CvSummaryCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewedCvIdRef = useRef<number | null>(null)

  // Revoke blob URL on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Invalidate cached preview when the active CV changes (e.g. after replacement).
  useEffect(() => {
    if (cv && previewedCvIdRef.current !== null && previewedCvIdRef.current !== cv.id) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      previewedCvIdRef.current = null
    }
  }, [cv, previewUrl])

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const next = await uploadCv(file)
      onUploaded(next)
      toast.success("CV uploaded — embedding in progress…")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function openFilePicker() {
    if (uploading) return
    inputRef.current?.click()
  }

  async function openPreview() {
    if (!cv) return
    setPreviewOpen(true)
    setPreviewError(null)
    if (previewUrl && previewedCvIdRef.current === cv.id) return
    setPreviewLoading(true)
    try {
      const blob = await fetchCvFile(cv.id)
      setPreviewUrl(URL.createObjectURL(blob))
      previewedCvIdRef.current = cv.id
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load file")
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full min-h-[224px] border rounded-lg p-4 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading CV…
      </div>
    )
  }

  const hidden = (
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
  )

  if (!cv) {
    return (
      <button
        type="button"
        onClick={openFilePicker}
        disabled={uploading}
        className="h-full min-h-[224px] w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-60 transition-colors">
        {uploading ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm font-medium">Uploading…</p>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7" />
            <p className="text-sm font-medium">No CV uploaded</p>
            <p className="text-xs">Click to add one — required for match scoring</p>
          </>
        )}
        {hidden}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        disabled={uploading}
        className="h-full min-h-[112px] w-full text-left border rounded-lg p-4 flex items-start gap-3 hover:border-foreground/60 disabled:opacity-60 transition-colors">
        <FileText className="h-10 w-10 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Your CV</p>
          <p className="font-medium truncate">{cv.filename}</p>
          <p className="text-xs text-muted-foreground">
            {cv.text_length.toLocaleString()} chars · uploaded{" "}
            {new Date(cv.uploaded_at).toLocaleDateString()}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {uploading ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading…
              </span>
            ) : cv.embedding_status === "pending" ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Embedding…
              </span>
            ) : cv.embedding_status === "done" ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                Ready
              </span>
            ) : cv.embedding_status === "failed" ? (
              <span className="text-red-700">Embedding failed</span>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Click to preview · Manage to replace.</p>
        </div>
        <span
          role="link"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cv">Manage</Link>
          </Button>
        </span>
        {hidden}
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="truncate">{cv.filename}</DialogTitle>
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
              <div className="h-full flex items-center justify-center p-6 text-sm text-red-700 text-center">
                {previewError}
              </div>
            )}
            {!previewLoading && !previewError && previewUrl && (
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
                    Inline preview is only supported for PDF files. Download to view this{" "}
                    {cv.mime_type.includes("word") ? "DOCX" : "file"}.
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
    </>
  )
}
