export type MatchStatus = "pending" | "done" | "failed"
export type LlmStatus = "ok" | "failed" | "skipped"

export interface JobMatch {
  id: number
  job_id: number
  cv_id: number
  score: number | null
  doc_score?: number | null
  section_score?: number | null
  required_skills: string[] | null
  matched_skills: string[] | null
  missing_skills: string[] | null
  summary: string | null
  llm_score?: number | null
  llm_reasoning?: string | null
  llm_strengths?: string[] | null
  llm_concerns?: string[] | null
  llm_status?: LlmStatus | null
  status: MatchStatus
  error: string | null
  matched_at: string
}

export interface Cv {
  id: number
  user_id: number
  filename: string
  mime_type: string
  weaviate_id: string | null
  is_active: boolean
  embedding_status: "pending" | "done" | "failed"
  uploaded_at: string
  text_length: number
}
