"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/expenses/upload-dropzone";
import { useReceipts, type ReceiptFilters, useDeleteReceipt } from "@/hooks/use-receipts";
import { useCsvExport } from "@/hooks/use-csv-export";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Receipt } from "@/types";
import { globalImageCache } from "@/lib/image-cache";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters: ReceiptFilters = useMemo(() => ({
    search: query || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  }), [query, statusFilter]);

  const { data, isLoading } = useReceipts(50, 0, filters);

  const { mutate: deleteReceipt } = useDeleteReceipt();
  const receipts = data?.receipts ?? [];
  const totalFromServer = data?.total ?? 0;

  const selectedReceipt = useMemo(() => {
    if (!selectedReceiptId) return null;
    const found = receipts.find((r) => r.id === selectedReceiptId);
    if (!found) return null;
    // Inject cached image if backend hasn't synced yet
    return { ...found, fileUrl: found.fileUrl || globalImageCache[found.id] };
  }, [receipts, selectedReceiptId]);

  const renderStatus = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "processing":
        return (
          <Badge variant="accent" className="gap-1">
            <span className="inline-block size-2 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            Processing
          </Badge>
        );
      case "needs_review": return <Badge variant="accent">Needs review</Badge>;
      case "processed":
      case "completed": return <Badge variant="default">Processed</Badge>;
      case "error":
      case "failed": return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="ghost">{status}</Badge>;
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === receipts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(receipts.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} receipts?`)) return;
    for (const id of Array.from(selectedIds)) {
      deleteReceipt(id);
    }
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} receipts deleted.`);
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Receipts</h1>
          <p className="mt-1 text-[13px] text-text-muted">Upload and manage your receipt inbox</p>
        </div>
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-2">
            <Trash2 className="size-4" />
            Delete {selectedIds.size} Selected
          </Button>
        )}
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
                <th className="px-4 py-2.5 text-left w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-border-default text-amber focus:ring-amber cursor-pointer"
                    checked={receipts.length > 0 && selectedIds.size === receipts.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {["Receipt", "Vendor", "Amount", "Date", "Category", "Confidence", "Status", ""].map((head) => (
                  <th key={head} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-text-ghost">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-[12px] text-text-muted">Loading receipts...</td></tr>
              ) : receipts.length > 0 ? (
                receipts.map((row) => {
                  const displayUrl = row.fileUrl || globalImageCache[row.id];
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-border-subtle transition-colors cursor-pointer hover:bg-bg-page/50 ${selectedIds.has(row.id) ? 'bg-amber-surface/20' : ''}`}
                      onClick={() => setSelectedReceiptId(row.id)}
                    >
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-border-default text-amber focus:ring-amber cursor-pointer"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewReceipt({ ...row, fileUrl: displayUrl });
                          }}
                          className="block size-8 overflow-hidden rounded-md border border-border-default bg-bg-page flex items-center justify-center"
                        >
                          {displayUrl ? (
                            <img 
                              src={displayUrl.startsWith('data:') ? displayUrl : `${process.env.NEXT_PUBLIC_API_URL}${displayUrl}`} 
                              alt={row.vendorName ?? "Receipt"} 
                              className="h-full w-full object-cover" 
                              loading="lazy" 
                            />
                          ) : (
                            <div className="text-[8px] text-text-muted">No Image</div>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-medium text-text-primary">
                        {row.vendorName || "Unknown"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-text-muted tabular-nums">
                        {row.amount != null ? `$${row.amount.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-text-ghost tabular-nums">
                        {row.receiptDate ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-text-secondary">
                        {row.category || "Uncategorized"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-text-ghost tabular-nums">
                        {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5">{renderStatus(row.status)}</td>
                      <td className="px-4 py-2.5 text-[12px]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <Link href={`/receipts/${row.id}`} className="text-amber hover:text-amber-hover transition-colors">Open</Link>
                          <DeleteButton id={row.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={9} className="text-center py-10 text-[12px] text-text-muted">No receipts found yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(previewReceipt)} onOpenChange={(open) => (!open ? setPreviewReceipt(null) : null)}>
        <DialogContent className="max-w-[680px]">
          <DialogHeader><DialogTitle className="text-[14px]">Receipt preview</DialogTitle></DialogHeader>
          <div className="mt-2 rounded-lg border border-border-default bg-bg-page p-4 flex items-center justify-center">
            {previewReceipt?.fileUrl ? (
              <img 
                src={previewReceipt.fileUrl.startsWith('data:') ? previewReceipt.fileUrl : `${process.env.NEXT_PUBLIC_API_URL}${previewReceipt.fileUrl}`} 
                alt={previewReceipt.vendorName ?? "Receipt"} 
                className="max-h-[60vh] w-auto object-contain" 
              />
            ) : (
              <p className="text-[12px] text-text-muted">Preview unavailable</p>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <DialogClose render={<Button variant="outline" size="sm" />}>Close</DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {selectedReceipt && (
        <Dialog open={Boolean(selectedReceiptId)} onOpenChange={(open) => (!open ? setSelectedReceiptId(null) : null)}>
          <DialogContent className="fixed right-0 top-0 left-auto h-dvh w-[440px] max-w-[calc(100%-1rem)] translate-x-0 translate-y-0 rounded-l-xl rounded-r-none border-l border-border-default p-0 flex flex-col">
            <div className="border-b border-border-subtle p-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-text-primary">{selectedReceipt.vendorName || "Unknown Vendor"}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{renderStatus(selectedReceipt.status)}</p>
              </div>
              <DialogClose render={<Button variant="ghost" size="sm" className="text-[11px]" />}>Close</DialogClose>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="rounded-lg border border-border-default bg-bg-page p-3 flex items-center justify-center">
                {selectedReceipt.fileUrl ? (
                  <img 
                    src={selectedReceipt.fileUrl.startsWith('data:') ? selectedReceipt.fileUrl : `${process.env.NEXT_PUBLIC_API_URL}${selectedReceipt.fileUrl}`} 
                    alt={selectedReceipt.vendorName ?? "Receipt"} 
                    className="max-h-[220px] w-auto object-contain" 
                  />
                ) : (
                  <p className="text-[12px] text-text-muted">Preview unavailable</p>
                )}
              </div>
              <div className="grid gap-2">
                {[
                  ["Vendor", selectedReceipt.vendorName || "—"],
                  ["Amount", selectedReceipt.amount != null ? `$${selectedReceipt.amount.toFixed(2)}` : "—"],
                  ["Date", selectedReceipt.receiptDate ?? "—"],
                  ["Category", selectedReceipt.category || "Uncategorized"],
                  ["Confidence", selectedReceipt.confidence != null ? `${(selectedReceipt.confidence * 100).toFixed(0)}%` : "—"],
                ].map(([label, value]) => (
                  <div key={label as string} className="grid gap-0.5 rounded-lg border border-border-subtle bg-bg-page px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">{label}</p>
                    <p className="text-[12px] text-text-primary">{value as string}</p>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const { mutate: deleteReceipt, isPending } = useDeleteReceipt();
  return (
    <button 
      disabled={isPending}
      onClick={(e) => {
        e.stopPropagation();
        if(confirm("Are you sure?")) deleteReceipt(id);
      }}
      className="text-destructive hover:opacity-70 transition-opacity"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
