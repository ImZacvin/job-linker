import type { PlasmoCSConfig } from "plasmo"

import type { ScrapedJob, ScrapeMessage, ScrapeResponse } from "~lib/scrapers/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.jobstreet.com/*",
    "https://*.jobstreet.co.id/*",
    "https://*.jobstreet.com.my/*",
    "https://*.jobstreet.com.sg/*",
    "https://*.jobstreet.com.ph/*"
  ],
  run_at: "document_idle"
}

function normalize(s: string | null | undefined): string | null {
  if (!s) return null
  const v = s.replace(/\s+/g, " ").trim()
  return v || null
}

function firstText(root: ParentNode, selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = root.querySelector<HTMLElement>(sel)
    const v = normalize(el?.innerText ?? el?.textContent)
    if (v) return v
  }
  return null
}

function firstAttr(root: ParentNode, selector: string, attr: string): string | null {
  const el = root.querySelector<HTMLElement>(selector)
  return el ? normalize(el.getAttribute(attr)) : null
}

/**
 * Parse salary text like "Rp4.000.000 – Rp6.000.000 per bulan" into min/max/currency.
 */
function parseSalary(text: string | null): {
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
} {
  if (!text) return { salary_min: null, salary_max: null, salary_currency: null }

  // Detect currency
  let currency: string | null = null
  if (/Rp/i.test(text)) currency = "IDR"
  else if (/RM/i.test(text)) currency = "MYR"
  else if (/\$/.test(text)) currency = "SGD"

  // Extract all numbers (remove dots used as thousands separators)
  const nums = text.match(/[\d.,]+/g)?.map((n) => parseInt(n.replace(/[.,]/g, ""), 10)) ?? []
  const valid = nums.filter((n) => !isNaN(n) && n > 0)

  return {
    salary_min: valid[0] ?? null,
    salary_max: valid[1] ?? null,
    salary_currency: currency
  }
}

/**
 * Extract employment type from aria-label text that contains phrases like
 * "Full time", "Part time", "Kontrak/Temporer", etc.
 */
function extractEmploymentType(card: HTMLElement): string | null {
  // Try aria-label on the card itself first
  const ariaLabel = card.getAttribute("aria-label") ?? ""
  const typeMatch = ariaLabel.match(/(?:Full time|Part time|Contract|Casual|Internship|Kontrak[^,]*|Penuh waktu|Paruh waktu)/i)
  if (typeMatch) return typeMatch[0]

  // Try <p> elements inside the card that mention employment type
  const paras = Array.from(card.querySelectorAll<HTMLElement>("p"))
  for (const p of paras) {
    const t = normalize(p.innerText ?? p.textContent)
    if (!t) continue
    const m = t.match(/(?:Full time|Part time|Contract|Casual|Internship|Kontrak[^,\n]*|Penuh waktu|Paruh waktu)/i)
    if (m) return m[0]
  }

  return null
}

// ─── List page scraping ────────────────────────────────────────────────────────

function scrapeList(): ScrapedJob[] {
  // JobStreet job cards: article[data-testid="job-card"][data-job-id]
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('article[data-testid="job-card"][data-job-id]')
  )

  if (cards.length === 0) return []

  const jobs: ScrapedJob[] = []
  const seen = new Set<string>()

  for (const card of cards) {
    const jobId = card.getAttribute("data-job-id")
    if (!jobId || seen.has(jobId)) continue

    const title = firstText(card, [
      'a[data-automation="jobTitle"]',
      'a[data-testid="job-card-title"]'
    ])
    if (!title) continue

    const company_name = firstText(card, [
      'a[data-automation="jobCompany"]',
      '[data-automation="jobCompany"]'
    ])

    // First location link
    const location = firstText(card, [
      'a[data-automation="jobLocation"]',
      '[data-automation="jobLocation"]'
    ])

    // Salary: try the aria-label first, then inner text of the salary element
    const salaryEl = card.querySelector<HTMLElement>('[data-automation="jobSalary"]')
    const salaryText =
      normalize(salaryEl?.closest("[aria-label]")?.getAttribute("aria-label")) ??
      normalize(salaryEl?.innerText ?? salaryEl?.textContent)
    const { salary_min, salary_max, salary_currency } = parseSalary(salaryText)

    const employment_type = extractEmploymentType(card)

    // Build canonical URL.
    // id.jobstreet.com uses /id/job/<id>; other locales use /job/<id>
    const origin = window.location.origin
    const locale = window.location.pathname.startsWith("/id/") ? "/id" : ""
    const url = `${origin}${locale}/job/${jobId}`

    seen.add(jobId)
    jobs.push({
      platform: "jobstreet",
      external_id: jobId,
      title,
      company_name,
      location,
      description: null,
      salary_min,
      salary_max,
      salary_currency,
      employment_type,
      url,
      raw_data: { source: "list-card", needs_enrichment: true }
    })
  }

  return jobs
}

