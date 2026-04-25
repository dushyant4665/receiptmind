import { Check, KeyRound, Lock, ScrollText, ShieldCheck, TimerReset } from "lucide-react";

const certificationCards = [
  ["SOC 2 Type II", "In progress - audit scheduled"],
  ["GDPR Compliant", "Full EU data rights support"],
  ["CCPA Ready", "California privacy compliance"],
  ["99.9% Uptime", "Target availability"],
];

const featureSections = [
  {
    eyebrow: "Encryption",
    title: "Your files stay encrypted end to end",
    body:
      "Receipt images and extracted fields are encrypted at rest and in transit. We treat every upload like financial data, because it is.",
    icon: Lock,
  },
  {
    eyebrow: "Access Controls",
    title: "Only the right people see the right data",
    body:
      "Admin, Editor, and Viewer roles let finance teams separate responsibilities without overexposing sensitive vendor and spend information.",
    icon: KeyRound,
  },
  {
    eyebrow: "Audit Logging",
    title: "Every important action leaves a trail",
    body:
      "Uploads, edits, exports, invites, and revocations are all logged so finance leaders can explain what happened and when.",
    icon: ScrollText,
  },
  {
    eyebrow: "Data Retention",
    title: "Retention rules that fit policy, not guesswork",
    body:
      "Configure deletion windows, enforce retention standards, and recover mistakes before final purge without losing control of the record.",
    icon: TimerReset,
  },
];

export default function SecurityPage() {
  return (
    <main className="bg-bg-page">
      <section className="px-4 pb-12 pt-20 md:px-8">
        <div className="mx-auto max-w-[600px] text-center">
          <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Security
          </p>
          <h1 className="mt-5 font-heading text-[40px] leading-[1.08] tracking-[-0.8px] text-text-primary md:text-[44px]">
            Your data. Locked down.
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            Enterprise-grade security isn&apos;t an add-on. It&apos;s how ReceiptMind was built
            from day one.
          </p>
        </div>
      </section>

      <section className="border-y border-border-default bg-bg-surface px-4 py-12 md:px-8">
        <div className="mx-auto grid max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {certificationCards.map(([title, subtitle]) => (
            <article key={title} className="rounded-[12px] border border-border-default bg-bg-surface p-5 text-center">
              <div className="mx-auto mb-4 flex size-9 items-center justify-center rounded-[8px] border border-border-default bg-bg-page text-text-secondary">
                <ShieldCheck className="size-5" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-medium text-text-primary">{title}</p>
              <p className="mt-2 text-[13px] leading-[1.6] text-text-muted">{subtitle}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="space-y-16 px-4 py-16 md:px-8">
        {featureSections.map((section, index) => (
          <section key={section.title}>
            <div
              className={[
                "mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2",
                index % 2 === 1 ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : "",
              ].join(" ")}
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-ghost">
                  {section.eyebrow}
                </p>
                <h2 className="mt-3 font-heading text-[32px] leading-[1.15] text-text-primary">
                  {section.title}
                </h2>
                <p className="mt-4 text-[15px] leading-[1.7] text-text-secondary">{section.body}</p>
              </div>
              <div className="rounded-[12px] border border-border-default bg-bg-surface p-6">
                <div className="rounded-[12px] border border-border-default bg-bg-page p-5">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-[8px] border border-border-default bg-bg-surface text-text-secondary">
                    <section.icon className="size-5" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    {["Policy enforced", "Finance visible", "Reviewable", "Auditable"].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-[8px] border border-border-subtle bg-bg-surface px-3 py-2"
                      >
                        <span className="flex size-4 items-center justify-center rounded-full bg-success-surface text-success">
                          <Check className="size-3" />
                        </span>
                        <span className="text-[13px] text-text-secondary">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="border-t border-border-default bg-bg-surface px-4 py-12 md:px-8">
        <div className="mx-auto max-w-[600px] text-center">
          <h2 className="font-heading text-[32px] text-text-primary">Report a vulnerability</h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            If you believe you&apos;ve found a security issue, contact our security team directly
            with details, reproduction steps, and impact.
          </p>
          <p className="mt-5 font-mono text-[12px] text-amber">security@receiptmind.com</p>
        </div>
      </section>
    </main>
  );
}
