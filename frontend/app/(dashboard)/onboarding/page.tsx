"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Copy, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboardingStatus } from "@/hooks/use-onboarding";

export default function OnboardingPage() {
  const { data, isLoading } = useOnboardingStatus();

  const copyEmail = async () => {
    if (!data?.forwarding_email) return;
    await navigator.clipboard.writeText(data.forwarding_email);
    toast.success("Forwarding email copied");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-lg border border-border-default bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber">Setup</p>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary">Make bookkeeping run in the background</h1>
            <p className="mt-1 max-w-xl text-[13px] leading-6 text-text-muted">
              Connect the workflow once. After that, forwarding receipts should be enough.
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-10 w-36" />
          ) : (
            <Button asChild>
              <Link href={data?.next_action.href ?? "/receipts"}>{data?.next_action.label ?? "Upload first receipt"}</Link>
            </Button>
          )}
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-bg-page">
          <div
            className="h-full rounded-full bg-amber transition-all"
            style={{ width: `${data ? Math.round((data.completed / data.total) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-text-muted">
          {isLoading ? "Checking setup..." : `${data?.completed ?? 0} of ${data?.total ?? 0} automation steps complete`}
        </p>
      </section>

      <section className="rounded-lg border border-border-default bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-surface">
            <Mail className="size-4 text-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Your forwarding email</h2>
            <p className="mt-1 text-[12px] text-text-muted">Forward receipts here. ReceiptMind extracts, categorizes, syncs, and summarizes.</p>
            <div className="mt-3 flex gap-2">
              {isLoading ? (
                <Skeleton className="h-9 flex-1" />
              ) : (
                <div className="flex-1 rounded-md border border-border-default bg-bg-page px-3 py-2 font-mono text-[12px] text-text-primary">
                  {data?.forwarding_email}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={copyEmail} disabled={!data?.forwarding_email}>
                <Copy className="mr-2 size-4" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)
          : data?.steps.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className="flex items-center gap-4 rounded-lg border border-border-default bg-white p-4 transition-colors hover:bg-bg-subtle"
              >
                {step.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-text-ghost" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-text-primary">{step.title}</p>
                  <p className="mt-1 truncate text-[12px] text-text-muted">{step.description}</p>
                </div>
              </Link>
            ))}
      </section>

      {data?.magic_moment && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 text-emerald-700" />
            <div>
              <h2 className="text-sm font-semibold text-emerald-900">Automation is live</h2>
              <p className="mt-1 text-[13px] text-emerald-800">
                Your first receipt has been processed and your spreadsheet connection is ready.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
