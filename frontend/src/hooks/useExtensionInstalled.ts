import { useEffect, useState } from "react"

const ATTR = "data-job-linker-installed"
const GRACE_MS = 1500

type ExtensionState = {
  checked: boolean
  installed: boolean
  version: string | null
}

function readAttr(): string | null {
  return document.documentElement.getAttribute(ATTR)
}

export function useExtensionInstalled(): ExtensionState {
  const initialVersion = readAttr()
  const [state, setState] = useState<ExtensionState>({
    checked: initialVersion !== null,
    installed: initialVersion !== null,
    version: initialVersion,
  })

  useEffect(() => {
    if (state.installed) return

    let cancelled = false

    const observer = new MutationObserver(() => {
      const v = readAttr()
      if (v !== null && !cancelled) {
        setState({ checked: true, installed: true, version: v })
        observer.disconnect()
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATTR],
    })

    const graceTimer = window.setTimeout(() => {
      if (cancelled) return
      const v = readAttr()
      setState({ checked: true, installed: v !== null, version: v })
      observer.disconnect()
    }, GRACE_MS)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearTimeout(graceTimer)
    }
  }, [state.installed])

  return state
}
