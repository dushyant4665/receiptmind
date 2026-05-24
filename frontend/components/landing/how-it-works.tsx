import { UploadCloud, CheckCircle2, Download } from "lucide-react";

const steps = [
  {
    icon: UploadCloud,
    title: "Upload & Queue",
    description: "Drop receipts via the UI. Uploads are hashed to prevent duplicates, then pushed to a Redis Bull queue.",
  },
  {
    icon: CheckCircle2,
    title: "AI Extract & Review",
    description: "Gemini AI extracts data in the background. Low confidence results (<75%) are routed to the Exceptions Inbox.",
  },
  {
    icon: Download,
    title: "Categorize & Export",
    description: "The Rules Engine auto-applies categories based on vendor names. Clean data is instantly ready for CSV export.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="workflow"
      className="border-y border-border-subtle bg-bg-surface px-6 py-24 md:px-10"
    >
      <div className="mx-auto max-w-[1000px]">
        <div className="mx-auto mb-16 max-w-[600px] text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            How it actually works
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
            A transparent, automated pipeline designed for accounting accuracy.
          </p>
        </div>

        <div className="mx-auto grid max-w-[900px] grid-cols-1 overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm md:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="border-b border-border-subtle px-8 py-10 text-center last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-xl bg-bg-page border border-border-subtle text-text-primary">
                <step.icon className="size-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight text-text-primary">{step.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
