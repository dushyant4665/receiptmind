"use client";

import { useBillingPlans, useBillingStatus, useCreateCheckout } from "@/hooks/use-billing";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Users, Sparkles } from "lucide-react";

function PlanBadge({ plan }: { plan: string }) {
  const icons = {
    free: <Sparkles className="size-4" />,
    pro: <Crown className="size-4" />,
    accountant: <Users className="size-4" />,
    team: <Users className="size-4" />,
  };

  const colors = {
    free: "bg-slate-100 text-slate-700",
    pro: "bg-amber-100 text-amber-700",
    accountant: "bg-emerald-100 text-emerald-700",
    team: "bg-emerald-100 text-emerald-700",
  };

  return (
    <Badge className={`${colors[plan as keyof typeof colors] ?? colors.free} gap-1.5 capitalize`}>
      {icons[plan as keyof typeof icons] ?? icons.free}
      {plan}
    </Badge>
  );
}

export default function BillingPage() {
  const { data: status, isLoading } = useBillingStatus();
  const { data: plans } = useBillingPlans();
  const { mutate: createCheckout, isPending: isUpgrading } = useCreateCheckout();

  const used = status?.receipt_count_this_month ?? 0;
  const limit = status?.receipt_limit ?? 10;
  const percentage = limit ? Math.min((used / limit) * 100, 100) : 100;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-default bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber">Billing</p>
            <h1 className="mt-2 text-xl font-semibold text-text-primary">Pay for automation, not OCR</h1>
            <div className="mt-3">
              {isLoading ? <div className="h-6 w-24 animate-pulse rounded bg-bg-page" /> : <PlanBadge plan={status?.plan ?? "free"} />}
            </div>
            {status?.has_subscription && <p className="mt-2 text-[13px] text-text-muted">Subscribed · Stripe customer</p>}
          </div>
          {status?.plan === "free" && (
            <Button variant="amber" onClick={() => createCheckout("pro_monthly")} disabled={isUpgrading} className="shrink-0">
              {isUpgrading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Continue automation
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border-default bg-white p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Receipts this month</h2>
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-2 animate-pulse rounded bg-bg-page" />
              <div className="h-4 w-20 animate-pulse rounded bg-bg-page" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-text-secondary">{limit ? `${used} of ${limit} used` : `${used} processed · unlimited`}</span>
                {status?.plan === "free" && percentage >= 80 && (
                  <span className="font-medium text-amber">{percentage >= 100 ? "Automation paused" : "Approaching limit"}</span>
                )}
              </div>
              <Progress value={percentage} className="mt-2" />
              {status?.plan === "free" && (
                <p className="mt-2 text-[12px] text-text-muted">
                  {status.upgrade_reason || `Free includes ${limit} receipts/month, email forwarding, Google Sheets sync, and CSV export.`}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border-default bg-white p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Plans built around workflow value</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <div key={plan.id} className={`rounded-lg border p-4 ${plan.id === "pro" ? "border-amber bg-amber-50" : "border-border-default bg-bg-page"}`}>
              <p className="text-[14px] font-medium text-text-primary">{plan.name}</p>
              <p className="mt-1 text-[22px] font-semibold text-text-primary">
                ${plan.price}<span className="text-[12px] font-normal text-text-muted">/{plan.interval}</span>
              </p>
              <p className="mt-1 text-[12px] text-text-muted">{plan.audience}</p>
              <p className="mt-3 text-[12px] text-text-secondary">{plan.positioning}</p>
              <ul className="mt-3 space-y-1 text-[12px] text-text-secondary">
                {plan.features.map((feature) => <li key={feature}>· {feature}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
