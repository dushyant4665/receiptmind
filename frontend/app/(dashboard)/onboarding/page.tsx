const steps = [
  ["1", "Connect email", "Sync your receipt inboxes so new purchases appear automatically."],
  ["2", "Upload first receipt", "Confirm extraction quality with a real document from your team."],
  ["3", "Connect accounting", "Map categories and start exporting into your bookkeeping flow."],
];

export default function OnboardingPage() {
  return (
    <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
      <h1 className="font-heading text-[26px] tracking-[-0.3px] text-text-primary">Set up ReceiptMind in three steps</h1>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {steps.map(([number, title, body]) => (
          <article key={number} className="rounded-[12px] border border-border-default bg-bg-page p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-text-ghost">{number}</p>
            <h2 className="mt-2 text-[14px] font-medium text-text-primary">{title}</h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-text-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
