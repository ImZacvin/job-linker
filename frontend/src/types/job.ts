export type JobStatus = "saved" | "applied" | "interview" | "offered" | "rejected"

export type JobPlatform = "linkedin" | "seek" | "glints"

export interface Job {
  id: number
  user_id: number
  platform: JobPlatform
  external_id: string | null
  title: string
  company_name: string | null
  location: string | null
  description: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  employment_type: string | null
  url: string | null
  posted_at: string | null
  status: JobStatus
  raw_data: unknown
  created_at: string
  updated_at: string
}

export const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offered", label: "Offered" },
  { value: "rejected", label: "Rejected" },
]
