import type { PlasmoCSConfig } from "plasmo"

import type { ScrapedJob, ScrapeMessage, ScrapeResponse } from "~lib/scrapers/types"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*", "https://linkedin.com/jobs/*"],
  run_at: "document_idle"
}

function text(el: ParentNode | null | undefined, selector: string): string | null {
  const target = el?.querySelector(selector)
  return target?.textContent?.trim() || null
}

function firstText(el: ParentNode, selectors: string[]): string | null {
  for (const sel of selectors) {
    const v = text(el, sel)
    if (v) return v
  }
  return null
}

function scrapePage(): ScrapedJob[] {
  console.log("[Job Linker] LinkedIn scraper running")

  // LinkedIn job cards in the search results list
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-job-id], .job-card-container, .jobs-search-results__list-item"
    )
  )

  const jobs: ScrapedJob[] = []
  const seen = new Set<string>()

  for (const card of cards) {
    const external_id =
      card.getAttribute("data-job-id") ||
      card.querySelector<HTMLElement>("[data-job-id]")?.getAttribute("data-job-id") ||
      null

    if (external_id && seen.has(external_id)) continue
    if (external_id) seen.add(external_id)

    const title = firstText(card, [
      ".job-card-list__title--link",
      ".job-card-list__title",
      "a.job-card-container__link",
      ".job-card-container__link strong",
      ".artdeco-entity-lockup__title a"
    ])
    if (!title) continue

    const company_name = firstText(card, [
      ".artdeco-entity-lockup__subtitle",
      ".job-card-container__primary-description",
      ".job-card-container__company-name"
    ])

    const location = firstText(card, [
      ".job-card-container__metadata-wrapper li",
      ".artdeco-entity-lockup__caption",
      ".job-card-container__metadata-item"
    ])

    const link = card.querySelector<HTMLAnchorElement>("a.job-card-container__link, a[href*='/jobs/view/']")
    const url = link
      ? new URL(link.getAttribute("href") || "", window.location.origin).href
      : external_id
        ? `https://www.linkedin.com/jobs/view/${external_id}`
        : window.location.href

    jobs.push({
      platform: "linkedin",
      external_id,
      title: title.replace(/\n.*$/s, "").trim(),
      company_name,
      location,
      description: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: null,
      url
    })
  }

  // Fallback: single job detail view (when user is on /jobs/view/<id>)
  if (jobs.length === 0) {
    const title =
      text(document, ".job-details-jobs-unified-top-card__job-title h1") ||
      text(document, ".job-details-jobs-unified-top-card__job-title") ||
      text(document, "h1")

    if (title) {
      const urlMatch = window.location.pathname.match(/\/jobs\/view\/(\d+)/)
      const params = new URLSearchParams(window.location.search)
      const external_id = urlMatch?.[1] || params.get("currentJobId") || null

      jobs.push({
        platform: "linkedin",
        external_id,
        title,
        company_name:
          text(document, ".job-details-jobs-unified-top-card__company-name a") ||
          text(document, ".job-details-jobs-unified-top-card__company-name"),
        location: document
          .querySelector(".job-details-jobs-unified-top-card__primary-description-container .tvm__text")
          ?.textContent?.trim() || null,
        description: text(document, "#job-details"),
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        employment_type: null,
        url: window.location.href
      })
    }
  }

  return jobs
}

chrome.runtime.onMessage.addListener(
  (msg: ScrapeMessage, _sender, sendResponse: (res: ScrapeResponse) => void) => {
    if (msg.type !== "SCRAPE_JOB") return

    try {
      const jobs = scrapePage()
      if (jobs.length === 0) {
        sendResponse({ success: false, error: "No jobs found on this page" })
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

console.log("[Job Linker] LinkedIn scraper loaded")
