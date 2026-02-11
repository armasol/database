"use client"

import { CardContent } from "@/components/ui/card"
import { Card } from "@/components/ui/card"
import { useMemo, useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { UnifiedMetricChart } from "@/components/unified-metric-chart"
import { fetchProductData, type DailyMetrics } from "@/lib/supabase-data"
import { type MetricAnalysis, type MetricData } from "@/lib/data-processor"

interface SupabaseDashboardProps {
  productName: string
  productImageUrl?: string
}

function transformSupabaseToMetricData(data: DailyMetrics[]): MetricData[] {
  const metrics: MetricData[] = []
  
  const metricDefinitions = [
    { name: "GMV", key: "gmv" },
    { name: "Items Sold", key: "items_sold" },
    { name: "Orders", key: "orders" },
    { name: "AOV", key: "aov" },
    { name: "Units per Order", key: "units_per_order" },
    { name: "Product Impressions", key: "product_impressions" },
    { name: "Page Views", key: "page_views" },
    { name: "Click-through Rate", key: "click_through_rate" },
    { name: "Visitors", key: "visitors" },
    { name: "Customers", key: "customers" },
    { name: "Conv. Rate", key: "conversion_rate" },
    { name: "$ per Visitor", key: "dollar_per_visitor" },
    { name: "$ per Customer", key: "dollar_per_customer" },
    { name: "Subscribers", key: "subscribers" }
  ]
  
  metricDefinitions.forEach(({ name, key }) => {
    const values = data.map(row => ({
      date: row.date,
      value: (row as any)[key] || 0
    }))
    
    if (values.some(v => v.value !== 0)) {
      metrics.push({ name, values })
    }
  })
  
  return metrics
}

function calculateWeekOverWeek(metrics: MetricData[]): MetricAnalysis[] {
  return metrics.map(metric => {
    const values = metric.values
    if (values.length < 8) {
      return {
        name: metric.name,
        currentWeek: 0,
        previousWeek: 0,
        change: 0,
        percentageChange: 0
      }
    }
    
    const last7 = values.slice(-7)
    const prev7 = values.slice(-14, -7)
    
    const currentWeek = last7.reduce((sum, v) => sum + v.value, 0)
    const previousWeek = prev7.reduce((sum, v) => sum + v.value, 0)
    const change = currentWeek - previousWeek
    const percentageChange = previousWeek > 0 ? (change / previousWeek) * 100 : 0
    
    return {
      name: metric.name,
      currentWeek,
      previousWeek,
      change,
      percentageChange
    }
  })
}

export function SupabaseDashboard({ productName, productImageUrl }: SupabaseDashboardProps) {
  const [metrics, setMetrics] = useState<MetricAnalysis[]>([])
  const [rawMetrics, setRawMetrics] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriodMetrics, setSelectedPeriodMetrics] = useState<MetricAnalysis[]>([])

  const keyMetrics = useMemo(() => {
    const metricsToUse = selectedPeriodMetrics.length > 0 ? selectedPeriodMetrics : metrics
    const gmv = metricsToUse.find(m => m.name === "GMV")
    const orders = metricsToUse.find(m => m.name === "Orders")
    const convRate = metricsToUse.find(m => m.name === "Conv. Rate")
    const aov = metricsToUse.find(m => m.name === "AOV")
    
    return { gmv, orders, convRate, aov }
  }, [metrics, selectedPeriodMetrics])

  useEffect(() => {
    async function fetchData() {
      try {
        console.log("[v0] Fetching data for product:", productName)
        setLoading(true)
        setError(null)

        const data = await fetchProductData(productName)
        console.log("[v0] Received data rows:", data.length)
        
        if (data.length === 0) {
          setError("No data available. Please import data first.")
          setLoading(false)
          return
        }
        
        const transformedMetrics = transformSupabaseToMetricData(data)
        console.log("[v0] Transformed metrics count:", transformedMetrics.length)
        console.log("[v0] Metric names:", transformedMetrics.map(m => m.name))
        setRawMetrics(transformedMetrics)
        
        const wowData = calculateWeekOverWeek(transformedMetrics)
        console.log("[v0] Week-over-week calculated for", wowData.length, "metrics")
        setMetrics(wowData)
      } catch (err) {
        console.error("[v0] Error fetching Supabase data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [productName])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Spinner className="h-8 w-8" />
        <p className="text-muted-foreground">Loading analytics data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <strong>Error:</strong> {error}
        </AlertDescription>
      </Alert>
    )
  }

  if (metrics.length === 0) {
    return (
      <Alert>
        <AlertDescription>No metrics found. Please import data first.</AlertDescription>
      </Alert>
    )
  }

  // Calculate key stats for header

  return (
    <div className="space-y-6">
      {/* Stats Header - Centered Cards */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-lg">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Revenue
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              ${keyMetrics.gmv?.currentWeek.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <span className={keyMetrics.gmv?.percentageChange && keyMetrics.gmv.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {keyMetrics.gmv?.percentageChange && keyMetrics.gmv.percentageChange >= 0 ? '↑' : '↓'}
                {Math.abs(keyMetrics.gmv?.percentageChange || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-lg">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Orders
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {keyMetrics.orders?.currentWeek.toLocaleString() || '0'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <span className={keyMetrics.orders?.percentageChange && keyMetrics.orders.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {keyMetrics.orders?.percentageChange && keyMetrics.orders.percentageChange >= 0 ? '↑' : '↓'}
                {Math.abs(keyMetrics.orders?.percentageChange || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-lg">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Avg Order Value
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              ${keyMetrics.aov?.currentWeek.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <span className={keyMetrics.aov?.percentageChange && keyMetrics.aov.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {keyMetrics.aov?.percentageChange && keyMetrics.aov.percentageChange >= 0 ? '↑' : '↓'}
                {Math.abs(keyMetrics.aov?.percentageChange || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-lg">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Conversion
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {keyMetrics.convRate?.currentWeek.toFixed(2) || '0.00'}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <span className={keyMetrics.convRate?.percentageChange && keyMetrics.convRate.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {keyMetrics.convRate?.percentageChange && keyMetrics.convRate.percentageChange >= 0 ? '↑' : '↓'}
                {Math.abs(keyMetrics.convRate?.percentageChange || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <UnifiedMetricChart 
        metrics={metrics} 
        rawMetrics={rawMetrics} 
        productImageUrl={productImageUrl} 
        productName={productName}
        onPeriodChange={setSelectedPeriodMetrics}
      />
    </div>
  )
}
