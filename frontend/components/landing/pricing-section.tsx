"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = {
  monthly: [
    {
      name: "Free",
      price: "$0",
      period: "",
      description: "Perfect for trying us out",
      cta: "Get Started",
      featured: false,
      features: [
        { label: "10 receipts/month", included: true },
        { label: "Email forwarding", included: true },
        { label: "Google Sheets sync", included: true },
        { label: "CSV export", included: true },
      ],
    },
    {
      name: "Pro",
      price: "$19",
      period: "/month",
      description: "For freelancers and small teams",
      cta: "Continue automation",
      featured: true,
      features: [
        { label: "Unlimited receipts", included: true },
        { label: "Daily digest emails", included: true },
        { label: "Advanced rule learning", included: true },
        { label: "Accountant-ready exports", included: true },
        { label: "Priority processing", included: true },
      ],
    },
    {
      name: "Accountant",
      price: "$79",
      period: "/month",
      description: "For bookkeepers and CA firms",
      cta: "Contact Sales",
      featured: false,
      features: [
        { label: "Everything in Pro", included: true },
        { label: "Multi-client workspace", included: true },
        { label: "Exception review queues", included: true },
        { label: "Audit logs", included: true },
        { label: "Client exports", included: true },
      ],
    },
  ],
  yearly: [
    {
      name: "Free",
      price: "$0",
      period: "",
      description: "Perfect for trying us out",
      cta: "Get Started",
      featured: false,
      features: [
        { label: "10 receipts/month", included: true },
        { label: "Email forwarding", included: true },
        { label: "Google Sheets sync", included: true },
        { label: "CSV export", included: true },
      ],
    },
    {
      name: "Pro",
      price: "$190",
      period: "/year",
      description: "For freelancers and small teams",
      cta: "Continue automation",
      featured: true,
      features: [
        { label: "Unlimited receipts", included: true },
        { label: "Daily digest emails", included: true },
        { label: "Advanced rule learning", included: true },
        { label: "Accountant-ready exports", included: true },
        { label: "Priority processing", included: true },
      ],
    },
    {
      name: "Accountant",
      price: "$790",
      period: "/year",
      description: "For bookkeepers and CA firms",
      cta: "Contact Sales",
      featured: false,
      features: [
        { label: "Everything in Pro", included: true },
        { label: "Multi-client workspace", included: true },
        { label: "Exception review queues", included: true },
        { label: "Audit logs", included: true },
        { label: "Client exports", included: true },
      ],
    },
  ],
};

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);
  const currentPlans = isYearly ? plans.yearly : plans.monthly;

  return (
    <section id="pricing" className="bg-bg-page px-4 py-20 md:px-8">
      <div className="mx-auto max-w-[860px]">
        <div className="mx-auto mb-10 max-w-[560px] text-center">
          <p className="inline-flex items-center rounded-[16px] border border-border-default px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Pricing
          </p>
          <h2 className="mt-5 font-heading text-[36px] leading-[1.12] tracking-[-0.2px] text-text-primary">
            Pricing for bookkeeping automation
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-text-muted">
            Start free, then pay when ReceiptMind is already removing recurring bookkeeping work.
          </p>
        </div>

        <div className="mb-10 flex items-center justify-center gap-2.5 text-[13px]">
          <span className={isYearly ? "text-text-muted" : "font-medium text-text-primary"}>Monthly</span>
          <button
            type="button"
            aria-label="Toggle yearly billing"
            aria-pressed={isYearly}
            onClick={() => setIsYearly((value) => !value)}
            className="relative h-[22px] w-10 cursor-pointer rounded-[11px] bg-text-primary transition-[opacity] hover:opacity-82 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
          >
            <span
              className={`absolute top-0.5 size-[18px] rounded-full bg-white transition-[transform] ${
                isYearly ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={isYearly ? "font-medium text-text-primary" : "text-text-muted"}>Yearly</span>
          <span className="rounded-[4px] bg-success-surface px-2 py-0.5 text-[11px] font-medium text-success">
            Save 17%
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {currentPlans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-[12px] border bg-bg-surface p-6 ${
                plan.featured ? "border-text-primary" : "border-border-default"
              }`}
            >
              {plan.featured && (
                <span className="mb-4 inline-block rounded-[4px] bg-bg-subtle px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
                  Most popular
                </span>
              )}

              <p
                className={`text-[12px] font-medium uppercase tracking-[0.06em] ${
                  plan.featured ? "text-amber" : "text-text-ghost"
                }`}
              >
                {plan.name}
              </p>
              <p className="mt-1 text-[12px] text-text-muted">{plan.description}</p>

              <div className="mt-4 flex items-baseline gap-0.5">
                <span className="font-heading text-[36px] leading-none tracking-[-1.5px] text-text-primary">
                  {plan.price}
                </span>
                <span className="text-[13px] text-text-muted">{plan.period}</span>
              </div>

              <div className="my-4 h-px bg-border-subtle" />

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-2 text-[13px] text-text-secondary">
                    <span
                      className={`flex size-[15px] shrink-0 items-center justify-center rounded-full ${
                        feature.included
                          ? "bg-success-surface text-success"
                          : "bg-bg-subtle text-text-ghost"
                      }`}
                    >
                      {feature.included ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                    </span>
                    {feature.label}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.featured ? "default" : "ghost"}
                className="mt-5 w-full"
                asChild
              >
                <Link href={plan.name === "Accountant" ? "/contact" : "/signup"}>{plan.cta}</Link>
              </Button>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-[13px] text-text-muted">
          Need a custom plan?{" "}
          <Link href="/contact" className="text-amber underline underline-offset-4 hover:text-amber-hover">
            Contact our sales team
          </Link>
        </p>
      </div>
    </section>
  );
}
