const releases = [
  {
    version: "v1.2.0",
    date: "January 2026",
    changes: [
      { type: "feature", text: "Added Exceptions Inbox for managing low-confidence extractions" },
      { type: "feature", text: "New Category Rules API with auto-categorization engine" },
      { type: "feature", text: "Real-time extraction status via SSE streaming" },
      { type: "improvement", text: "Redis caching for faster dashboard loads" },
    ],
  },
  {
    version: "v1.1.0",
    date: "December 2025",
    changes: [
      { type: "feature", text: "Receipt upload with AI-powered OCR extraction" },
      { type: "feature", text: "Expense tracking and categorization" },
      { type: "feature", text: "Dashboard with spending analytics" },
      { type: "feature", text: "JWT-based authentication system" },
    ],
  },
  {
    version: "v1.0.0",
    date: "November 2025",
    changes: [
      { type: "feature", text: "Initial release of ReceiptMind platform" },
      { type: "feature", text: "User registration and login" },
      { type: "feature", text: "Basic receipt storage" },
    ],
  },
];

const typeColors: Record<string, string> = {
  feature: "bg-green-100 text-green-700",
  improvement: "bg-blue-100 text-blue-700",
  fix: "bg-amber-100 text-amber-700",
};

export default function ChangelogPage() {
  return (
    <main className="bg-bg-page px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="font-heading text-[32px] text-text-primary md:text-[40px]">Changelog</h1>
          <p className="mt-4 text-[15px] text-text-muted">
            Track the evolution of ReceiptMind
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {releases.map((release) => (
            <section key={release.version}>
              <div className="flex items-center gap-4">
                <h2 className="text-[24px] font-medium text-text-primary">{release.version}</h2>
                <span className="text-[14px] text-text-muted">{release.date}</span>
              </div>
              <ul className="mt-4 space-y-3">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${typeColors[change.type]}`}>
                      {change.type}
                    </span>
                    <span className="text-[15px] text-text-secondary">{change.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-[12px] border border-border-default bg-bg-surface p-6">
          <h3 className="text-[16px] font-medium text-text-primary">Upcoming</h3>
          <ul className="mt-3 space-y-2 text-[14px] text-text-muted">
            <li>• Stripe billing integration</li>
            <li>• Gmail auto-fetch receipts</li>
            <li>• QuickBooks Online sync</li>
            <li>• Xero integration</li>
            <li>• Team collaboration features</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
