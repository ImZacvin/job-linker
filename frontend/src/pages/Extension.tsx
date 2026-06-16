import { useEffect } from "react"
import { ArrowLeft, CheckCircle2, Chrome, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useExtensionInstalled } from "@/hooks/useExtensionInstalled"

const FIREFOX_ZIP = "/downloads/job-linker-firefox.zip"
const CHROME_ZIP = "/downloads/job-linker-chrome.zip"

// Hard navigation — forces page reload so content scripts get a chance to inject
// the data-job-linker-installed marker (which only runs at document_start).
function hardNavigate(path: string) {
  window.location.href = path
}

export default function Extension() {
  const { checked, installed, version } = useExtensionInstalled()

  useEffect(() => {
    if (installed) {
      const t = window.setTimeout(() => hardNavigate("/dashboard"), 1200)
      return () => window.clearTimeout(t)
    }
  }, [installed])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between max-w-[1200px] mx-auto px-6 py-3">
          <h1 className="text-lg font-semibold">Job Linker</h1>
          <Button variant="ghost" size="sm" onClick={() => hardNavigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to dashboard
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Install the Job Linker extension</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The extension scrapes job listings from LinkedIn, SEEK, and Glints and
            sends them to your dashboard.
          </p>
        </div>

        {checked && installed && (
          <Card className="mb-6 border-green-500/40 bg-green-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="text-sm">
                <span className="font-medium">Extension detected</span>
                {version && (
                  <span className="text-muted-foreground"> — v{version}</span>
                )}
                <span className="text-muted-foreground">
                  . Redirecting to dashboard…
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Chrome className="h-5 w-5" />
                Chrome / Edge / Brave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="outline">
                <a href={CHROME_ZIP} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Chrome build
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-5 w-5" />
                Firefox
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="outline">
                <a href={FIREFOX_ZIP} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Firefox build
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Installation steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-sm">
              <section>
                <h3 className="font-medium mb-2">Chrome / Edge / Brave</h3>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Download and unzip the Chrome build above.</li>
                  <li>
                    Open <code className="px-1 rounded bg-muted">chrome://extensions</code>
                    {" "}
                    (Edge: <code className="px-1 rounded bg-muted">edge://extensions</code>).
                  </li>
                  <li>Enable <span className="font-medium">Developer mode</span> (top right).</li>
                  <li>
                    Click <span className="font-medium">Load unpacked</span> and
                    select the unzipped folder.
                  </li>
                  <li>Pin the Job Linker icon to the toolbar for quick access.</li>
                </ol>
              </section>

              <section>
                <h3 className="font-medium mb-2">Firefox</h3>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Download the Firefox build above (keep it zipped).</li>
                  <li>
                    Open <code className="px-1 rounded bg-muted">about:debugging#/runtime/this-firefox</code>.
                  </li>
                  <li>
                    Click <span className="font-medium">Load Temporary Add-on…</span>{" "}
                    and select the downloaded .zip (or the
                    <code className="px-1 rounded bg-muted">manifest.json</code> inside).
                  </li>
                  <li>
                    Note: temporary add-ons are removed when Firefox restarts.
                    For a permanent install, wait for the signed AMO release.
                  </li>
                </ol>
              </section>

              <section>
                <h3 className="font-medium mb-2">After installing</h3>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Reload this page — detection runs automatically.</li>
                  <li>
                    Open a job posting on LinkedIn / SEEK / Glints, click the
                    Job Linker icon, then <span className="font-medium">Scrape jobs</span>.
                  </li>
                  <li>Scraped jobs appear in your dashboard kanban.</li>
                </ol>
              </section>

              <div className="pt-2">
                <Button onClick={() => window.location.reload()} variant="default">
                  I've installed it — re-check
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
