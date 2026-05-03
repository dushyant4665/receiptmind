"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { SectionHeading } from "@/components/common/section-heading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/expenses/upload-dropzone";
import { useReceipts, type ReceiptFilters } from "@/hooks/use-receipts";
import { useCsvExport } from "@/hooks/use-csv-export";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Receipt } from "@/types";

function CSVExportButton({ status }: { status: string }) {
  const { mutate: exportCsv, isPending } = useCsvExport();

  return (
    <Button variant="outline" size="sm" onClick={() => exportCsv({ status: status !== "all" ? status : undefined })} disabled={isPending}>
      <Download className="mr-2 size-4" />
      {isPending ? "Downloading..." : "Export CSV"}
    </Button>
  );
}

export default function ReceiptsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  const filters: ReceiptFilters = useMemo(() => ({
    search: query || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  }), [query, statusFilter]);

  const { data, isLoading } = useReceipts(50, 0, filters);

  const receipts = data?.receipts ?? [];
  const totalFromServer = data?.total ?? 0;

  const selectedReceipt = useMemo(() => {
    if (!selectedReceiptId) return null;
    return receipts.find((r) => r.id === selectedReceiptId) ?? null;
  }, [receipts, selectedReceiptId]);

  const renderStatus = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "processing":
        return (
          <Badge variant="accent" className="gap-1">
            <span className="inline-block size-2 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            Processing
          </Badge>
        );
      case "needs_review":
        return <Badge variant="accent">Needs review</Badge>;
      case "processed":
      case "completed":
        return <Badge variant="default">Processed</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="ghost">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Receipts</h1>
        <p className="mt-1 text-[13px] text-text-muted">Upload and manage your receipt inbox</p>
      </div>
      <UploadDropzone />
      <section className="rounded-lg border border-border-default bg-white overflow-hidden shadow-xs">
        <div className="flex flex-col gap-3 p-4 border-b border-border-subtle md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              placeholder="Search receipts..."
              className="w-full md:w-[200px] h-8 text-[12px]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 rounded-lg border border-border-default bg-white px-3 text-[12px] text-text-primary outline-none transition-colors hover:border-ink5 focus:border-ink3"
            >
              <option value="all">All statuses</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="needs_review">Needs review</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-text-muted tabular-nums">{totalFromServer} receipts</span>
            <CSVExportButton status={statusFilter} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-page/50">
                {["Receipt", "Vendor", "Amount", "Date", "Category", "Confidence", "Status", ""].map((head) => (
                  <th key={head} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-text-ghost">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-[12px] text-text-muted text-center">
                    Loading receipts...
                  </td>
                </tr>
              ) : receipts.length > 0 ? (
                receipts.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border-subtle transition-colors cursor-pointer hover:bg-bg-page/50"
                    onClick={() => setSelectedReceiptId(row.id)}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewReceipt(row);
                        }}
                        className="block size-8 overflow-hidden rounded-md border border-border-default bg-bg-page"
                      >
                        {row.fileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.fileUrl} alt={row.vendorName ?? "Receipt"} className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-medium text-text-primary">
                      {row.vendorName || "Unknown"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-text-muted tabular-nums">
                      {row.amount != null ? `$${row.amount.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-ghost tabular-nums">
                      {row.receiptDate ?? row.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-text-secondary">
                      {row.category || "Uncategorized"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-ghost tabular-nums">
                      {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5">{renderStatus(row.status)}</td>
                    <td className="px-4 py-2.5 text-[12px]" onClick={(event) => event.stopPropagation()}>
                      <Link href={`/receipts/${row.id}`} className="text-amber hover:text-amber-hover transition-colors">Open</Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-[12px] text-text-muted text-center">
                    No receipts found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(previewReceipt)} onOpenChange={(open) => (!open ? setPreviewReceipt(null) : null)}>
        <DialogContent className="max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="text-[14px]">Receipt preview</DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-lg border border-border-default bg-bg-page p-4">
            <div className="mx-auto flex max-h-[60vh] items-center justify-center">
              {previewReceipt?.fileUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewReceipt.fileUrl} alt={previewReceipt.vendorName ?? "Receipt"} className="max-h-[60vh] w-auto object-contain" />
              ) : (
                <p className="text-[12px] text-text-muted">Preview unavailable</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <DialogClose>
              <Button variant="outline" size="sm">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {selectedReceipt ? (
        <Dialog open={Boolean(selectedReceiptId)} onOpenChange={(open) => (!open ? setSelectedReceiptId(null) : null)}>
          <DialogContent className="fixed right-0 top-0 left-auto h-dvh w-[440px] max-w-[calc(100%-1rem)] translate-x-0 translate-y-0 rounded-l-xl rounded-r-none border-l border-border-default p-0">
            <div className="flex h-full flex-col">
              <div className="border-b border-border-subtle p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-text-primary">{selectedReceipt.vendorName || "Unknown Vendor"}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">{renderStatus(selectedReceipt.status)}</p>
                  </div>
                  <DialogClose>
                    <Button variant="ghost" size="sm" className="text-[11px]">Close</Button>
                  </DialogClose>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="rounded-lg border border-border-default bg-bg-page p-3">
                  <div className="mx-auto flex max-h-[220px] items-center justify-center">
                    {selectedReceipt.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedReceipt.fileUrl} alt={selectedReceipt.vendorName ?? "Receipt"} className="max-h-[220px] w-auto object-contain" loading="lazy" />
                    ) : (
                      <p className="text-[12px] text-text-muted">Preview unavailable</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {[
                    ["Vendor", selectedReceipt.vendorName || "—"],
                    ["Amount", selectedReceipt.amount != null ? `$${selectedReceipt.amount.toFixed(2)}` : "—"],
                    ["Date", selectedReceipt.receiptDate ?? "—"],
                    ["Category", selectedReceipt.category || "Uncategorized"],
                    ["Confidence", selectedReceipt.confidence != null ? `${(selectedReceipt.confidence * 100).toFixed(0)}%` : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-0.5 rounded-lg border border-border-subtle bg-bg-page px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">{label}</p>
                      <p className="text-[12px] text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>

                {selectedReceipt.exceptions && selectedReceipt.exceptions.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber/30 bg-amber-surface/30 p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber">Exceptions</p>
                    {selectedReceipt.exceptions.map((ex) => (
                      <div key={ex.id} className="rounded-lg border border-border-subtle bg-white px-3 py-2.5 mb-1.5">
                        <p className="text-[12px] font-medium text-text-primary">{ex.type}: {ex.field}</p>
                        <p className="text-[11px] text-text-muted">{ex.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
