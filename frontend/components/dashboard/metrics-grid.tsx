"use client";

import { useDashboardStats } from "@/hooks/use-dashboard";
import { useProcessingMetrics } from "@/hooks/use-metrics";
import { Receipt, DollarSign, CheckCircle2, Clock, AlertCircle, Zap, Timer, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricsGrid() {
  const { data, isLoading } = useDashboardStats();
  const { data: metricsData, isLoading: isLoadingMetrics } = useProcessingMetrics();
  
  const automationRate = data && data.totalReceipts > 0 ? Math.round((data.processedCount / data.totalReceipts) * 100) : 0;
  const timeSavedMinutes = data ? data.processedCount * 4 : 0;

  const formatSeconds = (seconds: number) => {
    if (seconds === 0) return "--";
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    return `${seconds.toFixed(1)}s`;
  };

  const metrics = [
    {
      title: "Total Receipts",
      value: data ? String(data.totalReceipts) : "--",
      icon: Receipt,
      color: "text-blue",
      bg: "bg-blue-surface",
      bar: "bg-blue",
    },
    {
      title: "Total Amount",
      value: data ? `$${data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--",
      icon: DollarSign,
      color: "text-emerald",
      bg: "bg-emerald-surface",
      bar: "bg-emerald",
    },
    {
      title: "Avg Process Time",
      value: metricsData ? formatSeconds(metricsData.average_seconds) : "--",
      icon: Timer,
      color: "text-amber",
      bg: "bg-amber-surface",
      bar: "bg-amber",
      isLoading: isLoadingMetrics,
    },
    {
      title: "Fastest / Slowest",
      value: metricsData ? `${formatSeconds(metricsData.min_seconds)} / ${formatSeconds(metricsData.max_seconds)}` : "--",
      icon: Gauge,
      color: "text-purple",
      bg: "bg-purple-surface",
      bar: "bg-purple",
      isLoading: isLoadingMetrics,
    },
    {
      title: "Needs Review",
      value: data ? String(data.needsReviewCount) : "--",
      icon: AlertCircle,
      color: "text-red",
      bg: "bg-red-surface",
      bar: "bg-red",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
      {metrics.map((metric, i) => (
        <article
          key={metric.title}
          className={cn(
            "group relative overflow-hidden rounded-lg border border-border-default bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-ink5 animate-slide-up",
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">
                {metric.title}
              </p>
              <div className="mt-2 font-heading text-[22px] leading-none tracking-tight text-text-primary">
                {isLoading || metric.isLoading ? (
                  <span className="inline-block h-6 w-16 animate-pulse rounded-md bg-bg-subtle" />
                ) : (
                  metric.value
                )}
              </div>
            </div>
            <div className={cn("flex size-8 items-center justify-center rounded-lg", metric.bg)}>
              <metric.icon className={cn("size-4", metric.color)} strokeWidth={2} />
            </div>
          </div>
          <div className="mt-3 h-[2px] w-full rounded-full bg-bg-subtle overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", metric.bar)}
              style={{ width: isLoading || metric.isLoading ? "0%" : "100%" }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
