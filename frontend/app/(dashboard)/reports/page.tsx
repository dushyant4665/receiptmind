"use client";

import { useMemo } from "react";
import { useExpenses } from "@/hooks/use-expenses";

export default function ReportsPage() {
  const { data } = useExpenses();

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((expense) => {
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [data]);

  const spendByVendor = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((expense) => {
      map.set(expense.vendorName, (map.get(expense.vendorName) ?? 0) + expense.amount);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  const spendByMonth = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((expense) => {
      const month = expense.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + expense.amount);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [data]);

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Reports</h1>
        <p className="mt-1 text-[13px] text-text-muted">Financial intelligence and spend analytics</p>
      </div>
      <section className="rounded-lg border border-border-default bg-white p-5 shadow-xs">
        <h2 className="text-[13px] font-semibold text-text-primary">Spend by category</h2>
        <div className="mt-6 flex items-end gap-4">
          {spendByCategory.length > 0 ? (
            spendByCategory.map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col gap-2">
                <div className="w-full rounded-md bg-amber-surface" style={{ height: `${Math.max(bar.value / 10, 20)}px` }} />
                <span className="text-center text-[11px] text-text-muted">{bar.label}</span>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-text-muted">No expense data yet.</p>
          )}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border-default bg-white p-5 shadow-xs">
          <h2 className="text-[13px] font-semibold text-text-primary">Spend by vendor</h2>
          <div className="mt-4 space-y-2">
            {spendByVendor.length > 0 ? (
              spendByVendor.map((vendor) => (
                <div key={vendor.label} className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-page px-4 py-2.5">
                  <span className="text-[12px] text-text-secondary">{vendor.label}</span>
                  <span className="font-mono text-[12px] text-text-primary tabular-nums">${vendor.value.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-text-muted">No vendor spend yet.</p>
            )}
          </div>
        </section>
        <section className="rounded-lg border border-border-default bg-white p-5 shadow-xs">
          <h2 className="text-[13px] font-semibold text-text-primary">Spend by month</h2>
          <div className="mt-4 grid gap-3">
            {spendByMonth.length > 0 ? (
              spendByMonth.map((month) => (
                <div key={month.label} className="grid grid-cols-[72px_1fr_80px] items-center gap-3">
                  <span className="text-[11px] text-text-muted tabular-nums">{month.label}</span>
                  <div className="h-1 rounded-full bg-border-default overflow-hidden">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${Math.min(month.value / 10, 100)}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-text-primary tabular-nums">${month.value.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-text-muted">No monthly totals yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
