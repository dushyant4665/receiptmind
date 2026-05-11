"use client";

import { Activity, AlertTriangle, Database, Timer } from "lucide-react";
import { useOpsHealth } from "@/hooks/use-ops";
import { Skeleton } from "@/components/ui/skeleton";

export default function OpsPage() {
  const { data, isLoading } = useOpsHealth();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber">Operations</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">Processing health</h1>
        <p className="mt-1 text-[13px] text-text-muted">Queue and worker visibility for the automation engine.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Database} label="Queue depth" value={data?.queue_depth ?? 0} />
          <Metric icon={Activity} label="Processing" value={data?.jobs_processing ?? 0} />
          <Metric icon={AlertTriangle} label="Failed 24h" value={data?.jobs_failed_24h ?? 0} tone={(data?.jobs_failed_24h ?? 0) > 0 ? "warn" : "ok"} />
          <Metric icon={Timer} label="Avg seconds" value={(data?.avg_processing_seconds ?? 0).toFixed(1)} />
        </div>
      )}

      <div className="rounded-lg border border-border-default bg-white p-4">
        <p className="text-sm font-semibold">Failure recovery</p>
        <p className="mt-1 text-[13px] text-text-muted">
          Failed processing jobs retry through Redis and move to the dead-letter queue after retries. Receipts stay stored, so uploads are not silently lost.
        </p>
        <p className="mt-3 text-[12px] text-text-ghost">Last checked: {data?.checked_at ? new Date(data.checked_at).toLocaleString() : "waiting for data"}</p>
      </div>

      <div className="rounded-lg border border-border-default bg-white p-4">
        <p className="text-sm font-semibold">Priority queues</p>
        <p className="mt-1 text-[13px] text-text-muted">Uploads and email receipts run high priority; background automation can wait when traffic spikes.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <QueuePill label="High" value={data?.queue_high ?? 0} />
          <QueuePill label="Default" value={data?.queue_default ?? 0} />
          <QueuePill label="Low" value={data?.queue_low ?? 0} />
        </div>
      </div>
    </div>
  );
}

function QueuePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-page px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-text-ghost">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: number | string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-text-ghost">{label}</p>
        <Icon className={tone === "warn" ? "size-4 text-amber" : tone === "ok" ? "size-4 text-emerald-600" : "size-4 text-text-ghost"} />
      </div>
      <p className={tone === "warn" ? "mt-3 text-2xl font-semibold text-amber" : tone === "ok" ? "mt-3 text-2xl font-semibold text-emerald-600" : "mt-3 text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}
