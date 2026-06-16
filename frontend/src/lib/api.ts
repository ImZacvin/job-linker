import type { Job, JobStatus } from "@/types/job"
import type { Cv, JobMatch } from "@/types/match"

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

function getAccessToken(): string | null {
  return getCookie("accessToken")
}

function getRefreshToken(): string | null {
  return getCookie("refreshToken")
}

export function setTokens(accessToken: string, refreshToken: string) {
  setCookie("accessToken", accessToken, 1)    // 1 day
  setCookie("refreshToken", refreshToken, 7)  // 7 days
}

export function clearTokens() {
  deleteCookie("accessToken")
  deleteCookie("refreshToken")
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      clearTokens()
      return null
    }

    const body = await res.json()
    const data = body?.data ?? body
    if (!data?.accessToken) {
      clearTokens()
      return null
    }
    setCookie("accessToken", data.accessToken, 1)
    return data.accessToken
  } catch {
    clearTokens()
    return null
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    }
  }

  return res
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error || "Login failed")
  }

  const body = await res.json()
  const data = body?.data ?? body
  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error("Login response is missing tokens")
  }
  setTokens(data.accessToken, data.refreshToken)
  return data.user
}

export async function register(email: string, password: string, full_name: string) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  })

  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error || "Registration failed")
  }

  const body = await res.json()
  const data = body?.data ?? body
  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error("Registration response is missing tokens")
  }
  setTokens(data.accessToken, data.refreshToken)
  return data.user
}

export async function verifyToken() {
  const token = getAccessToken()
  if (!token) return null

  const res = await apiFetch("/auth/verify")
  if (!res.ok) return null

  const { data } = await res.json()
  return data.user
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await apiFetch("/jobs")
  if (!res.ok) throw new Error("Failed to fetch jobs")
  const { data } = await res.json()
  return data
}

export async function updateJobStatus(id: number, status: JobStatus): Promise<Job> {
  const res = await apiFetch(`/jobs/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error("Failed to update status")
  const { data } = await res.json()
  return data
}

export async function deleteJob(id: number): Promise<void> {
  const res = await apiFetch(`/jobs/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete job")
}

export async function fetchActiveCv(): Promise<Cv | null> {
  const res = await apiFetch("/cv")
  if (!res.ok) throw new Error("Failed to fetch CV")
  const { data } = await res.json()
  return data
}

export async function uploadCv(file: File): Promise<Cv> {
  const form = new FormData()
  form.append("cv", file)

  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  // Can't use apiFetch: FormData must set its own Content-Type boundary.
  let res = await fetch(`${API_BASE_URL}/cv`, { method: "POST", body: form, headers })
  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`
      res = await fetch(`${API_BASE_URL}/cv`, { method: "POST", body: form, headers })
    }
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Upload failed" }))
    throw new Error(error || "Upload failed")
  }
  const { data } = await res.json()
  return data
}

export async function fetchCvFile(cvId: number): Promise<Blob> {
  const res = await apiFetch(`/cv/${cvId}/file`)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || "Failed to load CV file")
  }
  return res.blob()
}

export async function fetchJobMatch(jobId: number): Promise<JobMatch | null> {
  const res = await apiFetch(`/jobs/${jobId}/match`)
  if (!res.ok) throw new Error("Failed to fetch match")
  const { data } = await res.json()
  return data
}

export async function recomputeJobMatch(jobId: number): Promise<void> {
  const res = await apiFetch(`/jobs/${jobId}/match/recompute`, { method: "POST" })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Recompute failed" }))
    throw new Error(error || "Recompute failed")
  }
}
