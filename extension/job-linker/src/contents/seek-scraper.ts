import type { PlasmoCSConfig } from "plasmo"

import type { ScrapedJob, ScrapeMessage, ScrapeResponse } from "~lib/scrapers/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.seek.com/job/*",
    "https://www.seek.com.au/job/*",
    "https://www.seek.co.id/job/*",
    "https://www.seek.co.nz/job/*"
  ],
  run_at: "document_idle"
}

function text(selector: string): string | null {
  const el = document.querySelector(selector)
  return el?.textContent?.trim() || null
}

function getExternalId(): string | null {
  const match = window.location.pathname.match(/\/job\/(\d+)/)
  return match ? match[1] : null
}

function parseSalary(str: string | null): {
  min: number | null
  max: number | null
  currency: string | null
} {
  if (!str) return { min: null, max: null, currency: null }

  const currencyMatch = str.match(/(Rp|IDR|AUD|USD|NZD|\$)/i)
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : null

  const numbers = str.match(/[\d,.]+/g)?.map((n) => parseFloat(n.replace(/[,.]/g, ""))) || []

  if (numbers.length >= 2) return { min: numbers[0], max: numbers[1], currency }
  if (numbers.length === 1) return { min: numbers[0], max: null, currency }
  return { min: null, max: null, currency }
}

function scrapeSeek(): ScrapedJob | null {
  const title =
    text('[data-automation="job-detail-title"]') || text("h1")
  if (!title) return null

  const company_name =
    text('[data-automation="advertiser-name"]') ||
    text('[data-automation="job-detail-advertiser"]')

  const location =
    text('[data-automation="job-detail-location"]') ||
    text('[data-automation="job-location"]')

  const description =
    text('[data-automation="jobAdDetails"]') ||
    text('[data-automation="job-detail-description"]')

  const employment_type =
    text('[data-automation="job-detail-work-type"]') ||
    text('[data-automation="job-detail-workType"]')

  const salaryText = text('[data-automation="job-detail-salary"]')
  const { min: salary_min, max: salary_max, currency: salary_currency } = parseSalary(salaryText)

  return {
    platform: "seek",
    external_id: getExternalId(),
    title,
    company_name,
    location,
    description,
    salary_min,
    salary_max,
    salary_currency,
    employment_type,
    url: window.location.href,
    raw_data: { salary_text: salaryText }
  }
}

chrome.runtime.onMessage.addListener(
  (msg: ScrapeMessage, _sender, sendResponse: (res: ScrapeResponse) => void) => {
    if (msg.type !== "SCRAPE_JOB") return

    try {
      const job = scrapeSeek()
      if (!job) {
        sendResponse({ success: false, error: "Could not find job details on page" })
        return
      }
      sendResponse({ success: true, jobs: [job] })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      })
    }
  }
)

console.log("[Job Linker] SEEK scraper loaded")
