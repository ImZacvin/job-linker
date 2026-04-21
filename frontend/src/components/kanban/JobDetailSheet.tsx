import { Building2, ExternalLink, MapPin, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { deleteJob as apiDeleteJob, updateJobStatus } from "@/lib/api"
import { JOB_STATUSES, type Job, type JobStatus } from "@/types/job"

interface JobDetailSheetProps {
  job: Job | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange: (jobId: number, status: JobStatus) => void
  onDelete: (jobId: number) => void
}

export default function JobDetailSheet({
  job,
  open,
  onOpenChange,
  onStatusChange,
  onDelete,
}: JobDetailSheetProps) {
  if (!job) return null

  async function handleStatusChange(status: JobStatus) {
    if (!job) return
    try {
      await updateJobStatus(job.id, status)
      onStatusChange(job.id, status)
      toast.success(`Status changed to ${status}`)
    } catch {
      toast.error("Failed to update status")
    }
  }

  async function handleDelete() {
    if (!job) return
    if (!confirm("Delete this job?")) return
    try {
      await apiDeleteJob(job.id)
      onDelete(job.id)
      onOpenChange(false)
      toast.success("Job deleted")
    } catch {
      toast.error("Failed to delete job")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-2">
            <SheetTitle className="flex-1 pr-4">{job.title}</SheetTitle>
            <Badge variant="secondary">{job.platform}</Badge>
          </div>
          <SheetDescription className="flex flex-col gap-1 mt-2">
            {job.company_name && (
              <span className="flex items-center gap-1 text-sm">
                <Building2 className="h-3 w-3" />
                {job.company_name}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-1 text-sm">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Status: {job.status}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {JOB_STATUSES.map((s) => (
                  <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(s.value)}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {job.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </a>
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>

          {job.employment_type && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Employment type</p>
              <p className="text-sm">{job.employment_type}</p>
            </div>
          )}

          {(job.salary_min || job.salary_max) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Salary</p>
              <p className="text-sm">
                {job.salary_currency} {job.salary_min?.toLocaleString() ?? "?"} -{" "}
                {job.salary_max?.toLocaleString() ?? "?"}
              </p>
            </div>
          )}

          {job.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <div className="text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto border rounded p-2 bg-muted/30">
                {job.description}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground">
              Saved {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
