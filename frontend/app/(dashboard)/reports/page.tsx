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
    <div className="space-y-6">
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Spend by category</h2>
        <div className="mt-6 flex items-end gap-4">
          {spendByCategory.length > 0 ? (
            spendByCategory.map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col gap-2">
                <div className="w-full rounded-[4px] bg-amber-surface" style={{ height: `${Math.max(bar.value / 10, 16)}px` }} />
                <span className="text-center text-[12px] text-text-muted">{bar.label}</span>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-text-muted">No expense data yet.</p>
          )}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
          <h2 className="text-[15px] font-medium text-text-primary">Spend by vendor</h2>
          <div className="mt-4 space-y-3">
            {spendByVendor.length > 0 ? (
              spendByVendor.map((vendor) => (
                <div key={vendor.label} className="flex items-center justify-between rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3">
                  <span className="text-[13px] text-text-secondary">{vendor.label}</span>
                  <span className="font-mono text-[12px] text-text-muted">${vendor.value.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-text-muted">No vendor spend yet.</p>
            )}
          </div>
        </section>
        <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
          <h2 className="text-[15px] font-medium text-text-primary">Spend by month</h2>
          <div className="mt-4 grid gap-3">
            {spendByMonth.length > 0 ? (
              spendByMonth.map((month) => (
                <div key={month.label} className="grid grid-cols-[72px_1fr_80px] items-center gap-3">
                  <span className="text-[12px] text-text-muted">{month.label}</span>
                  <div className="h-[3px] rounded-[2px] bg-border-default">
                    <div className="h-full rounded-[2px] bg-amber" style={{ width: `${Math.min(month.value / 10, 100)}%` }} />
                  </div>
                  <span className="font-mono text-[12px] text-text-muted">${month.value.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-text-muted">No monthly totals yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
