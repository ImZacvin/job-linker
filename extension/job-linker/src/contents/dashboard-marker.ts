import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://cvranker.space/*",
    "https://*.cvranker.space/*",
    "http://localhost/*",
    "http://localhost:5173/*",
    "http://localhost:5174/*",
    "http://127.0.0.1/*",
    "http://127.0.0.1:5173/*"
  ],
  run_at: "document_start",
  all_frames: false
}

const version = chrome.runtime.getManifest().version

function mark() {
  if (!document.documentElement) return
  document.documentElement.setAttribute("data-job-linker-installed", version)
}

mark()
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mark, { once: true })
}
