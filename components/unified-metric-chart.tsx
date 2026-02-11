"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Line, LineChart, Area, AreaChart, ComposedChart, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid, Brush } from "recharts"
import type { MetricAnalysis, MetricData } from "@/lib/data-processor"
import { ArrowUpIcon, ArrowDownIcon, MinusIcon, CalendarIcon } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MetricCheckbox } from "./MetricCheckbox" // Import MetricCheckbox component

interface UnifiedMetricChartProps {
  metrics: MetricAnalysis[]
  rawMetrics: MetricData[]
  productImageUrl?: string
  productName?: string
  onPeriodChange?: (metrics: MetricAnalysis[]) => void
}

const COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
  "#a855f7", // violet
]

function aggregateByWeek(
  values: { date: string; value: number }[],
  useAverage: boolean = false,
): { week: number; value: number; dates: string[] }[] {
  const weeks: { week: number; value: number; dates: string[] }[] = []

  for (let i = 0; i < values.length; i += 7) {
    const weekData = values.slice(i, i + 7)
    if (weekData.length > 0) {
      const weekTotal = weekData.reduce((sum, v) => sum + v.value, 0)
      const weekValue = useAverage ? weekTotal / weekData.length : weekTotal
      const weekNumber = Math.floor(i / 7) + 1
      const dates = weekData.map((v) => v.date)
      weeks.push({ week: weekNumber, value: weekValue, dates })
    }
  }

  return weeks
}

function recalculateMetricsForPeriod(
  rawMetrics: MetricData[],
  days: number,
  customEndDate: string | null = null,
  viewMode: "day" | "week" = "day",
): MetricAnalysis[] {
  return rawMetrics.map((metric) => {
    const totalValues = metric.values.length

    let currentPeriodValues: { date: string; value: number }[]
    let previousPeriodValues: { date: string; value: number }[]

    if (customEndDate) {
      const endIndex = metric.values.findIndex((v) => v.date === customEndDate)

      if (endIndex === -1) {
        currentPeriodValues = metric.values.slice(Math.max(0, totalValues - days))
        previousPeriodValues = metric.values.slice(Math.max(0, totalValues - days * 2), Math.max(0, totalValues - days))
      } else {
        const startIndex = Math.max(0, endIndex - days + 1)
        const previousStartIndex = Math.max(0, startIndex - days)

        currentPeriodValues = metric.values.slice(startIndex, endIndex + 1)
        previousPeriodValues = metric.values.slice(previousStartIndex, startIndex)
      }
    } else {
      currentPeriodValues = metric.values.slice(Math.max(0, totalValues - days))
      previousPeriodValues = metric.values.slice(Math.max(0, totalValues - days * 2), Math.max(0, totalValues - days))
    }

    const currentTotal = currentPeriodValues.reduce((sum, v) => sum + v.value, 0)
    const previousTotal = previousPeriodValues.reduce((sum, v) => sum + v.value, 0)
    const currentAvg = currentPeriodValues.length > 0 ? currentTotal / currentPeriodValues.length : 0
    const previousAvg = previousPeriodValues.length > 0 ? previousTotal / previousPeriodValues.length : 0

    const useAverage =
      metric.name.toLowerCase().includes("rate") ||
      metric.name.toLowerCase().includes("aov") ||
      metric.name.toLowerCase().includes("units per order") ||
      metric.name.toLowerCase().includes("$ per") ||
      metric.name.toLowerCase().includes("avg")

    const currentValue = useAverage ? currentAvg : currentTotal
    const previousValue = useAverage ? previousAvg : previousTotal

    const change = currentValue - previousValue
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0

    const allValues = metric.values.map((v) => v.value).sort((a, b) => a - b)
    const median = allValues[Math.floor(allValues.length / 2)] || 0
    const aboveMedian = currentAvg > median

    return {
      name: metric.name,
      currentWeek: {
        total: currentTotal,
        average: currentAvg,
        dailyValues: currentPeriodValues,
      },
      previousWeek: {
        total: previousTotal,
        average: previousAvg,
        dailyValues: previousPeriodValues,
      },
      change,
      changePercent,
      trend: changePercent > 5 ? "up" : changePercent < -5 ? "down" : ("flat" as const),
      median,
      aboveMedian,
      useAverage,
    }
  })
}

