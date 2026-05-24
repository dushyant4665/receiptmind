import Link from "next/link";
import { ArrowRight, Camera, Cpu, Download, Mail, Play, UploadCloud, Zap } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";

const featurePreview = [
  {
    icon: Camera,
    title: "AI-powered OCR",
    body: "99.2% accuracy on receipts, invoices, and bills. Extract vendor, amount, date, category, and tax automatically.",
  },
  {
    icon: Zap,
    title: "30-second processing",
    body: "Upload a photo. Get structured data. Export instantly. No manual entry. No spreadsheet cleanup.",
  },
  {
    icon: Mail,
    title: "Gmail auto-fetch",
    body: "Connect inboxes and let ReceiptMind discover receipt emails, attachments, and forwarding aliases.",
  },
];

const steps = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Upload",
    body: "Drag and drop any receipt photo or PDF. Bulk upload up to 20 files at once.",
  },
  {
    number: "02",
    icon: Cpu,
    title: "AI processing",
    body: "Our AI extracts vendor, amount, date, category, and policy hints with 99.2% accuracy.",
  },
  {
    number: "03",
    icon: Download,
    title: "Download",
    body: "Export clean CSV or Excel files, or send the structured data straight to your accounting stack.",
  },
];

const stats = [
  { value: "99.2%", label: "Extraction accuracy" },
  { value: "30 sec", label: "Average processing time" },
  { value: "8.2 hrs", label: "Saved per month per user" },
  { value: "28 formats", label: "Receipt types supported" },
];

