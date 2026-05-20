"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useReceipt } from "@/hooks/use-receipts";

import { ReceiptPreview } from "@/components/receipts/receipt-preview";

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useReceipt(params.id);

  const fieldRows = data
    ? [
        ["Vendor", data.vendorName || "Unknown"],
        ["Amount", data.amount != null ? `$${data.amount.toFixed(2)}` : "Not extracted"],
        ["Date", data.receiptDate ?? "Not extracted"],
        ["Category", data.category || "Uncategorized"],
        ["Confidence", data.confidence != null ? `${(data.confidence * 100).toFixed(0)}%` : "—"],
      ]
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <ReceiptPreview receiptId={params.id} />
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
