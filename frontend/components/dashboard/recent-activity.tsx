"use client";

import { useDashboardActivity } from "@/hooks/use-dashboard";

export function RecentActivity() {
  const { data, isLoading } = useDashboardActivity();

  return (
    <section className="rounded-[12px] border border-border-default bg-bg-surface">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="font-sans text-[15px] font-medium tracking-[-0.1px] text-text-primary">
          Recent activity
        </h2>
      </div>
      <div className="space-y-3 p-5">
        {isLoading ? (
          <div className="rounded-[8px] border border-border-default bg-bg-page p-3 text-[13px] leading-[1.55] text-text-muted">
            Loading activity...
          </div>
        ) : data && data.length > 0 ? (
          data.map((item) => (
            <div
              key={item.id}
              className="rounded-[8px] border border-border-default bg-bg-page p-3 text-[13px] leading-[1.55] text-text-muted"
            >
              {item.label}
            </div>
          ))
        ) : (
          <div className="rounded-[8px] border border-border-default bg-bg-page p-3 text-[13px] leading-[1.55] text-text-muted">
            No recent activity yet.
          </div>
        )}
      </div>
    </section>
  );
}
