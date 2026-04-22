import { Sliders } from "lucide-react"

import { Button } from "@/components/ui/button"

export const THRESHOLD_OPTIONS = [
  { value: 0, label: "All" },
  { value: 0.5, label: "≥ 50%" },
  { value: 0.7, label: "≥ 70%" },
  { value: 0.9, label: "≥ 90%" },
] as const

export type ThresholdValue = (typeof THRESHOLD_OPTIONS)[number]["value"]

interface MatchThresholdCardProps {
  value: ThresholdValue
  onChange: (value: ThresholdValue) => void
  disabled?: boolean
  matchedCount: number
  totalCount: number
}

export default function MatchThresholdCard({
  value,
  onChange,
  disabled = false,
  matchedCount,
  totalCount,
}: MatchThresholdCardProps) {
  return (
    <div className="h-full min-h-[112px] border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sliders className="h-3.5 w-3.5" />
        Match threshold
      </div>
      <div className="flex flex-wrap gap-1.5">
        {THRESHOLD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={value === opt.value ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={disabled ? "Upload a CV to enable filtering" : ""}>
            {opt.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-auto">
        {disabled
          ? "Upload a CV to filter by fit."
          : value === 0
            ? `Showing all ${totalCount} saved jobs.`
            : `Showing ${matchedCount} of ${totalCount} jobs at or above this fit.`}
      </p>
    </div>
  )
}
