import type { JobPlatform, ScrapedJob, ScrapeResponse } from "./scrapers/types"

export function detectPlatform(url: string): JobPlatform | null {
  if (url.includes("linkedin.com/jobs")) return "linkedin"
  if (url.includes("seek.com") || url.includes("seek.co.id") || url.includes("seek.co.nz"))
    return "seek"
  if (url.includes("glints.com")) return "glints"
  return null
}

export async function scrapeCurrentTab(): Promise<{
  platform: JobPlatform | null
  jobs: ScrapedJob[]
  error: string | null
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.url || !tab.id) {
    return { platform: null, jobs: [], error: "No active tab" }
  }

  const platform = detectPlatform(tab.url)
  if (!platform) {
    return { platform: null, jobs: [], error: null }
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: "SCRAPE_JOB"
    })) as ScrapeResponse | undefined

    if (!response) {
      return {
        platform,
        jobs: [],
        error: "Scraper not loaded. Refresh the job page and try again."
      }
    }

    if (!response.success || !response.jobs || response.jobs.length === 0) {
      return { platform, jobs: [], error: response.error || "No jobs found" }
    }

    return { platform, jobs: response.jobs, error: null }
  } catch (err) {
    return {
      platform,
      jobs: [],
      error:
        err instanceof Error
          ? `${err.message}. Try refreshing the job page.`
          : "Failed to communicate with the page"
    }
  }
}
