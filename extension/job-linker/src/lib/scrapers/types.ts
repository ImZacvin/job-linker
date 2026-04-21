export type JobPlatform = "linkedin" | "seek" | "glints"

export interface ScrapedJob {
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
  url: string
  raw_data?: Record<string, unknown>
}

export interface ScrapeMessage {
  type: "SCRAPE_JOB"
}

export interface ScrapeResponse {
  success: boolean
  jobs?: ScrapedJob[]
  error?: string
}
