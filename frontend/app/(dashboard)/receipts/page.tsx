"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Download, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/expenses/upload-dropzone";
import { useReceipts, type ReceiptFilters, useDeleteReceipt, useEditReceipt, useBulkDeleteReceipts, useBulkExportReceipts } from "@/hooks/use-receipts";
import { useCsvExport } from "@/hooks/use-csv-export";
import { useCreateRule } from "@/hooks/use-rules";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Receipt } from "@/types";
import { globalImageCache } from "@/lib/image-cache";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

function getReceiptImageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${apiUrl}${url}`;
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const previousStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filters: ReceiptFilters = useMemo(() => ({
    search: debouncedQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    minAmount: minAmount === "" ? undefined : Number(minAmount),
    maxAmount: maxAmount === "" ? undefined : Number(maxAmount),
  }), [debouncedQuery, endDate, maxAmount, minAmount, startDate, statusFilter]);

  const { data, isLoading, isFetching } = useReceipts(50, 0, filters);
  const { mutate: deleteReceipt } = useDeleteReceipt();
  const { mutate: bulkDelete } = useBulkDeleteReceipts();
  const { mutate: bulkExport } = useBulkExportReceipts();
  const receipts = data?.receipts ?? [];
  const totalFromServer = data?.total ?? 0;

  useEffect(() => {
    if (receipts.length === 0) return;

    for (const receipt of receipts) {
      const previous = previousStatusesRef.current[receipt.id];
      const finished = receipt.status === "processed" || receipt.status === "needs_review" || receipt.status === "failed";
      if ((previous === "processing" || previous === "pending") && finished) {
        if (receipt.status === "processed") toast.success(`${receipt.vendorName || "Receipt"} processed`);
        if (receipt.status === "needs_review") toast.warning(`${receipt.vendorName || "Receipt"} needs review`);
        if (receipt.status === "failed") {
          toast.error(`Receipt processing failed${receipt.errorMessage ? `: ${receipt.errorMessage}` : ''}`);
        }
      }
    }

    previousStatusesRef.current = Object.fromEntries(receipts.map((receipt) => [receipt.id, receipt.status]));
  }, [receipts]);

  const selectedReceipt = useMemo(() => {
    if (!selectedReceiptId) return null;
    const found = receipts.find((r) => r.id === selectedReceiptId);
    if (!found) return null;
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
    setSelectedIds((current) => current.size === receipts.length ? new Set() : new Set(receipts.map((r) => r.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} receipts?`)) return;
    bulkDelete(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkExport = () => {
    bulkExport(Array.from(selectedIds));
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Receipts</h1>
          <p className="mt-1 text-[13px] text-text-muted">Upload, review, search, and export receipt data.</p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
            <span className="mr-2 text-[13px] font-medium text-amber-600">
              {selectedIds.size} receipts selected
            </span>
            <Button variant="outline" size="sm" onClick={handleBulkExport} className="gap-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700">
              <Download className="size-4" />
              Bulk Export
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-2">
              <Trash2 className="size-4" />
              Bulk Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-[11px]">
              Clear
            </Button>
          </div>
        )}
      </div>

      <UploadDropzone />

      <section className="overflow-hidden rounded-lg border border-border-default bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border-subtle p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_140px_130px_130px_120px_120px] flex-1">
              <Input
                placeholder="Search vendor, category, >500, last month..."
                className="h-8 w-full text-[12px]"
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
                <option value="failed">Failed</option>
              </select>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-8 text-[12px]" />
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-8 text-[12px]" />
              <Input inputMode="decimal" placeholder="Min $" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} className="h-8 text-[12px]" />
              <Input inputMode="decimal" placeholder="Max $" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} className="h-8 text-[12px]" />
            </div>
            <Button variant="outline" size="sm" onClick={toggleSelectAll} className="h-8 text-[11px]">
              {selectedIds.size === receipts.length && receipts.length > 0 ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {isFetching && !isLoading && <span className="text-[11px] text-amber">Syncing...</span>}
            <span className="text-[11px] text-text-muted tabular-nums">{totalFromServer} receipts</span>
            <CSVExportButton status={statusFilter} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-page/50">
                <th className="w-10 px-4 py-2.5 text-left">
                  <input
                    type="checkbox"
                    className="cursor-pointer rounded border-border-default text-amber focus:ring-amber"
                    checked={receipts.length > 0 && selectedIds.size === receipts.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {["Receipt", "Vendor", "Amount", "Category", "Status", "Confidence", ""].map((head) => (
                  <th key={head} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-text-ghost">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b border-border-subtle">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-8 animate-pulse rounded-md bg-bg-subtle" />
                    </td>
                  </tr>
                ))
              ) : receipts.length > 0 ? (
                receipts.map((row) => {
                  const displayUrl = row.fileUrl || globalImageCache[row.id];
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-b border-border-subtle transition-colors hover:bg-bg-page/50 ${selectedIds.has(row.id) ? "bg-amber-surface/20" : ""}`}
                      onClick={() => setSelectedReceiptId(row.id)}
                    >
                      <td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="cursor-pointer rounded border-border-default text-amber focus:ring-amber"
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
                          className="flex size-8 items-center justify-center overflow-hidden rounded-md border border-border-default bg-bg-page"
                        >
                          {displayUrl ? (
                            <img src={getReceiptImageSrc(displayUrl)} alt={row.vendorName ?? "Receipt"} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-[8px] text-text-muted">No file</span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-medium text-text-primary">{row.vendorName || "Processing..."}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-text-muted tabular-nums">{row.amount != null ? `$${row.amount.toFixed(2)}` : "-"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-text-secondary">{row.category || "Uncategorized"}</td>
                      <td className="px-4 py-2.5">{renderStatus(row.status)}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-text-ghost tabular-nums">{row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : "-"}</td>
                      <td className="px-4 py-2.5 text-[12px]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <Link href={`/receipts/${row.id}`} className="text-amber transition-colors hover:text-amber-hover">Open</Link>
                          <DeleteButton id={row.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={8} className="py-10 text-center text-[12px] text-text-muted">No receipts found yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(previewReceipt)} onOpenChange={(open) => (!open ? setPreviewReceipt(null) : null)}>
        <DialogContent className="max-w-[680px]">
          <DialogHeader><DialogTitle className="text-[14px]">Receipt preview</DialogTitle></DialogHeader>
          <div className="mt-2 flex items-center justify-center rounded-lg border border-border-default bg-bg-page p-4">
            {previewReceipt?.fileUrl ? (
              <img src={getReceiptImageSrc(previewReceipt.fileUrl)} alt={previewReceipt.vendorName ?? "Receipt"} className="max-h-[60vh] w-auto object-contain" />
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
          <ReceiptEditPanel receipt={selectedReceipt} renderStatus={renderStatus} />
        </Dialog>
      )}
    </div>
  );
}

function ReceiptEditPanel({ receipt, renderStatus }: { receipt: Receipt; renderStatus: (status: string) => ReactNode }) {
  const { mutate: editReceipt, isPending } = useEditReceipt();
  const { mutate: createRule, isPending: isCreatingRule } = useCreateRule();
  const [vendorName, setVendorName] = useState(receipt.vendorName ?? "");
  const [amount, setAmount] = useState(receipt.amount == null ? "" : String(receipt.amount));
  const [receiptDate, setReceiptDate] = useState(toDateInputValue(receipt.receiptDate));
  const [category, setCategory] = useState(receipt.category ?? "");
  const [createRuleOnSave, setCreateRuleOnSave] = useState(false);

  useEffect(() => {
    setVendorName(receipt.vendorName ?? "");
    setAmount(receipt.amount == null ? "" : String(receipt.amount));
    setReceiptDate(toDateInputValue(receipt.receiptDate));
    setCategory(receipt.category ?? "");
  }, [receipt]);

  const save = () => {
    const numericAmount = amount.trim() === "" ? undefined : Number(amount);
    if (numericAmount != null && Number.isNaN(numericAmount)) {
      toast.error("Amount must be numeric.");
      return;
    }

    editReceipt(
      {
        id: receipt.id,
        edits: {
          vendor_name: vendorName.trim(),
          amount: numericAmount,
          receipt_date: receiptDate || undefined,
          category: category.trim(),
        },
      },
      {
        onSuccess: () => {
          if (createRuleOnSave && vendorName.trim() && category.trim()) {
            createRule({
              conditionType: "vendor",
              conditionValue: vendorName.trim(),
              actionType: "set_category",
              actionValue: category.trim(),
            });
          }
        },
      },
    );
  };

  return (
    <DialogContent className="fixed right-0 top-0 left-auto flex h-dvh w-[460px] max-w-[calc(100%-1rem)] translate-x-0 translate-y-0 flex-col rounded-l-xl rounded-r-none border-l border-border-default p-0">
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">{receipt.vendorName || "Unknown Vendor"}</p>
          <div className="mt-1">{renderStatus(receipt.status)}</div>
        </div>
        <DialogClose render={<Button variant="ghost" size="sm" className="text-[11px]" />}>Close</DialogClose>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div className="flex items-center justify-center rounded-lg border border-border-default bg-bg-page p-3">
          {receipt.fileUrl ? (
            <img src={getReceiptImageSrc(receipt.fileUrl)} alt={receipt.vendorName ?? "Receipt"} className="max-h-[220px] w-auto object-contain" />
          ) : (
            <p className="text-[12px] text-text-muted">Preview unavailable</p>
          )}
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Vendor</span>
            <Input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor name" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Amount</span>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Date</span>
            <Input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Category</span>
            <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Office, Meals, Travel..." />
          </label>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-subtle bg-bg-page px-3 py-2.5 text-[12px] text-text-muted">
          <input
            type="checkbox"
            checked={createRuleOnSave}
            onChange={(event) => setCreateRuleOnSave(event.target.checked)}
            className="mt-0.5 rounded border-border-default accent-amber"
          />
          <span>
            Create rule after save
            <span className="block text-[11px] text-text-ghost">Example: {vendorName || "Vendor"} = {category || "Category"}</span>
          </span>
        </label>

        <div className="rounded-lg border border-border-subtle bg-bg-page px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-ghost">Confidence</p>
          <p className="mt-1 text-[12px] text-text-primary">{receipt.confidence != null ? `${(receipt.confidence * 100).toFixed(0)}%` : "Waiting for extraction"}</p>
        </div>
      </div>
      <div className="border-t border-border-subtle p-4">
        <Button className="w-full gap-2" disabled={isPending || isCreatingRule} onClick={save}>
          <Save className="size-4" />
          {isPending || isCreatingRule ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </DialogContent>
  );
}

function DeleteButton({ id }: { id: string }) {
  const { mutate: deleteReceipt, isPending } = useDeleteReceipt();
  return (
    <button
      type="button"
      aria-label="Delete receipt"
      disabled={isPending}
      onClick={(event) => {
        event.stopPropagation();
        if (confirm("Are you sure?")) deleteReceipt(id);
      }}
      className="text-destructive transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
