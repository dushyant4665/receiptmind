"use client";

import { useState } from "react";
import Image from "next/image";
import { useReceipts, useDeleteReceipt, ReceiptStatus } from "@/hooks/use-receipts-optimized";
import type { Receipt } from "@/types";
import { ReceiptTableSkeleton, ProcessingBadgeSkeleton } from "./receipt-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    processing: "bg-blue-100 text-blue-700 border-blue-200",
    processed: "bg-green-100 text-green-700 border-green-200",
    needs_review: "bg-orange-100 text-orange-700 border-orange-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    error: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <Badge className={`${variants[status] || "bg-gray-100 text-gray-700 border-gray-200"} border font-medium capitalize`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function ProcessingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-amber" />
      <span className="text-sm text-text-muted">Processing...</span>
    </div>
  );
}

function ReceiptRow({
  receipt,
  onDelete,
  isDeleting,
}: {
  receipt: Receipt;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const isProcessing = receipt.status === "pending" || receipt.status === "processing";
  const hasData = receipt.vendorName && receipt.amount !== null;

  return (
    <div className="group flex items-center gap-4 py-4 px-4 border-b border-border-subtle hover:bg-bg-page transition-colors">
      {/* Thumbnail */}
      <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-bg-page border border-border-default shrink-0">
        {receipt.fileUrl ? (
          <Image
            src={receipt.fileUrl}
            alt={receipt.vendorName ?? "Receipt"}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full">
            <FileText className="h-5 w-5 text-text-ghost" />
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-bg-surface/80 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-amber" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 grid grid-cols-5 gap-4 items-center">
        {/* Vendor & Description */}
        <div className="col-span-2 min-w-0">
          {isProcessing && !hasData ? (
            <ProcessingIndicator />
          ) : (
            <>
              <p className="text-sm font-medium text-text-primary truncate">
                {receipt.vendorName || "Unknown Vendor"}
              </p>
              <p className="text-xs text-text-muted truncate">
                {receipt.filePath}
              </p>
            </>
          )}
        </div>

        {/* Amount */}
        <div>
          {isProcessing && receipt.amount === null ? (
            <ProcessingIndicator />
          ) : (
            <p className="text-sm font-medium text-text-primary">
              {receipt.amount != null ? `$${receipt.amount.toFixed(2)}` : "—"}
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <p className="text-sm text-text-secondary">
            {receipt.receiptDate ? formatDate(receipt.receiptDate) : "—"}
          </p>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center justify-end gap-2">
          <StatusBadge status={receipt.status} />
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(receipt.id)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 text-text-ghost hover:text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReceiptsTableOptimized() {
  const { data: receipts, isLoading, isError, error } = useReceipts();
  const { mutate: deleteReceipt, isPending: isDeleting } = useDeleteReceipt();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteReceipt(id, {
      onSettled: () => setDeletingId(null),
    });
  };

  if (isLoading) {
    return <ReceiptTableSkeleton count={5} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-text-secondary mb-4">Failed to load receipts</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border-default rounded-[12px]">
        <FileText className="h-12 w-12 text-text-ghost mb-4" />
        <p className="text-text-secondary">No receipts yet</p>
        <p className="text-sm text-text-muted mt-1">
          Upload your first receipt to get started
        </p>
      </div>
    );
  }

  const hasPendingReceipts = receipts.some(
    (r) => r.status === "pending" || r.status === "processing"
  );

  return (
    <div className="space-y-4">
      {/* Polling indicator */}
      {hasPendingReceipts && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-surface rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-amber" />
          <span className="text-sm text-amber">
            Processing {receipts.filter((r) => r.status === "pending" || r.status === "processing").length} receipt(s)...
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[12px] border border-border-default bg-bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 py-3 px-4 border-b border-border-default bg-bg-page">
          <div className="h-12 w-12 shrink-0" />
          <div className="flex-1 grid grid-cols-5 gap-4">
            <div className="col-span-2 text-xs font-medium text-text-ghost uppercase tracking-wider">
              Vendor
            </div>
            <div className="text-xs font-medium text-text-ghost uppercase tracking-wider">
              Amount
            </div>
            <div className="text-xs font-medium text-text-ghost uppercase tracking-wider">
              Date
            </div>
            <div className="text-xs font-medium text-text-ghost uppercase tracking-wider text-right">
              Status
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border-subtle">
          {receipts.map((receipt) => (
            <ReceiptRow
              key={receipt.id}
              receipt={receipt}
              onDelete={handleDelete}
              isDeleting={deletingId === receipt.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
