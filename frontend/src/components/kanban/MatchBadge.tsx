import { Link } from "react-router"
import { AlertCircle, Loader2, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface MatchBadgeProps {
  score: number | null | undefined
  status: "pending" | "done" | "failed" | null | undefined
  hasActiveCv: boolean
  embeddingStatus?: "pending" | "done" | "failed" | null
}

function stopDrag(e: React.MouseEvent | React.PointerEvent | React.KeyboardEvent) {
  e.stopPropagation()
}

export default function MatchBadge({
  score,
  status,
  hasActiveCv,
  embeddingStatus,
}: MatchBadgeProps) {
  if (!hasActiveCv) {
    return (
      <Link
        to="/cv"
        onClick={stopDrag}
        onPointerDown={stopDrag}
        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
        <Upload className="h-2.5 w-2.5" />
        Upload CV
      </Link>
    )
  }

  const failed = status === "failed" || embeddingStatus === "failed"
  if (failed) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-normal text-red-700 border-red-300 bg-red-50 gap-1">
        <AlertCircle className="h-2.5 w-2.5" />
        match failed · tap to retry
      </Badge>
    )
  }

  if (!status || status === "pending") {
    return (
      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        matching…
      </Badge>
    )
  }

  if (score === null || score === undefined) return null

  const pct = Math.round(score * 100)
  let color = "bg-red-100 text-red-800 hover:bg-red-100"
  if (pct >= 80) color = "bg-green-100 text-green-800 hover:bg-green-100"
  else if (pct >= 50) color = "bg-amber-100 text-amber-800 hover:bg-amber-100"

  return (
    <Badge className={`text-xs font-semibold px-2 ${color}`} variant="secondary">
      {pct}% fit
    </Badge>
  )
}