const testimonials = [
  {
    initials: "SC",
    name: "Sarah Chen",
    role: "Freelance Designer",
    quote:
      "I used to spend four hours every month on expense reports. ReceiptMind does it in under a minute and the exports are accountant-ready.",
  },
  {
    initials: "MR",
    name: "Michael Rodriguez",
    role: "Small Business Owner",
    quote:
      "Tax season stopped being chaos. We just export everything to CSV and QuickBooks, and our bookkeeper actually trusts the data.",
  },
  {
    initials: "DK",
    name: "David Kim",
    role: "Accounting Advisor",
    quote:
      "I recommend ReceiptMind to every client who hates manual entry. It saves us hours every week and reduces category cleanup dramatically.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-page">
      <Navbar />
      <main className="bg-bg-page">
        <section className="px-4 pb-20 pt-24 md:px-8">
          <div className="mx-auto max-w-[640px] text-center">
            <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Receipt intelligence
            </p>
            <h1 className="mt-6 font-heading text-[40px] leading-[1.04] tracking-[-0.8px] text-text-primary md:text-[52px] md:tracking-[-1px]">
              Stop typing.
              <br />
              <em className="italic text-amber">Start uploading.</em>
            </h1>
            <p className="mx-auto mt-4 max-w-[420px] text-[16px] leading-[1.65] text-text-muted">
              AI reads your receipts, extracts every number, and hands you a clean spreadsheet.
              Tax season done in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="amber">
                <Link href="/signup">Try free - no card needed</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/features" className="inline-flex items-center gap-2">
                  See features
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-[12px] text-text-ghost">
              10 receipts free · No credit card · Cancel anytime
            </p>
          </div>
        </section>

        <section className="border-y border-border-default bg-bg-surface px-4 py-6 md:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-text-ghost">
              Trusted by teams at
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {/* illustrative examples only */}
              {["Notion", "Stripe", "Linear", "Vercel", "Figma"].map((company) => (
                <span key={company} className="font-heading text-[18px] text-text-ghost">
                  {company}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-bg-invert px-4 py-16 md:px-8">
          <div className="mx-auto max-w-[720px] text-center">
            <p className="inline-flex rounded-[20px] border border-border-invert px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#666662]">
              Live workflow
            </p>
            <h2 className="mt-5 font-heading text-[32px] leading-[1.15] text-text-invert">
              See ReceiptMind work in 30 seconds
            </h2>
            <div className="mx-auto mt-8 flex aspect-video max-w-[680px] flex-col items-center justify-center rounded-[12px] border border-border-invert bg-[#141412] px-8">
              <span className="mb-4 flex size-10 items-center justify-center rounded-full border border-[#333333] text-[#555552]">
                <Play className="ml-px size-4 fill-current" />
              </span>
              <p className="text-[13px] text-[#555552]">Demo video placeholder</p>
            </div>
          </div>
        </section>

        <section className="border-y border-border-default bg-bg-surface px-4 py-20 md:px-8">
          <div className="mx-auto max-w-[700px] text-center">
            <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Workflow
            </p>
            <h2 className="mt-5 font-heading text-[36px] leading-[1.12] text-text-primary">
              Three simple steps
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.65] text-text-muted">
              Designed for speed on mobile, clarity for finance, and exports your accountant can
              trust.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-[700px] grid-cols-1 border border-border-default md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.number}
                className={[
                  "px-7 py-8 text-center",
                  index < steps.length - 1 ? "border-b border-border-subtle md:border-b-0 md:border-r" : "",
                ].join(" ")}
              >
                <p className="text-[11px] font-medium text-text-ghost">{step.number}</p>
                <div className="mx-auto mb-4 mt-4 flex size-12 items-center justify-center rounded-full border border-border-default bg-bg-page text-text-secondary">
                  <step.icon className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-[14px] font-medium text-text-primary">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.55] text-text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 py-12 md:px-8">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center md:gap-0">
            {stats.map((stat, index) => (
              <div key={stat.label} className="contents">
                <div className="text-center">
                  <p className="font-heading text-[40px] leading-none text-text-primary">{stat.value}</p>
                  <p className="mt-2 text-[13px] text-text-muted">{stat.label}</p>
                </div>
                {index < stats.length - 1 ? (
                  <div className="mx-auto hidden h-10 w-px bg-border-default md:block" />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 py-20 md:px-8">
          <div className="mx-auto max-w-[860px]">
            <div className="mx-auto max-w-[520px] text-center">
              <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Capabilities
              </p>
              <h2 className="mt-5 font-heading text-[36px] leading-[1.12] text-text-primary">
                A cleaner way to manage receipt-heavy workflows
              </h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
                Built to keep the upload-to-export path obvious, accurate, and accountant-ready.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3">
              {featurePreview.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-[12px] border border-border-default bg-bg-surface p-6 transition-[border-color] hover:border-border-strong"
                >
                  <div className="mb-4 flex size-9 items-center justify-center rounded-[8px] border border-border-default bg-bg-page text-text-secondary">
                    <feature.icon className="size-[18px]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[14px] font-medium text-text-primary">{feature.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.55] text-text-muted">{feature.body}</p>
                </article>
              ))}
            </div>

            <p className="mt-6 text-center">
              <Link href="/features" className="text-[13px] text-amber transition-[color] hover:text-amber-hover">
                See all features -&gt;
              </Link>
            </p>
          </div>
        </section>

        <section className="border-t border-border-default bg-bg-surface px-4 py-20 md:px-8">
          <div className="mx-auto max-w-[860px]">
            <div className="mx-auto max-w-[520px] text-center">
              <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Proof
              </p>
              <h2 className="mt-5 font-heading text-[36px] leading-[1.12] text-text-primary">
                Loved by finance teams
              </h2>
              <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
                From solo founders to accounting advisors, customers use ReceiptMind to reclaim
                time.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <article key={testimonial.name} className="rounded-[12px] border border-border-default bg-bg-surface p-6">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <span key={starIndex} className="size-[5px] rounded-full bg-amber" />
                    ))}
                  </div>
                  <p className="mt-4 text-[13px] italic leading-[1.6] text-text-secondary">
                    {testimonial.quote}
                  </p>
                  <div className="mt-5 h-px bg-border-subtle" />
                  <div className="mt-4 flex items-center gap-3">
                    <span
                      className={[
                        "flex size-[34px] items-center justify-center rounded-full border border-border-default text-[11px] font-medium",
                        index === 0
                          ? "bg-bg-subtle text-text-secondary"
                          : index === 1
                            ? "bg-amber-surface text-amber"
                            : "bg-success-surface text-success",
                      ].join(" ")}
                    >
                      {testimonial.initials}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-text-primary">{testimonial.name}</p>
                      <p className="text-[12px] text-text-muted">{testimonial.role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border-default px-4 py-24 md:px-8">
          <div className="mx-auto max-w-[520px] text-center">
            <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
              Ready to save 8 to 12 hours every month?
            </h2>
            <p className="mx-auto mt-4 max-w-[400px] text-[15px] leading-[1.65] text-text-muted">
              Join finance teams that want one reliable workflow from upload to export.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="amber">
                <Link href="/signup">Try free - no card needed</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/features" className="inline-flex items-center gap-2">
                  See features
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-[12px] text-text-ghost">No credit card required. Free tier available.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
