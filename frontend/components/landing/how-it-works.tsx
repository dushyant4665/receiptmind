import { Cpu, Download, UploadCloud } from "lucide-react";

const steps = [
  {
    icon: UploadCloud,
    title: "Upload",
    description: "Add receipt photos, invoices, or PDFs from the dashboard upload flow.",
  },
  {
    icon: Cpu,
    title: "Extract",
    description: "AI reads the document and turns messy input into structured expense fields.",
  },
  {
    icon: Download,
    title: "Review and export",
    description: "Resolve exceptions, apply rules, and download CSV output when the data is ready.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="workflow"
      className="border-y border-border-default bg-bg-surface px-4 py-20 md:px-8"
    >
      <div className="mx-auto max-w-[860px]">
        <div className="mx-auto mb-12 max-w-[520px] text-center">
          <p className="inline-flex items-center rounded-[16px] border border-border-default px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Workflow
          </p>
          <h2 className="mt-5 font-heading text-[36px] leading-[1.12] tracking-[-0.2px] text-text-primary">
            A simple operating loop
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-text-muted">
            Designed for speed while keeping the review checkpoints visible.
          </p>
        </div>

        <div className="mx-auto grid max-w-[700px] grid-cols-1 overflow-hidden rounded-[12px] border border-border-default md:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="border-b border-border-subtle bg-bg-surface px-7 py-8 text-center last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <p className="mb-3 text-[11px] font-medium text-text-ghost">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border-default bg-bg-page text-text-secondary">
                <step.icon className="size-5" strokeWidth={1.5} />
              </div>
              <h3 className="font-sans text-[14px] font-medium text-text-primary">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-text-muted">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
