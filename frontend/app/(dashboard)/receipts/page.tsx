"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Input } from "@/components/ui/input";
import { UploadDropzone } from "@/components/expenses/upload-dropzone";
import { useReceipts } from "@/hooks/use-receipts";

export default function ReceiptsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const deferredQuery = useDeferredValue(query);
  const { data, isLoading } = useReceipts();

  const rows = (data ?? []).filter((receipt) => {
    const matchesQuery =
      !deferredQuery ||
      [receipt.vendorName, receipt.filename, receipt.category, receipt.status]
        .join(" ")
        .toLowerCase()
        .includes(deferredQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Receipt ingestion"
        title="Upload receipts in bulk and enrich them with AI-assisted field extraction."
        description="Supports employee reimbursements, AP packet processing, and exception workflows."
        align="left"
      />
      <UploadDropzone />
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Search receipts"
              className="w-full md:w-[220px]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-[8px] border border-border-default bg-bg-surface px-3 text-[13px] text-text-primary outline-none transition-[border-color] hover:border-border-strong focus:border-text-primary"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
            </select>
          </div>
          <span className="text-[12px] text-text-muted">{rows.length} receipts</span>
        </div>
        <div className="mt-5 overflow-hidden rounded-[12px] border border-border-default">
          <table className="w-full">
            <thead className="bg-bg-page">
              <tr>
                {["Vendor", "Date", "Category", "Status", "Open"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-text-ghost">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="border-t border-border-subtle">
                  <td colSpan={5} className="px-4 py-6 text-[13px] text-text-muted">
                    Loading receipts...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3 text-[13px] font-medium text-text-primary">
                      {row.vendorName || row.filename}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-text-muted">
                      {row.date ?? row.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">
                      {row.category || "Uncategorized"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-muted">{row.status}</td>
                    <td className="px-4 py-3 text-[13px] text-amber">
                      <Link href={`/receipts/${row.id}`}>View</Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-border-subtle">
                  <td colSpan={5} className="px-4 py-6 text-[13px] text-text-muted">
                    No receipts found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
