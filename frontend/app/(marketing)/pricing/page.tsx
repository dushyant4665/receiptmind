"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const pricingPlans = {
  monthly: {
    free: "$0",
    pro: "$29",
    enterprise: "$99",
  },
  yearly: {
    free: "$0",
    pro: "$290",
    enterprise: "$990",
  },
};

const pricingCards = [
  {
    name: "Free",
    description: "Perfect for trying us out",
    detail: "No credit card required",
    cta: "Get started",
    href: "/signup",
    featured: false,
    features: ["10 receipts/month", "Manual upload only", "CSV export", "Email support"],
  },
  {
    name: "Pro",
    description: "For serious freelancers",
    detail: "14-day free trial, then $29/mo",
    cta: "Start free trial",
    href: "/signup",
    featured: true,
    features: [
      "Unlimited receipts",
      "Gmail auto-fetch",
      "QuickBooks integration",
      "Priority support",
      "Analytics dashboard",
    ],
  },
  {
    name: "Enterprise",
    description: "For teams and businesses",
    detail: "Custom volume discounts available",
    cta: "Contact sales",
    href: "/contact",
    featured: false,
    features: [
      "Everything in Pro",
      "Multi-user access",
      "API access",
      "SLA guarantee",
      "Custom onboarding",
    ],
  },
];

const featureSections = [
  {
    title: "Receipts",
    rows: [
      ["Receipts per month", "10", "Unlimited", "Unlimited"],
      ["Bulk upload (up to)", "5 files", "20 files", "100 files"],
      ["File formats", "4", "28", "28"],
      ["Image enhancement", "-", "check", "check"],
    ],
  },
  {
    title: "Automation",
    rows: [
      ["Gmail auto-fetch", "-", "check", "check"],
      ["Auto-categorization", "Basic", "Advanced", "Advanced"],
      ["Duplicate detection", "-", "check", "check"],
      ["Custom rules", "-", "-", "check"],
    ],
  },
  {
    title: "Integrations",
    rows: [
      ["CSV / Excel export", "check", "check", "check"],
      ["QuickBooks integration", "-", "check", "check"],
      ["Xero integration", "-", "check", "check"],
      ["API access", "-", "-", "check"],
      ["Zapier connector", "-", "check", "check"],
    ],
  },
  {
    title: "Security",
    rows: [
      ["Encryption at rest", "check", "check", "check"],
      ["Role-based access", "-", "-", "check"],
      ["Audit log", "-", "7 days", "90 days"],
      ["SSO / SAML", "-", "-", "check"],
      ["Custom data retention", "-", "-", "check"],
    ],
  },
  {
    title: "Support",
    rows: [
      ["Email support", "check", "check", "check"],
      ["Priority support", "-", "check", "check"],
      ["Dedicated CSM", "-", "-", "check"],
      ["Custom onboarding", "-", "-", "check"],
      ["SLA guarantee", "-", "-", "check"],
    ],
  },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your billing settings at any time. You'll keep access until the end of your current billing period.",
  },
  {
    q: "What happens when I hit the free receipt limit?",
    a: "You'll see a soft warning at 8 receipts. At 10, uploads pause until you upgrade or wait for the next month's reset.",
  },
  {
    q: "Does ReceiptMind store my receipt images?",
    a: "Yes, encrypted. You can delete them any time. We retain for 90 days after deletion for recovery, then permanent purge.",
  },
  {
    q: "Can I import receipts from before I signed up?",
    a: "Yes. Upload any historical receipts on the Pro plan. There's no limit on receipt age.",
  },
  {
    q: "Do you support team accounts?",
    a: "Team accounts are on the Enterprise plan. You can add up to 50 members with role-based permissions.",
  },
  {
    q: "Is there a discount for annual billing?",
    a: "Yes - 17% off when you pay yearly.",
  },
];