// ─── Detail page scraping ──────────────────────────────────────────────────────

function scrapeDetailPage(): ScrapedJob[] {
  // Pattern 1: /id/job/123456789 or /job/123456789 (path-based)
  // Pattern 2: /id/jobs?jobId=123456789 (query-param based — used on id.jobstreet.com)
  const pathMatch = window.location.pathname.match(/\/job\/(\d+)/)
  const params = new URLSearchParams(window.location.search)
  const jobId = pathMatch?.[1] ?? params.get("jobId")
  if (!jobId) return []

  const title = firstText(document, [
    'h1[data-automation="job-detail-title"]',
    '[data-automation="job-detail-title"]',
    "h1"
  ])
  if (!title) return []

  const company_name = firstText(document, [
    'span[data-automation="advertiser-name"]',
    '[data-automation="advertiser-name"]',
    'a[data-automation="jobCompany"]'
  ])

  const location = firstText(document, [
    'span[data-automation="job-detail-location"]',
    '[data-automation="job-detail-location"]'
  ])

  // Description — try the job details content area
  const description = firstText(document, [
    '[data-automation="jobAdDetails"]',
    '[data-automation="job-detail-body"]',
    ".job-details-content"
  ])

  // Salary
  const salaryEl = document.querySelector<HTMLElement>('[data-automation="job-detail-salary"]')
  const salaryText = normalize(salaryEl?.innerText ?? salaryEl?.textContent)
  const { salary_min, salary_max, salary_currency } = parseSalary(salaryText)

  // Employment type
  const employment_type = firstText(document, [
    '[data-automation="job-detail-work-type"]',
    '[data-automation="job-detail-classifications"]'
  ])

  const url = window.location.href

  return [
    {
      platform: "jobstreet",
      external_id: jobId,
      title,
      company_name,
      location,
      description,
      salary_min,
      salary_max,
      salary_currency,
      employment_type,
      url,
      raw_data: { source: "detail-page", needs_enrichment: !description }
    }
  ]
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function scrapePage(): ScrapedJob[] {
  const list = scrapeList()
  if (list.length > 0) {
    console.log(`[Job Linker] JobStreet list-mode: scraped ${list.length} cards`)
    return list
  }

  const detail = scrapeDetailPage()
  if (detail.length > 0) {
    console.log(
      `[Job Linker] JobStreet detail-page: id=${detail[0].external_id} desc.len=${detail[0].description?.length ?? 0}`
    )
    return detail
  }

  console.warn(
    `[Job Linker] JobStreet: nothing scraped. URL=${window.location.href}`
  )
  return []
}

chrome.runtime.onMessage.addListener(
  (msg: ScrapeMessage, _sender, sendResponse: (res: ScrapeResponse) => void) => {
    if (msg.type !== "SCRAPE_JOB") return

    try {
      const jobs = scrapePage()
      if (jobs.length === 0) {
        sendResponse({
          success: false,
          error:
            "No JobStreet jobs detected. Open a job search results page or a job detail page, then try again."
        })
        return
      }
      sendResponse({ success: true, jobs })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      })
    }

    return true
  }
)

console.log("[Job Linker] JobStreet scraper loaded")
