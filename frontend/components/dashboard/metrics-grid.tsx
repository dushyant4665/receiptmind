"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard";

export function MetricsGrid() {
  const { data, isLoading } = useDashboardStats();

  const metrics = [
    {
      title: "Approved spend",
      value: data ? `$${data.totalSpent.toFixed(2)}` : "--",
      delta: data ? `${data.monthlyChange > 0 ? "+" : ""}${data.monthlyChange.toFixed(1)}%` : "--",
      tone: data && data.monthlyChange < 0 ? "down" : "up",
    },
    {
      title: "Receipts processed",
      value: data ? String(data.receiptCount) : "--",
      delta: data ? `${data.accuracyRate.toFixed(1)}% accuracy` : "--",
      tone: "up",
    },
    {
      title: "Expenses recorded",
      value: data ? String(data.expenseCount) : "--",
      delta: data ? `${data.timeSavedHours.toFixed(1)} hrs saved` : "--",
      tone: "up",
    },
    {
      title: "Monthly efficiency",
      value: data ? `${data.timeSavedHours.toFixed(1)} hrs` : "--",
      delta: data ? "Time saved" : "--",
      tone: "up",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const positive = metric.tone === "up";

        return (
          <article key={metric.title} className="rounded-[12px] border border-border-default bg-bg-surface px-[18px] py-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-text-ghost">
              {metric.title}
            </p>
            <p className="font-heading text-[24px] leading-none tracking-[-1px] text-text-primary">
              {isLoading ? "Loading..." : metric.value}
            </p>
            <span
              className={`mt-1.5 inline-flex items-center gap-[3px] rounded-[4px] px-1.5 py-0.5 text-[11px] ${
                positive ? "bg-success-surface text-success" : "bg-error-surface text-error"
              }`}
            >
              {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {metric.delta}
            </span>
          </article>
        );
      })}
    </div>
  );
}
