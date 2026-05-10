"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { useAccountantClients, useAccountantReviewQueue } from "@/hooks/use-accountant";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountantPage() {
  const { data: clients = [], isLoading: clientsLoading } = useAccountantClients();
  const { data: reviewItems = [], isLoading: reviewLoading } = useAccountantReviewQueue();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber">Accountant mode</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">Review only what needs attention</h1>
        <p className="mt-1 text-[13px] text-text-muted">Client books stay automated; your queue stays focused on exceptions.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Clients" value={clients.length} />
        <Metric label="Open reviews" value={reviewItems.length} tone={reviewItems.length ? "warn" : "ok"} />
        <Metric label="Processing" value={clients.reduce((sum, item) => sum + item.processing_count, 0)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border-default bg-white">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-semibold">Clients</h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {clientsLoading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="m-4 h-12" />)
            ) : clients.length ? (
              clients.map((client) => (
                <div key={client.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-bg-subtle">
                    <Building2 className="size-4 text-text-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{client.name}</p>
                    <p className="text-[11px] text-text-muted">{client.open_exceptions} open reviews</p>
                  </div>
                  <span className="text-[12px] font-medium tabular-nums">${client.processed_amount.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-[12px] text-text-muted">No client organizations connected yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border-default bg-white">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-semibold">Exception review queue</h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {reviewLoading ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="m-4 h-14" />)
            ) : reviewItems.length ? (
              reviewItems.map((item) => (
                <Link key={item.id} href={`/receipts/${item.receipt_id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle">
                  <AlertCircle className="size-4 shrink-0 text-amber" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.organization_name} · {item.message}</p>
                    <p className="text-[11px] text-text-muted">{item.type} · {item.field || "receipt"}</p>
                  </div>
                  <ArrowRight className="size-4 text-text-ghost" />
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <CheckCircle2 className="size-7 text-emerald-500" />
                <p className="text-[13px] font-medium">No exceptions waiting.</p>
                <p className="text-[12px] text-text-muted">Client bookkeeping is clean right now.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-text-ghost">{label}</p>
      <p className={tone === "warn" ? "mt-2 text-2xl font-semibold text-amber" : tone === "ok" ? "mt-2 text-2xl font-semibold text-emerald-600" : "mt-2 text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}
