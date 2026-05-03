"use client";

import { useReceipts } from "@/hooks/use-receipts";
import { Receipt as ReceiptIcon, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function RecentActivity() {
  const { data, isLoading } = useReceipts(5, 0);

  const receipts = data?.receipts ?? [];

  return (
    <section className="rounded-lg border border-border-default bg-white overflow-hidden shadow-xs">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
        <h2 className="text-[13px] font-semibold text-text-primary">
          Recent Activity
        </h2>
        <Link href="/receipts" className="text-[11px] font-medium text-amber hover:text-amber-hover transition-colors flex items-center gap-1">
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="divide-y divide-border-subtle">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-bg-subtle" />
            ))}
          </div>
        ) : receipts.length > 0 ? (
          receipts.map((item) => {
            const isProcessing = item.status === "pending" || item.status === "processing";
            const isError = item.status === "error" || item.status === "failed";

            return (
              <div
                key={item.id}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-page"
              >
                <div className={cn(
                  "flex size-8 items-center justify-center rounded-lg border shrink-0",
                  isProcessing ? "border-amber-border bg-amber-surface" :
                  isError ? "border-red-200 bg-red-surface" :
                  "border-border-default bg-bg-page"
                )}>
                  {isProcessing ? (
                    <Clock className="size-4 text-amber" />
                  ) : isError ? (
                    <AlertCircle className="size-4 text-red" />
                  ) : (
                    <ReceiptIcon className="size-4 text-text-muted" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[12px] font-medium text-text-primary">
                      {item.vendorName || "Processing..."}
                    </p>
                    <p className="font-mono text-[12px] font-semibold text-text-primary tabular-nums">
                      {item.amount != null ? `$${item.amount.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <p className="truncate text-[11px] text-text-muted">
                      {item.category || "Pending"}
                    </p>
                    <p className="text-[10px] text-text-ghost tabular-nums">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-bg-subtle mb-3">
              <CheckCircle2 className="size-5 text-text-ghost" />
            </div>
            <h3 className="text-[12px] font-medium text-text-primary">No activity yet</h3>
            <p className="mt-1 text-[11px] text-text-muted max-w-[180px]">
              Upload your first receipt to get started.
            </p>
          </div>
        )}
      </div>
      {receipts.length > 0 && (
        <div className="px-5 py-2.5 bg-bg-page/50 border-t border-border-subtle">
          <p className="text-[10px] text-center text-text-ghost font-medium uppercase tracking-widest">
            AI Engine: Active
          </p>
        </div>
      )}
    </section>
  );
}
