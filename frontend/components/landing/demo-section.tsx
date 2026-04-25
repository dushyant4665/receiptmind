export function DemoSection() {
  return (
    <section
      id="demo"
      className="border-y border-border-invert bg-bg-invert px-4 py-14 text-center md:px-8"
    >
      <div className="mx-auto max-w-[760px]">
        <p className="inline-flex items-center rounded-[16px] border border-border-invert px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#666662]">
          Live workflow
        </p>
        <h2 className="mt-5 font-heading text-[28px] leading-[1.2] text-text-invert">
          From messy receipt batch to clean export.
        </h2>
        <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-[1.6] text-[#666662]">
          Classify, enrich, review, and sync finance data without spreadsheet cleanup.
        </p>

        <div className="mx-auto mt-8 flex aspect-video max-w-[680px] items-center justify-center rounded-[12px] border border-border-invert bg-[#141412] px-8">
          <p className="max-w-[420px] text-center text-[13px] leading-[1.6] text-[#555552]">
            See ReceiptMind classify, enrich, and export a full batch in under a minute.
          </p>
        </div>
      </div>
    </section>
  );
}
