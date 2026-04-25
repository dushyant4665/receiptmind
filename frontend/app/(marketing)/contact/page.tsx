import Link from "next/link";
import { BriefcaseBusiness, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const contactCards = [
  {
    icon: BriefcaseBusiness,
    title: "Talk to sales",
    body: "Get a demo, custom pricing, or answers about the Enterprise plan.",
    action: "Coming soon",
  },
  {
    icon: MessageCircle,
    title: "Get support",
    body: "For Pro users - typical response time under 2 hours.",
    action: "Coming soon",
  },
  {
    icon: Mail,
    title: "General enquiries",
    body: "For press, partnerships, or anything else.",
    email: "hello@receiptmind.io",
  },
];

export default function ContactPage() {
  return (
    <main className="bg-bg-page">
      <section className="px-4 pb-12 pt-16 md:px-8">
        <div className="mx-auto max-w-[520px] text-center">
          <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Contact
          </p>
          <h1 className="mt-5 font-heading text-[40px] leading-[1.08] tracking-[-0.8px] text-text-primary">
            We&apos;re here to help
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            Whether you have a billing question, need enterprise pricing, or just want a demo
            - reach the right person fast.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16 md:px-8">
        <div className="mx-auto grid max-w-[860px] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            {contactCards.map((card) => (
              <article key={card.title} className="rounded-[12px] border border-border-default bg-bg-surface p-5">
                <div className="mb-4 flex size-9 items-center justify-center rounded-[8px] border border-border-default bg-bg-page text-text-secondary">
                  <card.icon className="size-5" strokeWidth={1.5} />
                </div>
                <h2 className="text-[14px] font-medium text-text-primary">{card.title}</h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-text-muted">{card.body}</p>
                {card.email ? (
                  <p className="mt-4 font-mono text-[12px] text-amber">{card.email}</p>
                ) : (
                  <p className="mt-4 text-[13px] text-text-muted">{card.action}</p>
                )}
              </article>
            ))}
          </div>

          <div className="rounded-[12px] border border-border-default bg-bg-surface p-7">
            <h2 className="text-[15px] font-medium text-text-primary">Send us a message</h2>
            <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Contact form coming soon. Please email hello@receiptmind.io'); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                    First name
                  </Label>
                  <Input id="firstName" />
                </div>
                <div>
                  <Label htmlFor="lastName" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                    Last name
                  </Label>
                  <Input id="lastName" />
                </div>
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                  Work email
                </Label>
                <Input id="email" type="email" />
              </div>
              <div>
                <Label htmlFor="company" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                  Company
                </Label>
                <Input id="company" />
              </div>
              <div>
                <Label htmlFor="subject" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                  Subject
                </Label>
                <select
                  id="subject"
                  className="h-9 w-full rounded-[8px] border border-border-default bg-bg-surface px-3 text-[13px] text-text-primary outline-none transition-[border-color] hover:border-border-strong focus:border-text-primary"
                >
                  <option>Sales enquiry</option>
                  <option>Technical support</option>
                  <option>Billing question</option>
                  <option>Press/Partnership</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="message" className="mb-1.5 text-[12px] font-medium text-text-secondary">
                  Message
                </Label>
                <textarea
                  id="message"
                  className="min-h-[120px] w-full rounded-[8px] border border-border-default bg-bg-surface px-3 py-2 text-[13px] text-text-primary outline-none transition-[border-color] hover:border-border-strong focus:border-text-primary"
                />
              </div>
              <Button type="submit" variant="amber" className="w-full">
                Send message
              </Button>
            </form>
            <p className="mt-4 text-[12px] leading-[1.6] text-text-muted">
              We typically respond within 2 business hours for Pro users, 1 business day for
              free users.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border-default bg-bg-surface px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-[700px] gap-8 text-center md:grid-cols-3">
          {[
            ["RESPONSE TIME", "< 2 hours", "For Pro & Enterprise"],
            ["SUPPORT HOURS", "Mon - Fri", "9am - 6pm EST"],
            ["HEADQUARTERS", "San Francisco", "California, USA"],
          ].map(([label, value, sub]) => (
            <div key={label}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                {label}
              </p>
              <p className="mt-3 font-heading text-[24px] text-text-primary">{value}</p>
              <p className="mt-1 text-[13px] text-text-muted">{sub}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
