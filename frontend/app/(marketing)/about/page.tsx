import Link from "next/link";

const values = [
  {
    title: "Precision over features",
    body:
      "We ship fewer features but make each one 10x better. A single extraction that's 99.2% accurate beats five features that are 80% accurate.",
  },
  {
    title: "Trust is earned, not announced",
    body:
      "We don't ask you to trust us because we say we're secure. We show you the audit logs, the certifications, and the architecture. Then you decide.",
  },
  {
    title: "Boring infrastructure, beautiful interface",
    body:
      "The most important code we write is the part you never see. The part you do see should be so clear it needs no manual.",
  },
];

const team = [
  ["AK", "Arjun Kumar", "Co-founder & CEO"],
  ["SR", "Sarah Reid", "Co-founder & CTO"],
  ["MJ", "Marcus Johnson", "Head of Product"],
  ["LP", "Leila Park", "Head of Design"],
];

export default function AboutPage() {
  return (
    <main className="bg-bg-page">
      <section className="px-4 pb-16 pt-20 md:px-8">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Our story
          </p>
          <h1 className="mt-5 font-heading text-[40px] leading-[1.08] tracking-[-0.8px] text-text-primary md:text-[44px]">
            Built by founders who hated
            <br />
            <em className="italic text-amber">expense reports.</em>
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            ReceiptMind started with a simple frustration: why does sorting receipts take 6
            hours a month?
          </p>
        </div>
      </section>

      <section className="border-y border-border-default bg-bg-surface px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[620px] space-y-6 text-[15px] leading-[1.75] text-text-secondary">
          <p>
            Every month, finance teams waste hours on a task that hasn&apos;t changed since the
            1980s: collecting crumpled receipts, typing numbers into spreadsheets, and hoping
            nothing gets lost before tax season. We knew there had to be a better way.
          </p>
          <p>
            We built the first version in three weeks. It did one thing: take a receipt photo
            and return a clean row of data. The response from our first ten users was immediate
            - they stopped asking for new features and just sent us more receipts.
          </p>
          <p>
            Today ReceiptMind helps finance teams automate their expense workflows. Our
            goal hasn&apos;t changed: make expense management invisible so finance teams can focus
            on the work that actually matters.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-[520px] text-center">
            <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Our values
            </p>
            <h2 className="mt-5 font-heading text-[32px] text-text-primary">How we think</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
            {values.map((value) => (
              <article key={value.title} className="rounded-[12px] border border-border-default bg-bg-surface p-6">
                <h3 className="text-[14px] font-medium text-text-primary">{value.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-text-muted">{value.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border-default bg-bg-surface px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[760px]">
          <div className="text-center">
            <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              The team
            </p>
            <h2 className="mt-5 font-heading text-[32px] text-text-primary">
              Built by operators and product obsessives
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {team.map(([initials, name, role]) => (
              <article key={name} className="rounded-[12px] border border-border-default bg-bg-surface p-5 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-surface text-[16px] font-medium text-amber">
                  {initials}
                </div>
                <p className="mt-3 text-[14px] font-medium text-text-primary">{name}</p>
                <p className="mt-1 text-[12px] text-text-muted">{role}</p>
                <span className="mt-2 inline-block text-[12px] text-text-muted">
                  LinkedIn
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-8">
        <h2 className="text-center text-[13px] font-medium uppercase tracking-[0.08em] text-text-muted">
          Stage
        </h2>
        <div className="mt-4 text-center">
          <span className="font-heading text-[20px] text-text-ghost">Seed funded</span>
        </div>
      </section>

      <section className="border-t border-border-default px-4 py-24 md:px-8">
        <div className="mx-auto max-w-[520px] text-center">
          <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
            Ready to stop typing receipts by hand?
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            Start with 10 free receipts and see how calm finance software can feel.
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