function FeatureCell({ value }: { value: string }) {
  if (value === "check") {
    return (
      <span className="flex size-[14px] items-center justify-center rounded-full bg-success text-white">
        <Check className="size-2.5" />
      </span>
    );
  }

  if (value === "-") {
    return <span className="text-text-ghost">-</span>;
  }

  return <span>{value}</span>;
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const prices = yearly ? pricingPlans.yearly : pricingPlans.monthly;

  return (
    <main className="bg-bg-page">
      <section className="px-4 pb-12 pt-[72px] md:px-8">
        <div className="mx-auto max-w-[620px] text-center">
          <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Pricing
          </p>
          <h1 className="mt-5 font-heading text-[40px] leading-[1.08] tracking-[-0.8px] text-text-primary md:text-[44px]">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            Start free, scale when you need automation, move to enterprise controls when your
            team grows.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16 md:px-8">
        <div className="mx-auto flex max-w-[820px] items-center justify-center gap-3 text-[13px]">
          <span className={yearly ? "text-text-muted" : "font-medium text-text-primary"}>Monthly</span>
          <button
            type="button"
            onClick={() => setYearly((value) => !value)}
            className="relative h-[22px] w-10 rounded-[11px] bg-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
            aria-label="Toggle yearly billing"
          >
            <span
              className={[
                "absolute top-0.5 size-[18px] rounded-full bg-white transition-[transform]",
                yearly ? "translate-x-5" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
          <span className={yearly ? "font-medium text-text-primary" : "text-text-muted"}>Yearly</span>
          {yearly ? (
            <span className="rounded-[4px] bg-success-surface px-2 py-1 text-[11px] font-medium text-success">
              Save 17%
            </span>
          ) : null}
        </div>

        <div className="mx-auto mt-10 grid max-w-[960px] grid-cols-1 gap-3 lg:grid-cols-3">
          {pricingCards.map((plan) => {
            const price =
              plan.name === "Free"
                ? prices.free
                : plan.name === "Pro"
                  ? prices.pro
                  : prices.enterprise;

            return (
              <article
                key={plan.name}
                className={[
                  "rounded-[12px] border bg-bg-surface p-6",
                  plan.featured ? "border-text-primary" : "border-border-default",
                ].join(" ")}
              >
                {plan.featured ? (
                  <span className="mb-4 inline-block rounded-[4px] bg-bg-subtle px-3 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
                    Most popular
                  </span>
                ) : null}
                <p
                  className={[
                    "text-[12px] font-medium uppercase tracking-[0.06em]",
                    plan.featured ? "text-amber" : "text-text-ghost",
                  ].join(" ")}
                >
                  {plan.name}
                </p>
                <p className="mt-1 text-[12px] text-text-muted">{plan.description}</p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-heading text-[36px] leading-none tracking-[-1.5px] text-text-primary transition-[opacity]">
                    {price}
                  </span>
                  <span className="pb-1 text-[13px] text-text-muted">
                    {plan.name === "Free" ? "" : yearly ? "/year" : "/month"}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-text-muted">{plan.detail}</p>
                <div className="my-4 h-px bg-border-subtle" />
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-[13px] text-text-secondary">
                      <span className="flex size-[15px] items-center justify-center rounded-full bg-success-surface text-success">
                        <Check className="size-2.5" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={plan.featured ? "default" : "ghost"} className="mt-5 w-full">
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border-default bg-bg-surface px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[820px]">
          <h2 className="text-[18px] font-medium text-text-primary">Compare all features</h2>
          <div className="mt-8 overflow-x-auto rounded-[12px] border border-border-default bg-bg-surface">
            <table className="w-full">
              <thead className="bg-bg-page">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-text-ghost">
                    Feature
                  </th>
                  {[
                    ["Free", prices.free],
                    ["Pro", prices.pro],
                    ["Enterprise", prices.enterprise],
                  ].map(([plan, price]) => (
                    <th
                      key={plan}
                      className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-text-ghost"
                    >
                      <div>{plan}</div>
                      <div className="mt-1 text-[12px] font-normal normal-case tracking-normal text-text-muted">
                        {price}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureSections.map((section) => (
                  <Fragment key={section.title}>
                    <tr>
                      <td
                        colSpan={4}
                        className="bg-bg-page px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-ghost"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row[0]} className="border-t border-border-subtle">
                        <td className="px-4 py-3 text-[13px] text-text-secondary">{row[0]}</td>
                        {row.slice(1).map((cell, index) => (
                          <td key={`${row[0]}-${index}`} className="px-4 py-3 text-[13px] text-text-secondary">
                            <FeatureCell value={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[640px]">
          <h2 className="text-center font-heading text-[32px] text-text-primary">
            Frequently asked questions
          </h2>
          <div className="mt-8">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              return (
                <div key={faq.q} className="border-b border-border-default py-4">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left text-[14px] font-medium text-text-primary"
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span>{faq.q}</span>
                    {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
                  </button>
                  {open ? <p className="pt-3 text-[13px] leading-[1.6] text-text-muted">{faq.a}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border-default px-4 py-24 md:px-8">
        <div className="mx-auto max-w-[520px] text-center">
          <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
            Ready to stop wasting 8 hours a month?
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            Start with the free plan and move up only when the workflow earns it.
          </p>
          <p className="mt-8">
            <Link
              href="/signup"
              className="inline-flex rounded-[8px] bg-amber px-4 py-2 text-[13px] font-medium text-white transition-[background-color] hover:bg-amber-hover"
            >
              Try free - no card needed
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
