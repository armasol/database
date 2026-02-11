import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react"
import type { MetricAnalysis } from "@/lib/data-processor"

interface MetricCheckboxProps {
  metric: MetricAnalysis
  isSelected: boolean
  onToggle: (metricName: string) => void
  color: string
  formatValue: (name: string, value: number) => string
}

export function MetricCheckbox({ metric, isSelected, onToggle, color, formatValue }: MetricCheckboxProps) {
  const TrendIcon = metric.trend === "up" ? ArrowUpIcon : metric.trend === "down" ? ArrowDownIcon : MinusIcon
  const trendColor = metric.trend === "up" ? "text-green-600" : metric.trend === "down" ? "text-red-600" : "text-muted-foreground"

  const displayValue = metric.useAverage ? metric.currentWeek.average : metric.currentWeek.total

  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
      <Checkbox
        id={`metric-${metric.name}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(metric.name)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <Label
          htmlFor={`metric-${metric.name}`}
          className="text-sm font-medium cursor-pointer flex items-center gap-2"
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{metric.name}</span>
        </Label>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-semibold">
            {formatValue(metric.name, displayValue)}
          </span>
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
