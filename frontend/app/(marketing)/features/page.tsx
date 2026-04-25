import Link from "next/link";
import { Check } from "lucide-react";

const featureSections = [
  {
    eyebrow: "Extraction",
    title: "High accuracy extraction on every receipt",
    body:
      "Our AI reads receipts from any angle, in any language. Crumpled paper, phone screenshots, forwarded emails - it extracts vendor, amount, date, category, and tax fields with enterprise-grade precision.",
    bullets: [
      "Supports 28 file formats including HEIC",
      "Batch processing up to 100 files",
      "Multi-currency detection (47 currencies)",
      "Auto-rotation and image enhancement",
    ],
    visual: (
      <div className="rounded-[12px] border border-border-default bg-bg-surface p-6">
        <div className="rounded-[12px] border border-border-default bg-bg-page p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[14px] font-medium text-text-primary">Cafe Milano</p>
              <p className="mt-1 font-mono text-[12px] text-text-muted">2026-04-18</p>
            </div>
            <span className="rounded-[4px] bg-success-surface px-2 py-1 text-[11px] font-medium text-success">
              99.2%
            </span>
          </div>
          <div className="mt-5 space-y-2">
            {[
              ["Vendor", "Cafe Milano"],
              ["Amount", "$84.20"],
              ["Category", "Meals"],
              ["Tax", "$7.64"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[8px] border border-border-subtle bg-bg-surface px-3 py-2"
              >
                <span className="text-[13px] text-text-muted">{label}</span>
                <span className="text-[13px] font-medium text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Automation",
    title: "Never hunt for a receipt again",
    body:
      "Connect your Gmail and ReceiptMind continuously scans for receipt emails, extracts attachments, and processes them automatically. Receipts appear in your dashboard before you remember to upload them.",
    bullets: [
      "Smart alias detection (receipts@, billing@, invoices@)",
      "Real-time processing - under 60 seconds per email",
      "Works with Gmail, Google Workspace, Outlook (coming Q3)",
      "Unsubscribes from junk receipt emails automatically",
    ],
    visual: (
      <div className="rounded-[12px] border border-border-default bg-bg-surface p-6">
        <div className="rounded-[12px] border border-border-default bg-bg-page">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <p className="text-[14px] font-medium text-text-primary">Inbox sync</p>
            <span className="rounded-[4px] bg-amber-surface px-2 py-1 text-[11px] font-medium text-amber">
              Live
            </span>
          </div>
          <div className="space-y-2 p-4">
            {[
              ["Uber receipt", "Auto-imported"],
              ["Adobe invoice", "Queued"],
              ["Slack payment", "Processed"],
            ].map(([subject, status]) => (
              <div
                key={subject}
                className="flex items-center justify-between rounded-[8px] border border-border-subtle bg-bg-surface px-3 py-3"
              >
                <div>
                  <p className="text-[13px] font-medium text-text-primary">{subject}</p>
                  <p className="mt-1 text-[12px] text-text-muted">Attachment detected</p>
                </div>
                <span className="text-[12px] text-amber">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Integrations",
    title: "Exports your accountant actually trusts",
    body:
      "Map your categories to QuickBooks chart of accounts, push to Xero with one click, or export clean CSVs with exactly the columns your accounting stack expects.",
    bullets: [
      "QuickBooks Online: direct AP sync",
      "Xero: two-way category mapping",
      "CSV/Excel: fully customizable column order",
      "API: raw JSON for custom integrations",
    ],
    visual: (
      <div className="grid gap-3 rounded-[12px] border border-border-default bg-bg-surface p-6 sm:grid-cols-2">
        {[
          ["QuickBooks", "Accounting"],
          ["Xero", "Accounting"],
          ["CSV Export", "Export"],
          ["REST API", "Developer"],
        ].map(([name, category]) => (
          <div key={name} className="rounded-[8px] border border-border-default bg-bg-page p-4">
            <div className="size-6 rounded-[6px] border border-border-default bg-bg-surface" />
            <p className="mt-4 text-[14px] font-medium text-text-primary">{name}</p>
            <span className="mt-2 inline-flex rounded-[4px] bg-bg-subtle px-2 py-1 text-[11px] text-text-muted">
              {category}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "Insights",
    title: "See where your money actually goes",
    body:
      "Track spend by vendor, spot policy drift before month-end, and catch duplicate charges automatically. Built for finance teams that need to present clean data to leadership.",
    bullets: [
      "Month-over-month category comparison",
      "Vendor spend concentration chart",
      "Duplicate detection with confidence score",
      "Policy violation flags (custom rules)",
    ],
    visual: (
      <div className="rounded-[12px] border border-border-default bg-bg-surface p-6">
        <div className="rounded-[12px] border border-border-default bg-bg-page p-5">
          <div className="flex items-end gap-3">
            {[48, 80, 64, 96, 72].map((height, index) => (
              <div key={height} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-[4px] bg-amber-surface" style={{ height }} />
                <span className="text-[11px] text-text-ghost">M{index + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[8px] border border-border-subtle bg-bg-surface px-3 py-3">
            <p className="text-[13px] font-medium text-text-primary">Vendor drift detected</p>
            <p className="mt-1 text-[12px] text-text-muted">
              Travel spend is up 18% versus last month.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Security",
    title: "Bank-grade security, not startup security",
    body:
      "Every file is encrypted at rest with AES-256 and in transit with TLS 1.3. Role-based access controls ensure junior staff see only what they need to. Full audit log for every action.",
    bullets: [
      "SOC 2 Type II in progress",
      "AES-256 encryption at rest",
      "TLS 1.3 in transit",
      "Role-based access (Admin, Editor, Viewer)",
      "GDPR + CCPA compliant",
      "30-day audit log retention",
    ],
    visual: (
      <div className="rounded-[12px] border border-border-default bg-bg-surface p-6">
        <div className="rounded-[12px] border border-border-default bg-bg-page p-5">
          <p className="text-[14px] font-medium text-text-primary">Security checklist</p>
          <div className="mt-4 space-y-2">
            {[
              "Audit logs enabled",
              "Encryption verified",
              "Role policy active",
              "Retention rules enforced",
            ].map((item) => (
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
    ),
  },
];

const integrations = [
  ["QuickBooks", "Accounting"],
  ["Xero", "Accounting"],
  ["FreshBooks", "Accounting"],
  ["Wave", "Accounting"],
  ["Gmail", "Email"],
  ["Outlook", "Email"],
  ["Slack", "Notifications"],
  ["Zapier", "Automation"],
  ["REST API", "Developer"],
  ["CSV/Excel", "Export"],
  ["Google Sheets", "Data"],
  ["Sage", "Accounting"],
];

const comparisonRows = [
  ["Time per receipt", "3-5 minutes", "30 seconds"],
  ["Accuracy", "~78%", "96%+"],
  ["Accounting format", "Inconsistent", "Always clean"],
  ["Bulk processing", "One at a time", "Up to 100 files"],
  ["Gmail auto-fetch", "Manual", "Automatic"],
  ["Cost per hour", "$25-$80/hr", "$0.08/receipt"],
];

export default function FeaturesPage() {
  return (
    <main className="bg-bg-page">
      <section className="px-4 pb-16 pt-20 md:px-8">
        <div className="mx-auto max-w-[600px] text-center">
          <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Everything you need
          </p>
          <h1 className="mt-5 font-heading text-[40px] leading-[1.08] tracking-[-0.8px] text-text-primary md:text-[44px]">
            Built for how finance teams actually work
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            No spreadsheet cleanup. No manual entry. No chasing down receipts. Just
            structured data, every time.
          </p>
        </div>
      </section>

      <div className="space-y-16 pb-16">
        {featureSections.map((section, index) => (
          <section key={section.title} className="px-4 md:px-8">
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
                <ul className="mt-5 space-y-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-[13px] text-text-muted">
                      <span className="mt-2 size-1 rounded-full bg-amber" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5">
                  <Link href="/signup" className="text-[13px] text-amber transition-[color] hover:text-amber-hover">
                    Start free trial -&gt;
                  </Link>
                </p>
              </div>
              <div>{section.visual}</div>
            </div>
          </section>
        ))}
      </div>

      <section className="border-y border-border-default bg-bg-surface px-4 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-heading text-[32px] text-text-primary">
            Connects to your stack
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {integrations.map(([name, category]) => (
              <article key={name} className="rounded-[8px] border border-border-default bg-bg-surface p-4">
                <div className="size-6 rounded-[6px] border border-border-default bg-bg-page" />
                <p className="mt-4 text-[14px] font-medium text-text-primary">{name}</p>
                <span className="mt-2 inline-flex rounded-[4px] bg-bg-subtle px-2 py-1 text-[11px] text-text-muted">
                  {category}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-heading text-[32px] text-text-primary">
            ReceiptMind vs. manual process
          </h2>
          <div className="mt-10 overflow-x-auto rounded-[12px] border border-border-default bg-bg-surface">
            <table className="w-full text-left">
              <thead className="bg-bg-page">
                <tr>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-[0.06em] text-text-ghost">
                    Workflow
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-[0.06em] text-text-ghost">
                    Manual
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-[0.06em] text-text-ghost">
                    ReceiptMind
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, manual, modern]) => (
                  <tr key={label} className="border-t border-border-subtle">
                    <td className="px-4 py-3 text-[13px] text-text-secondary">{label}</td>
                    <td className="px-4 py-3 text-[13px] text-[#8a2b1f]">{manual}</td>
                    <td className="bg-success-surface px-4 py-3 text-[13px] text-success">{modern}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-t border-border-default px-4 py-24 md:px-8">
        <div className="mx-auto max-w-[520px] text-center">
          <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
            Ready to stop wasting 8 hours a month?
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
            Give finance a calmer workflow and your team a cleaner way to submit every receipt.
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
