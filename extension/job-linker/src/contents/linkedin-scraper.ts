import type { PlasmoCSConfig } from "plasmo"

import type { ScrapedJob, ScrapeMessage, ScrapeResponse } from "~lib/scrapers/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.linkedin.com/jobs/*",
    "https://linkedin.com/jobs/*"
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
    const v = normalize(el?.innerText)
    if (v) return v
  }
  return null
}

function findListContainer(): ParentNode {
  return (
    document.querySelector<HTMLElement>('[data-testid="lazy-column"]') ||
    document.querySelector<HTMLElement>(".scaffold-layout__list") ||
    document.querySelector<HTMLElement>(".jobs-search-results-list") ||
    document.querySelector<HTMLElement>(".jobs-search__results-list") ||
    document
  )
}

function scrapeNewVariant(container: ParentNode, seen: Set<string>): ScrapedJob[] {
  const cards = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[componentkey^="job-card-component-ref-"][role="button"]'
    )
  )

  const jobs: ScrapedJob[] = []
  for (const card of cards) {
    const ck = card.getAttribute("componentkey") || ""
    const idMatch = ck.match(/ref-(\d+)$/)
    if (!idMatch) continue
    const externalId = idMatch[1]
    if (seen.has(externalId)) continue

    const ps = card.querySelectorAll<HTMLElement>("p")
    const title = normalize(
      ps[0]?.querySelector<HTMLElement>('span[aria-hidden="true"]')?.innerText ||
        ps[0]?.innerText
    )
    if (!title) continue

    const company_name = normalize(ps[1]?.innerText)
    const location = normalize(ps[2]?.innerText)
    const imageUrl = card.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? null

    seen.add(externalId)
    jobs.push({
      platform: "linkedin",
      external_id: externalId,
      title,
      company_name,
      location,
      description: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: null,
      url: `https://www.linkedin.com/jobs/view/${externalId}`,
      raw_data: { source: "list-componentkey", needs_enrichment: true, image_url: imageUrl }
    })
  }

  return jobs
}

function scrapeLegacyVariant(container: ParentNode, seen: Set<string>): ScrapedJob[] {
  // Legacy LinkedIn DOM uses <li data-occludable-job-id> wrapping <div data-job-id class="job-card-container">
  const cards = Array.from(
    container.querySelectorAll<HTMLElement>(
      "li[data-occludable-job-id], div[data-job-id].job-card-container"
    )
  )

  const jobs: ScrapedJob[] = []
  for (const card of cards) {
    const externalId =
      card.getAttribute("data-occludable-job-id") ||
      card.getAttribute("data-job-id") ||
      card.querySelector<HTMLElement>("[data-job-id]")?.getAttribute("data-job-id") ||
      ""
    if (!externalId || seen.has(externalId)) continue

    const title =
      firstText(card, [
        ".artdeco-entity-lockup__title a span[aria-hidden='true']",
        ".artdeco-entity-lockup__title a",
        ".artdeco-entity-lockup__title",
        "a.job-card-list__title--link span[aria-hidden='true']",
        "a.job-card-list__title--link",
        ".job-card-list__title",
        "a[href*='/jobs/view/'] span[aria-hidden='true']",
        "a[href*='/jobs/view/']"
      ]) ||
      normalize(
        card
          .querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]')
          ?.getAttribute("aria-label")
          ?.replace(/\s+with verification.*/i, "")
      )
    if (!title) continue

    const company_name = firstText(card, [
      ".artdeco-entity-lockup__subtitle",
      ".job-card-container__primary-description",
      ".job-card-container__company-name"
    ])

    const location = firstText(card, [
      ".artdeco-entity-lockup__caption",
      ".job-card-container__metadata-wrapper li",
      ".job-card-container__metadata-item"
    ])

    const imageUrl =
      card.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? null

    seen.add(externalId)
    jobs.push({
      platform: "linkedin",
      external_id: externalId,
      title,
      company_name,
      location,
      description: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: null,
      url: `https://www.linkedin.com/jobs/view/${externalId}`,
      raw_data: { source: "list-occludable", needs_enrichment: true, image_url: imageUrl }
    })
  }

  return jobs
}

function scrapeList(): ScrapedJob[] {
  const container = findListContainer()
  const seen = new Set<string>()

  const newOnes = scrapeNewVariant(container, seen)
  const legacyOnes = scrapeLegacyVariant(container, seen)
  return [...newOnes, ...legacyOnes]
}

function scrapeDetailPage(): ScrapedJob[] {
  // Used only when the user is on a bare /jobs/view/<id> page with no list.
  const pathMatch = window.location.pathname.match(/\/jobs\/view\/(\d+)/)
  const params = new URLSearchParams(window.location.search)
  const externalId = pathMatch?.[1] || params.get("currentJobId")
  if (!externalId) return []

  const title = firstText(document, [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title",
    ".top-card-layout__title",
    "h1"
  ])
  if (!title) return []

  const company_name = firstText(document, [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    'a[href*="/company/"]'
  ])

  const location = firstText(document, [
    ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
    ".topcard__flavor--bullet"
  ])

  const description = firstText(document, [
    "#job-details .jobs-description-content__text",
    "#job-details",
    ".description__text--rich"
  ])

  return [
    {
      platform: "linkedin",
      external_id: externalId,
      title,
      company_name,
      location,
      description,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: null,
      url: `https://www.linkedin.com/jobs/view/${externalId}`,
      raw_data: { source: "detail-page", needs_enrichment: !description }
    }
  ]
}

function scrapePage(): ScrapedJob[] {
  const list = scrapeList()
  if (list.length > 0) {
    console.log(`[Job Linker] LinkedIn list-mode scraped ${list.length} cards (descriptions null — enrichment will fill)`)
    return list
  }

  const detail = scrapeDetailPage()
  if (detail.length > 0) {
    console.log(
      `[Job Linker] LinkedIn detail-page scraped id=${detail[0].external_id} desc.length=${detail[0].description?.length ?? 0}`
    )
    return detail
  }

  const h1Count = document.querySelectorAll("h1").length
  const sampleClasses = Array.from(document.querySelectorAll<HTMLElement>("[class*='job']"))
    .slice(0, 4)
    .map((el) => el.className.slice(0, 80))
  console.warn(
    `[Job Linker] LinkedIn: nothing scraped (h1s=${h1Count}). URL=${window.location.href}. Sample 'job'-class nodes:`,
    sampleClasses
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
            "No LinkedIn jobs detected. Open a jobs list (e.g. /jobs/search or /jobs/collections) or a /jobs/view/<id> page."
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

console.log("[Job Linker] LinkedIn scraper loaded (list-mode, enrichment-backed)")