export function UnifiedMetricChart({ metrics: initialMetrics, rawMetrics, productImageUrl, productName, onPeriodChange }: UnifiedMetricChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([initialMetrics[0]?.name || ""])
  const [viewMode, setViewMode] = useState<"day" | "week">("day")
  const [timePeriod, setTimePeriod] = useState<number>(7)
  const [customEndDate, setCustomEndDate] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState<boolean>(true)
  const [chartType, setChartType] = useState<"line" | "area">("area")
  const [showBrush, setShowBrush] = useState<boolean>(false)

  const availableDates = useMemo(() => {
    if (rawMetrics.length === 0) return []
    return rawMetrics[0].values.map((v) => v.date)
  }, [rawMetrics])

  const metrics = useMemo(() => {
    const daysToUse = viewMode === "week" ? timePeriod * 7 : timePeriod
    return recalculateMetricsForPeriod(rawMetrics, daysToUse, customEndDate, viewMode)
  }, [rawMetrics, timePeriod, customEndDate, viewMode])

  // Notify parent of period changes for stats header
  const notifyParentOfPeriodChanges = () => {
    if (onPeriodChange) {
      // Convert detailed metrics to simple MetricAnalysis format
      const simplifiedMetrics = metrics.map(m => ({
        name: m.name,
        currentWeek: m.useAverage ? m.currentWeek.average : m.currentWeek.total,
        previousWeek: m.useAverage ? m.previousWeek.average : m.previousWeek.total,
        change: m.change,
        percentageChange: m.changePercent
      }))
      onPeriodChange(simplifiedMetrics)
    }
  }

  useEffect(() => {
    notifyParentOfPeriodChanges()
  }, [metrics, onPeriodChange])

  const toggleMetric = (metricName: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricName) ? prev.filter((m) => m !== metricName) : [...prev, metricName],
    )
  }

  const formatValue = (name: string, value: number) => {
    if (name.toLowerCase().includes("gmv") || name.toLowerCase().includes("$")) {
      if (name.toLowerCase().includes("per")) {
        return `$${value.toFixed(2)}`
      }
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    }
    if (name.toLowerCase().includes("rate") || name.toLowerCase().includes("%")) {
      return `${value.toFixed(2)}%`
    }
    if (name.toLowerCase().includes("aov") || name.toLowerCase().includes("units per order")) {
      return value.toFixed(2)
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const chartData = useMemo(() => {
    if (selectedMetrics.length === 0) return []

    if (viewMode === "week") {
      // For week view, aggregate by weeks and show current vs previous side by side
      const currentWeeksData = selectedMetrics.map((metricName) => {
        const metric = metrics.find((m) => m.name === metricName)
        if (!metric) return []
        // Determine if this metric should use average instead of sum
        const useAverage = metric.useAverage || 
          metricName.toLowerCase().includes("rate") ||
          metricName.toLowerCase().includes("aov") ||
          metricName.toLowerCase().includes("units per order") ||
          metricName.toLowerCase().includes("$ per") ||
          metricName.toLowerCase().includes("avg")
        return aggregateByWeek(metric.currentWeek.dailyValues, useAverage)
      })

      const previousWeeksData = selectedMetrics.map((metricName) => {
        const metric = metrics.find((m) => m.name === metricName)
        if (!metric) return []
        // Determine if this metric should use average instead of sum
        const useAverage = metric.useAverage || 
          metricName.toLowerCase().includes("rate") ||
          metricName.toLowerCase().includes("aov") ||
          metricName.toLowerCase().includes("units per order") ||
          metricName.toLowerCase().includes("$ per") ||
          metricName.toLowerCase().includes("avg")
        return aggregateByWeek(metric.previousWeek.dailyValues, useAverage)
      })

      const maxWeeks = Math.max(...currentWeeksData.map((weeks) => weeks.length))

      const weeks = Array.from({ length: maxWeeks }, (_, i) => {
        const dataPoint: Record<string, string | number | string[]> = { week: i + 1 }

        selectedMetrics.forEach((metricName, metricIndex) => {
          const currentWeek = currentWeeksData[metricIndex]?.[i]
          const previousWeek = previousWeeksData[metricIndex]?.[i]

          dataPoint[`${metricName}_current`] = currentWeek?.value || 0
          dataPoint[`${metricName}_current_dates`] = currentWeek?.dates || []
          dataPoint[`${metricName}_previous`] = previousWeek?.value || 0
          dataPoint[`${metricName}_previous_dates`] = previousWeek?.dates || []
        })

        return dataPoint
      })

      return weeks
    } else {
      // Day view (existing logic)
      const maxDays = Math.max(
        ...metrics.filter((m) => selectedMetrics.includes(m.name)).map((m) => m.currentWeek.dailyValues.length),
      )

      const days = Array.from({ length: maxDays }, (_, i) => {
        const dataPoint: Record<string, string | number> = { day: i + 1 }

        selectedMetrics.forEach((metricName) => {
          const metric = metrics.find((m) => m.name === metricName)
          if (metric) {
            const currentValue = metric.currentWeek.dailyValues[i]
            const previousValue = metric.previousWeek.dailyValues[i]

            dataPoint[`${metricName}_current`] = currentValue?.value || 0
            dataPoint[`${metricName}_current_date`] = currentValue?.date || ""
            dataPoint[`${metricName}_previous`] = previousValue?.value || 0
            dataPoint[`${metricName}_previous_date`] = previousValue?.date || ""
          }
        })

        return dataPoint
      })

      return days
    }
  }, [selectedMetrics, metrics, viewMode])

  return (
    <div className="space-y-4">
      {/* Compact Time Controls */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">View:</Label>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "day" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 rounded-r-none"
                  onClick={() => {
                    setViewMode("day")
                    setTimePeriod(7)
                    setCustomEndDate(null)
                  }}
                >
                  Daily
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 rounded-l-none"
                  onClick={() => {
                    setViewMode("week")
                    setTimePeriod(8)
                    setCustomEndDate(null)
                  }}
                >
                  Weekly
                </Button>
              </div>
            </div>

            {/* Quick Period Select */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Period:</Label>
              <div className="flex gap-1">
                {viewMode === "day" ? (
                  <>
                    <Button
                      variant={timePeriod === 7 && !customEndDate ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setTimePeriod(7)
                        setCustomEndDate(null)
                      }}
                    >
                      7D
                    </Button>
                    <Button
                      variant={timePeriod === 14 && !customEndDate ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setTimePeriod(14)
                        setCustomEndDate(null)
                      }}
                    >
                      14D
                    </Button>
                    <Button
                      variant={timePeriod === 30 && !customEndDate ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setTimePeriod(30)
                        setCustomEndDate(null)
                      }}
                    >
                      30D
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={timePeriod === 4 && !customEndDate ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setTimePeriod(4)
                        setCustomEndDate(null)
                      }}
                    >
                      4W
                    </Button>
                    <Button
                      variant={timePeriod === 8 && !customEndDate ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setTimePeriod(8)
                        setCustomEndDate(null)
                      }}
                    >
                      8W
                    </Button>
                    <Button
                      variant={timePeriod === 12 && !customEndDate ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setTimePeriod(12)
                        setCustomEndDate(null)
                      }}
                    >
                      12W
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Custom Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={customEndDate ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEndDate || "Custom"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <ScrollArea className="h-[280px]">
                  <div className="p-2 space-y-1">
                    {availableDates
                      .slice()
                      .reverse()
                      .map((date) => (
                        <Button
                          key={date}
                          variant={customEndDate === date ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start font-mono text-xs"
                          onClick={() => {
                            setCustomEndDate(date)
                            setTimePeriod(viewMode === "week" ? 8 : 7)
                          }}
                        >
                          {date}
                        </Button>
                      ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            
            {customEndDate && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCustomEndDate(null)}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics
                .filter(
                  (m) =>
                    m.name.includes("GMV") ||
                    m.name.includes("Items Sold") ||
                    m.name.includes("Orders") ||
                    m.name.includes("AOV"),
                )
                .map((metric) => (
                  <MetricCheckbox
                    key={metric.name}
                    metric={metric}
                    isSelected={selectedMetrics.includes(metric.name)}
                    onToggle={toggleMetric}
                    color={COLORS[metrics.findIndex((m) => m.name === metric.name) % COLORS.length]}
                    formatValue={formatValue}
                  />
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Traffic & Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics
                .filter(
                  (m) =>
                    m.name.includes("Product Impressions") ||
                    m.name.includes("Page Views") ||
                    m.name.includes("Visitors") ||
                    m.name.includes("Click-through"),
                )
                .sort((a, b) => {
                  // Sort to put Product Impressions first, then Page Views
                  const order = ["Product Impressions", "Page Views", "Visitors", "Click-through"]
                  const aIndex = order.findIndex((term) => a.name.includes(term))
                  const bIndex = order.findIndex((term) => b.name.includes(term))
                  return aIndex - bIndex
                })
                .map((metric) => (
                  <MetricCheckbox
                    key={metric.name}
                    metric={metric}
                    isSelected={selectedMetrics.includes(metric.name)}
                    onToggle={toggleMetric}
                    color={COLORS[metrics.findIndex((m) => m.name === metric.name) % COLORS.length]}
                    formatValue={formatValue}
                  />
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversion & Monetization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics
                .filter(
                  (m) =>
                    m.name.includes("Conv. Rate") ||
                    m.name.includes("$ per") ||
                    m.name.includes("Units per Order") ||
                    m.name.includes("Subscribers"),
                )
                .map((metric) => (
                  <MetricCheckbox
                    key={metric.name}
                    metric={metric}
                    isSelected={selectedMetrics.includes(metric.name)}
                    onToggle={toggleMetric}
                    color={COLORS[metrics.findIndex((m) => m.name === metric.name) % COLORS.length]}
                    formatValue={formatValue}
                  />
                ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>{viewMode === "week" ? "Week-over-Week" : "Day-over-Day"} Comparison</CardTitle>
              <div className="flex items-center gap-2">
                {/* Chart Type Toggle - HIDDEN */}
                
                <Button
                  variant={showComparison ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowComparison(!showComparison)}
                >
                  {showComparison ? "Hide" : "Show"} Comparison
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedMetrics.length === 0 ? (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                Select at least one metric to view the chart
              </div>
            ) : (
              <div className="w-full h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      {selectedMetrics.map((metricName) => {
                        const metricIndex = metrics.findIndex((m) => m.name === metricName)
                        const baseColor = COLORS[metricIndex % COLORS.length]
                        return (
                          <linearGradient key={`gradient-${metricName}`} id={`gradient-${metricName}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={baseColor} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={baseColor} stopOpacity={0.05}/>
                          </linearGradient>
                        )
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey={viewMode === "week" ? "week" : "day"}
                      label={{ value: viewMode === "week" ? "Week" : "Day", position: "insideBottom", offset: -5 }}
                      stroke="hsl(var(--foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null

                        const filteredPayload = showComparison
                          ? payload
                          : payload.filter((entry) => {
                              const dataKey = entry.dataKey?.toString() || ""
                              return dataKey.includes("_current")
                            })

                        if (filteredPayload.length === 0) return null

                        return (
                          <div className="rounded-lg border border-border bg-card p-3 shadow-xl max-w-xs backdrop-blur-sm">
                            {filteredPayload.map((entry, i) => {
                              const dataKey = entry.dataKey?.toString() || ""
                              const period = dataKey.includes("_current") ? "Current Period" : "Previous Period"
                              const metricName = dataKey.replace("_current", "").replace("_previous", "")

                              if (viewMode === "week") {
                                const datesKey = dataKey.includes("_current")
                                  ? `${metricName}_current_dates`
                                  : `${metricName}_previous_dates`
                                const dates = entry.payload[datesKey] as string[]
                                const dateRange =
                                  dates && dates.length > 0 ? `${dates[0]} - ${dates[dates.length - 1]}` : ""
                                const value = entry.value

                                return (
                                  <div key={i} className="mb-2 last:mb-0">
                                    <p className="text-xs font-semibold" style={{ color: entry.color }}>
                                      {metricName} - {period}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{dateRange}</p>
                                    <p className="text-sm font-bold">{formatValue(metricName, Number(value))}</p>
                                  </div>
                                )
                              } else {
                                const dateKey = dataKey.includes("_current")
                                  ? `${metricName}_current_date`
                                  : `${metricName}_previous_date`
                                const date = entry.payload[dateKey]
                                const value = entry.value

                                return (
                                  <div key={i} className="mb-2 last:mb-0">
                                    <p className="text-xs font-semibold" style={{ color: entry.color }}>
                                      {metricName} - {period}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{date}</p>
                                    <p className="text-sm font-bold">{formatValue(metricName, Number(value))}</p>
                                  </div>
                                )
                              }
                            })}
                          </div>
                        )
                      }}
                    />
                    <Legend
                      formatter={(value) => {
                        const isCurrentWeek = value.includes("_current")
                        const metricName = value.replace("_current", "").replace("_previous", "")
                        return `${metricName} (${isCurrentWeek ? "Current" : "Previous"})`
                      }}
                      wrapperStyle={{ paddingTop: "20px" }}
                    />
                    {selectedMetrics.map((metricName) => {
                      const metricIndex = metrics.findIndex((m) => m.name === metricName)
                      const baseColor = COLORS[metricIndex % COLORS.length]
                      const isGMV = metricName.includes("GMV")
                      const shouldShowAsArea = isGMV

                      return (
                        <React.Fragment key={metricName}>
                          {shouldShowAsArea ? (
                            <>
                              <Area
                                type="monotone"
                                dataKey={`${metricName}_current`}
                                name={`${metricName}_current`}
                                stroke={baseColor}
                                strokeWidth={3}
                                fill={`url(#gradient-${metricName})`}
                                dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                                activeDot={{ r: 6, strokeWidth: 2 }}
                              />
                              {showComparison && (
                                <Area
                                  type="monotone"
                                  dataKey={`${metricName}_previous`}
                                  name={`${metricName}_previous`}
                                  stroke={baseColor}
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  fill="none"
                                  dot={{ r: 3, fill: baseColor, opacity: 0.6 }}
                                  activeDot={{ r: 5 }}
                                  opacity={0.6}
                                />
                              )}
                            </>
                          ) : (
                            <>
                              <Line
                                type="monotone"
                                dataKey={`${metricName}_current`}
                                name={`${metricName}_current`}
                                stroke={baseColor}
                                strokeWidth={3}
                                dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                                activeDot={{ r: 6, strokeWidth: 2 }}
                              />
                              {showComparison && (
                                <Line
                                  type="monotone"
                                  dataKey={`${metricName}_previous`}
                                  name={`${metricName}_previous`}
                                  stroke={baseColor}
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  dot={{ r: 3, fill: baseColor, opacity: 0.6 }}
                                  activeDot={{ r: 5 }}
                                  opacity={0.6}
                                />
                              )}
                            </>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
