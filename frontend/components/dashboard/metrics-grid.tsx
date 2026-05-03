"use client";

import { useDashboardStats } from "@/hooks/use-dashboard";
import { Receipt, DollarSign, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricsGrid() {
  const { data, isLoading } = useDashboardStats();

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
      title: "Processed",
      value: data ? String(data.processedCount) : "--",
      icon: CheckCircle2,
      color: "text-emerald",
      bg: "bg-emerald-surface",
      bar: "bg-emerald",
    },
    {
      title: "Pending",
      value: data ? String(data.pendingCount) : "--",
      icon: Clock,
      color: "text-amber",
      bg: "bg-amber-surface",
      bar: "bg-amber",
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
              <p className="mt-2 font-heading text-[26px] leading-none tracking-tight text-text-primary">
                {isLoading ? (
                  <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-bg-subtle" />
                ) : (
                  metric.value
                )}
              </p>
            </div>
            <div className={cn("flex size-8 items-center justify-center rounded-lg", metric.bg)}>
              <metric.icon className={cn("size-4", metric.color)} strokeWidth={2} />
            </div>
          </div>
          <div className="mt-3 h-[2px] w-full rounded-full bg-bg-subtle overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", metric.bar)}
              style={{ width: isLoading ? "0%" : "100%" }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
