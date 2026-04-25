import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-text-primary">Current plan</h2>
            <p className="mt-1 text-[13px] text-text-muted">Pro plan · billed monthly · next renewal May 23, 2026</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button variant="amber">Upgrade</Button>
          </div>
        </div>
      </section>
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Invoices</h2>
        <div className="mt-4 overflow-hidden rounded-[12px] border border-border-default">
          <table className="w-full">
            <thead className="bg-bg-page">
              <tr>
                {["Invoice", "Date", "Amount", "Status"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-text-ghost">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["INV-2026-041", "2026-04-01", "$29.00", "Paid"],
                ["INV-2026-031", "2026-03-01", "$29.00", "Paid"],
              ].map((row) => (
                <tr key={row[0]} className="border-t border-border-subtle">
                  {row.map((cell, index) => (
                    <td key={cell} className={`px-4 py-3 text-[13px] ${index === 1 ? "font-mono text-[12px] text-text-muted" : "text-text-secondary"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
