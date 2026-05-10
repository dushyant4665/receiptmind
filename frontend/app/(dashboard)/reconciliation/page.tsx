"use client";

import { ChangeEvent, useRef } from "react";
import { UploadCloud, Link2, AlertCircle } from "lucide-react";
import { useBankTransactions, useImportBankCsv } from "@/hooks/use-bank";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReconciliationPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: transactions = [], isLoading } = useBankTransactions();
  const importCsv = useImportBankCsv();

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importCsv.mutate(file);
    event.target.value = "";
  };

  const unmatched = transactions.filter((item) => item.status !== "matched").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber">Bank reconciliation prep</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Match receipts to bank rows</h1>
          <p className="mt-1 text-[13px] text-text-muted">Import a bank CSV now; Plaid can plug into the same matching layer later.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          <Button onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
            <UploadCloud className="mr-2 size-4" />
            {importCsv.isPending ? "Importing..." : "Import CSV"}
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Transactions" value={transactions.length} />
        <Metric label="Matched" value={transactions.length - unmatched} tone="ok" />
        <Metric label="Unmatched" value={unmatched} tone={unmatched ? "warn" : "ok"} />
      </section>

      <div className="overflow-hidden rounded-lg border border-border-default bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border-subtle bg-bg-subtle text-[11px] uppercase tracking-widest text-text-ghost">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
              ))
            ) : transactions.length ? (
              transactions.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-text-muted">{item.date}</td>
                  <td className="px-4 py-3 font-medium">{item.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.currency} {item.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {item.status === "matched" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                        <Link2 className="size-3" /> {(item.match_confidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-surface px-2 py-1 text-[11px] font-medium text-amber">
                        <AlertCircle className="size-3" /> review
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-[12px] text-text-muted">No bank CSV imported yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-text-ghost">{label}</p>
      <p className={tone === "warn" ? "mt-2 text-2xl font-semibold text-amber" : tone === "ok" ? "mt-2 text-2xl font-semibold text-emerald-600" : "mt-2 text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}
