import { useRef, useState } from "react"
import { Link } from "react-router"
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { uploadCv } from "@/lib/api"
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
    <button
      type="button"
      onClick={openFilePicker}
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
        <p className="mt-3 text-xs text-muted-foreground">Click anywhere to replace.</p>
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
  )
}
