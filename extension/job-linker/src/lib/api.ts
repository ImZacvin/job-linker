import { API_BASE_URL } from "~config"

import type { ScrapedJob } from "./scrapers/types"

const WEB_APP_URL = "http://localhost:5173"

interface TokenData {
  accessToken: string
  refreshToken: string
}

async function getTokensFromCookies(): Promise<TokenData | null> {
  try {
    const [accessCookie, refreshCookie] = await Promise.all([
      chrome.cookies.get({ url: WEB_APP_URL, name: "accessToken" }),
      chrome.cookies.get({ url: WEB_APP_URL, name: "refreshToken" })
    ])

    if (!accessCookie?.value || !refreshCookie?.value) return null

    return {
      accessToken: decodeURIComponent(accessCookie.value),
      refreshToken: decodeURIComponent(refreshCookie.value)
    }
  } catch (err) {
    console.error("[Job Linker] Failed to read cookies:", err)
    return null
  }
}

async function tryRefresh(): Promise<string | null> {
  const tokens = await getTokensFromCookies()
  if (!tokens?.refreshToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken })
    })

    if (!res.ok) return null

    const { data } = await res.json()
    // Update the cookie with the new access token
    await chrome.cookies.set({
      url: WEB_APP_URL,
      name: "accessToken",
      value: encodeURIComponent(data.accessToken),
      path: "/",
      expirationDate: Math.floor(Date.now() / 1000) + 86400 // 1 day
    })
    return data.accessToken
  } catch {
    return null
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const tokens = await getTokensFromCookies()
  if (!tokens?.accessToken) {
    throw new Error("No token")
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens.accessToken}`,
    ...options.headers
  }

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    } else {
      throw new Error("Token expired")
    }
  }

  return res
}

export async function verifyToken(): Promise<boolean> {
  const tokens = await getTokensFromCookies()
  if (!tokens) return false

  try {
    const res = await apiFetch("/auth/verify")
    return res.ok
  } catch {
    return false
  }
}

export async function saveJob(
  job: ScrapedJob
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    const res = await apiFetch("/jobs", {
      method: "POST",
      body: JSON.stringify(job)
    })

    if (res.status === 409) return { success: false, duplicate: true }
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed to save" }))
      return { success: false, error }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error"
    }
  }
}

// For the login form fallback — store tokens as cookies on the web app domain
export async function setTokens(tokens: TokenData): Promise<void> {
  await Promise.all([
    chrome.cookies.set({
      url: WEB_APP_URL,
      name: "accessToken",
      value: encodeURIComponent(tokens.accessToken),
      path: "/",
      expirationDate: Math.floor(Date.now() / 1000) + 86400
    }),
    chrome.cookies.set({
      url: WEB_APP_URL,
      name: "refreshToken",
      value: encodeURIComponent(tokens.refreshToken),
      path: "/",
      expirationDate: Math.floor(Date.now() / 1000) + 604800
    })
  ])
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    chrome.cookies.remove({ url: WEB_APP_URL, name: "accessToken" }),
    chrome.cookies.remove({ url: WEB_APP_URL, name: "refreshToken" })
  ])
}
