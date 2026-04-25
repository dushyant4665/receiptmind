"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useReceipt } from "@/hooks/use-receipts";

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useReceipt(params.id);

  const fieldRows = data
    ? [
        ["Vendor", data.vendorName || data.filename],
        ["Amount", data.amount != null ? `${data.currency} ${data.amount.toFixed(2)}` : "Not extracted"],
        ["Date", data.date ?? "Not extracted"],
        ["Category", data.category || "Uncategorized"],
        ["Currency", data.currency || "USD"],
        ["Description", data.description || "No description"],
      ]
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Receipt preview</h2>
        <div className="mt-4 aspect-[3/4] rounded-[12px] border border-border-default bg-bg-page p-4">
          <div className="mx-auto flex h-full max-w-[260px] items-center justify-center rounded-[8px] border border-border-subtle bg-bg-surface p-4 text-center">
            {isLoading ? (
              <p className="font-mono text-[12px] text-text-muted">Loading receipt...</p>
            ) : data?.fileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.fileUrl} alt={data.filename} className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="font-mono text-[12px] text-text-muted">Receipt preview unavailable</p>
            )}
          </div>
        </div>
      </section>
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-text-primary">Extracted fields</h2>
          <Button variant="ghost" disabled>
            Synced from backend
          </Button>
        </div>
        <div className="mt-5 grid gap-3">
          {isLoading ? (
            <div className="rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3 text-[13px] text-text-muted">
              Loading extracted fields...
            </div>
          ) : fieldRows.length > 0 ? (
            fieldRows.map(([label, value]) => (
              <div key={label} className="grid gap-1 rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-text-ghost">{label}</p>
                <p className="text-[13px] text-text-primary">{value}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3 text-[13px] text-text-muted">
              Receipt not found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
