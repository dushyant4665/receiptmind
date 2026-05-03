"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExceptions, useResolveException } from "@/hooks/use-exceptions";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const typeColors: Record<string, string> = {
  low_confidence: "bg-blue-surface text-blue",
  duplicate_suspected: "bg-amber-surface text-amber",
  amount_anomaly: "bg-red-surface text-red",
  missing_date: "bg-bg-subtle text-text-secondary",
  missing_vendor: "bg-bg-subtle text-text-secondary",
  policy_violation: "bg-purple-100 text-purple-700",
};

export default function ExceptionsPage() {
  const { data: exceptions, isLoading } = useExceptions();
  const { mutate: resolveException } = useResolveException();
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");

  const filtered = useMemo(() => {
    if (!exceptions) return [];
    return exceptions.filter((e) =>
      statusFilter === "open" ? e.status === "open" : e.status === "resolved"
    );
  }, [exceptions, statusFilter]);

  const openCount = exceptions?.filter((e) => e.status === "open").length ?? 0;
  const resolvedCount = exceptions?.filter((e) => e.status === "resolved").length ?? 0;

  const handleResolve = (id: string) => {
    resolveException(
      { id, resolution: "resolved" },
      {
        onSuccess: () => toast.success("Exception resolved"),
        onError: () => toast.error("Failed to resolve exception"),
      }
    );
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-[24px] font-heading text-text-primary tracking-tight">
          Exceptions Inbox
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Items that need your attention
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border-default bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Open</p>
          <p className="mt-1 text-[24px] font-heading text-text-primary">{openCount}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Resolved</p>
          <p className="mt-1 text-[24px] font-heading text-emerald">{resolvedCount}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Total</p>
          <p className="mt-1 text-[24px] font-heading text-text-primary">{exceptions?.length ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={statusFilter === "open" ? "default" : "outline"}
          onClick={() => setStatusFilter("open")}
          className="text-[12px]"
        >
          Open ({openCount})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "resolved" ? "default" : "outline"}
          onClick={() => setStatusFilter("resolved")}
          className="text-[12px]"
        >
          Resolved ({resolvedCount})
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-bg-subtle" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-white p-10 text-center shadow-xs">
          <CheckCircle2 className="mx-auto size-8 text-emerald" />
          <h3 className="mt-3 text-[14px] font-medium text-text-primary">All caught up!</h3>
          <p className="mt-1 text-[12px] text-text-muted">No {statusFilter} exceptions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exc) => (
            <div key={exc.id} className="rounded-lg border border-border-default bg-white p-4 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <AlertCircle className="size-4 text-amber" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", typeColors[exc.type] || "bg-bg-subtle text-text-secondary")}
                    >
                      {exc.type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[10px] text-text-ghost tabular-nums">
                      {new Date(exc.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[13px] font-medium text-text-primary">
                    {exc.field}: {exc.message}
                  </p>
                </div>

                {exc.status === "open" && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] rounded-md shrink-0"
                    onClick={() => handleResolve(exc.id)}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
