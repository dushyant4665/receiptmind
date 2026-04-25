const testimonials = [
  {
    name: "Sarah Chen",
    role: "Freelance Designer",
    content:
      "I used to spend four hours every month on expense reports. ReceiptMind does it in under a minute and the exports are accountant-ready.",
    avatar: "SC",
  },
  {
    name: "Michael Rodriguez",
    role: "Small Business Owner",
    content:
      "Tax season stopped being chaos. We just export everything to CSV and QuickBooks, and our bookkeeper actually trusts the data.",
    avatar: "MR",
  },
  {
    name: "David Kim",
    role: "Accounting Advisor",
    content:
      "I recommend ReceiptMind to every client who hates manual entry. It saves us hours every week and reduces category cleanup dramatically.",
    avatar: "DK",
  },
];

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="border-t border-border-default bg-bg-surface px-4 py-20 md:px-8"
    >
      <div className="mx-auto max-w-[860px]">
        <div className="mx-auto mb-12 max-w-[520px] text-center">
          <p className="inline-flex items-center rounded-[16px] border border-border-default px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Proof
          </p>
          <h2 className="mt-5 font-heading text-[36px] leading-[1.12] tracking-[-0.2px] text-text-primary">
            Loved by finance teams
          </h2>
          <p className="mt-3 text-[15px] leading-[1.65] text-text-muted">
            From solo founders to accounting advisors, customers use ReceiptMind to reclaim time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <article
              key={testimonial.name}
              className="rounded-[12px] border border-border-default bg-bg-surface p-6"
            >
              <div className="mb-3.5 flex gap-[3px]" aria-label="Five star rating">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <span key={starIndex} className="size-[5px] rounded-full bg-amber" />
                ))}
              </div>
              <p className="text-[13px] italic leading-[1.6] text-text-secondary">
                {testimonial.content}
              </p>
              <div className="mt-5 h-px bg-border-subtle" />
              <div className="mt-4 flex items-center gap-2.5">
                <span
                  className={`flex size-[34px] items-center justify-center rounded-full border border-border-default text-[11px] font-medium ${
                    index === 0
                      ? "bg-bg-subtle text-text-secondary"
                      : index === 1
                        ? "bg-amber-surface text-amber"
                        : "bg-success-surface text-success"
                  }`}
                >
                  {testimonial.avatar}
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
  );
}
