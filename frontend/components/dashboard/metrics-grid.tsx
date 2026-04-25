"use client";

import { useDashboardStats } from "@/hooks/use-dashboard";

export function MetricsGrid() {
  const { data, isLoading } = useDashboardStats();

  const metrics = [
    {
      title: "Total spent",
      value: data ? `$${data.totalSpent.toFixed(2)}` : "--",
    },
    {
      title: "Receipts",
      value: data ? String(data.receiptCount) : "--",
    },
    {
      title: "Expenses",
      value: data ? String(data.expenseCount) : "--",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <article key={metric.title} className="rounded-[12px] border border-border-default bg-bg-surface px-[18px] py-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-text-ghost">
            {metric.title}
          </p>
          <p className="font-heading text-[24px] leading-none tracking-[-1px] text-text-primary">
            {isLoading ? "Loading..." : metric.value}
          </p>
        </article>
      ))}
    </div>
  );
}
