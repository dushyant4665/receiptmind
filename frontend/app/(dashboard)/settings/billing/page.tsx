"use client";

import { useBillingStatus, useCreateCheckout } from "@/hooks/use-billing";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Users, Sparkles } from "lucide-react";

function PlanBadge({ plan }: { plan: string }) {
  const icons = {
    free: <Sparkles className="size-4" />,
    pro: <Crown className="size-4" />,
    team: <Users className="size-4" />,
  };

  const colors = {
    free: "bg-slate-100 text-slate-700",
    pro: "bg-amber-100 text-amber-700",
    team: "bg-purple-100 text-purple-700",
  };

  return (
    <Badge className={`${colors[plan as keyof typeof colors]} gap-1.5 capitalize`}>
      {icons[plan as keyof typeof icons]}
      {plan}
    </Badge>
  );
}

export default function BillingPage() {
  const { data: status, isLoading } = useBillingStatus();
  const { mutate: createCheckout, isPending: isUpgrading } = useCreateCheckout();

  const used = status?.receipt_count_this_month ?? 0;
  const limit = status?.receipt_limit ?? 10;
  const percentage = Math.min((used / limit) * 100, 100);

  const handleUpgrade = () => {
    createCheckout("pro_monthly");
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-medium text-text-primary">Current plan</h2>
            <div className="mt-2">
              {isLoading ? (
                <div className="h-6 w-24 animate-pulse rounded bg-bg-page" />
              ) : (
                <PlanBadge plan={status?.plan ?? "free"} />
              )}
            </div>
            {status?.has_subscription && (
              <p className="mt-2 text-[13px] text-text-muted">Subscribed · Stripe customer</p>
            )}
          </div>
          {status?.plan === "free" && (
            <Button
              variant="amber"
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="shrink-0"
            >
              {isUpgrading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Upgrade to Pro
            </Button>
          )}
        </div>
      </section>

      {/* Usage */}
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
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
                <span className="text-text-secondary">
                  {used} of {limit} used
                </span>
                {status?.plan === "free" && percentage >= 80 && (
                  <span className="font-medium text-amber">
                    {percentage >= 100 ? "Limit reached" : "Approaching limit"}
                  </span>
                )}
              </div>
              <Progress value={percentage} className="mt-2" />
              {status?.plan === "free" && (
                <p className="mt-2 text-[12px] text-text-muted">
                  Free plan includes {limit} receipts per month. Upgrade for unlimited.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Plan Comparison */}
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Compare plans</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { name: "Free", price: "$0", receipts: "10/month", features: ["Basic extraction", "Email forwarding"] },
            { name: "Pro", price: "$19/mo", receipts: "Unlimited", features: ["AI extraction", "All integrations", "Priority support"], recommended: true },
            { name: "Team", price: "$49/mo", receipts: "Unlimited", features: ["Multiple users", "Team management", "SSO"] },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[10px] border p-4 ${
                plan.recommended
                  ? "border-amber bg-amber-50"
                  : "border-border-default bg-bg-page"
              }`}
            >
              <p className="text-[14px] font-medium text-text-primary">{plan.name}</p>
              <p className="mt-1 text-[20px] font-semibold text-text-primary">{plan.price}</p>
              <p className="text-[12px] text-text-muted">{plan.receipts}</p>
              <ul className="mt-3 space-y-1 text-[12px] text-text-secondary">
                {plan.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
