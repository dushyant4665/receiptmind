import { AlertTriangle, BarChart3, Camera, FileDown, ShieldCheck, Zap } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "AI-powered OCR",
    description:
      "Extract vendor, amount, date, category, and tax fields from receipts, invoices, PDFs, and photos.",
  },
  {
    icon: Zap,
    title: "Fast processing",
    description:
      "Move files from upload to structured expense records with clear status and confidence signals.",
  },
  {
    icon: AlertTriangle,
    title: "Exception review",
    description:
      "Flag low-confidence fields and missing details before they become export or reimbursement problems.",
  },
  {
    icon: ShieldCheck,
    title: "Verified accounts",
    description:
      "Email verification and password reset flows keep accounts cleaner without adding friction to onboarding.",
  },
  {
    icon: FileDown,
    title: "CSV exports",
    description:
      "Export normalized expense data for bookkeeping, reporting, and downstream finance cleanup.",
  },
  {
    icon: BarChart3,
    title: "Analytics dashboard",
    description:
      "Track spend, receipt volume, review status, and recent activity from a clean dashboard surface.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-bg-page px-4 py-20 md:px-8">
      <div className="mx-auto max-w-[860px]">
        <div className="mx-auto mb-12 max-w-[520px] text-center">
          <p className="inline-flex items-center rounded-[16px] border border-border-default px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Capabilities
          </p>
          <h2 className="mt-5 font-heading text-[36px] leading-[1.12] tracking-[-0.2px] text-text-primary">
            Built around the work that actually happens.
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-text-muted">
            ReceiptMind focuses on the practical loop: extraction, review, rules, exports, and visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="fade-up rounded-[12px] border border-border-default bg-bg-surface p-6 transition-[border-color] hover:border-border-strong"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-[8px] border border-border-default bg-bg-page text-text-secondary">
                <feature.icon className="size-[18px]" strokeWidth={1.5} />
              </div>
              <h3 className="font-sans text-[14px] font-medium tracking-[-0.1px] text-text-primary">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-text-muted">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
