import type { PlasmoCSConfig } from "plasmo"

import type { ScrapedJob, ScrapeMessage, ScrapeResponse } from "~lib/scrapers/types"

export const config: PlasmoCSConfig = {
  matches: ["https://glints.com/*/job/*", "https://glints.com/*/jobs/*"],
  run_at: "document_idle"
}

interface JsonLdJob {
  "@type"?: string
  title?: string
  description?: string
  hiringOrganization?: { name?: string }
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
    | Array<{ address?: { addressLocality?: string } }>
  baseSalary?: {
    currency?: string
    value?: { minValue?: number; maxValue?: number; value?: number }
  }
  employmentType?: string | string[]
  identifier?: { value?: string } | string
}

function text(selector: string): string | null {
  const el = document.querySelector(selector)
  return el?.textContent?.trim() || null
}

function getExternalId(): string | null {
  // Glints URLs: /id/job/XXXXX or /en/job/XXXXX or similar
  const match = window.location.pathname.match(/\/jobs?\/([^/?]+)/)
  return match ? match[1] : null
}

function findJobJsonLd(): JsonLdJob | null {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || "")
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const c of candidates) {
        if (c?.["@type"] === "JobPosting") return c as JsonLdJob
      }
    } catch {
      continue
    }
  }
  return null
}

function extractLocationFromJsonLd(ld: JsonLdJob): string | null {
  const loc = ld.jobLocation
  if (!loc) return null
  const first = Array.isArray(loc) ? loc[0] : loc
  const addr = first?.address
  if (!addr) return null
  return [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ")
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  return tmp.textContent?.trim() || null
}

function scrapeGlints(): ScrapedJob | null {
  const ld = findJobJsonLd()

  if (ld) {
    const title = ld.title || text("h1")
    if (!title) return null

    const baseSalary = ld.baseSalary
    const salary_min = baseSalary?.value?.minValue ?? null
    const salary_max = baseSalary?.value?.maxValue ?? baseSalary?.value?.value ?? null
    const salary_currency = baseSalary?.currency ?? null

    const employmentType = Array.isArray(ld.employmentType)
      ? ld.employmentType.join(", ")
      : ld.employmentType || null

    const identifier = typeof ld.identifier === "string" ? ld.identifier : ld.identifier?.value

    return {
      platform: "glints",
      external_id: identifier || getExternalId(),
      title,
      company_name: ld.hiringOrganization?.name || null,
      location: extractLocationFromJsonLd(ld),
      description: stripHtml(ld.description),
      salary_min,
      salary_max,
      salary_currency,
      employment_type: employmentType,
      url: window.location.href,
      raw_data: { source: "jsonld" }
    }
  }

  // Fallback to DOM scraping if JSON-LD is missing
  const title = text("h1")
  if (!title) return null

  return {
    platform: "glints",
    external_id: getExternalId(),
    title,
    company_name: text('[class*="CompanyName"]') || text('[class*="companyName"]'),
    location: text('[class*="JobLocation"]') || text('[class*="location"]'),
    description: text('[class*="JobDescription"]') || text('[class*="description"]'),
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: text('[class*="JobType"]') || text('[class*="jobType"]'),
    url: window.location.href,
    raw_data: { source: "dom-fallback" }
  }
}

chrome.runtime.onMessage.addListener(
  (msg: ScrapeMessage, _sender, sendResponse: (res: ScrapeResponse) => void) => {
    if (msg.type !== "SCRAPE_JOB") return

    try {
      const job = scrapeGlints()
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

console.log("[Job Linker] Glints scraper loaded")
