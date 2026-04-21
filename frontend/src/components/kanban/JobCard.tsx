import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Building2, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Job } from "@/types/job"

interface JobCardProps {
  job: Job
  onClick: () => void
}

const platformColors: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  seek: "bg-pink-100 text-pink-800 hover:bg-pink-100",
  glints: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { type: "job", job },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function handleClick(e: React.MouseEvent) {
    if (isDragging) return
    e.stopPropagation()
    onClick()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="bg-card border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm line-clamp-2 flex-1">{job.title}</h3>
        <Badge className={platformColors[job.platform] || ""} variant="secondary">
          {job.platform}
        </Badge>
      </div>
      {job.company_name && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{job.company_name}</span>
        </div>
      )}
      {job.location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{job.location}</span>
        </div>
      )}
    </div>
  )
}
