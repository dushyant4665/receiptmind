"use client";

import { startTransition, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { uploadApiData } from "@/lib/api-client";
import { globalImageCache } from "@/lib/image-cache";
import type { Receipt, LocalOptimisticReceipt } from "@/types";

type UploadResponse = {
  receipt_id: string;
  status: string;
};

export function UploadDropzone() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { data: session } = useSession();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    if (!session?.accessToken) {
      toast.error("Sign in again to upload receipts.");
      return;
    }

    setIsUploading(true);
    setProgress(5);

    // Simulate progress while waiting for AI (0 to 95%)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.floor(Math.random() * 5) + 2;
      });
    }, 600);

    const now = new Date().toISOString();
    const optimisticReceipts: LocalOptimisticReceipt[] = Array.from(files).map((file) => ({
      id: `local-${crypto.randomUUID()}`,
      organizationId: "",
      userId: "",
      filePath: file.name,
      fileUrl: URL.createObjectURL(file),
      status: "processing",
      vendorName: "AI Extracting...",
      amount: null,
      receiptDate: null,
      category: "",
      confidence: null,
      createdAt: now,
      isOptimistic: true,
    }));

    queryClient.setQueryData<Receipt[]>(["receipts", session.accessToken], (current) => [
      ...optimisticReceipts,
      ...(current ?? []),
    ]);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("file", file);
    });

    try {
      const response = await uploadApiData<any>("/receipts/upload", formData, {
        authToken: session.accessToken,
      });

      // Store in global cache for immediate flicker-free display
      if (response.id && response.file_url) {
        globalImageCache[response.id] = response.file_url;
      }

      clearInterval(progressInterval);
      setProgress(100);

      toast.success("Receipt uploaded and processing started!");

      // Force immediate refresh and clear progress after a small delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["receipts"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
        setProgress(0);
        setIsUploading(false);
      }, 800);

    } catch (error: unknown) {
      clearInterval(progressInterval);
      const err = error as { status?: number; message?: string };
      if (err?.status === 402) {
        setShowUpgradeModal(true);
        toast.error("Free limit reached. Upgrade to continue.");
      } else {
        toast.error(err?.message || "Upload failed. Please try again.");
      }
      setProgress(0);
      queryClient.setQueryData<Receipt[]>(["receipts", session.accessToken], (current) =>
        (current ?? []).filter((receipt) => !("isOptimistic" in receipt && (receipt as LocalOptimisticReceipt).isOptimistic)),
      );
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <section className="rounded-lg border border-border-default bg-white overflow-hidden shadow-xs">
      <div className="border-b border-border-subtle px-5 py-3.5">
        <h2 className="text-[13px] font-semibold text-text-primary">
          Upload receipts
        </h2>
      </div>
      <div className="space-y-5 p-5">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          multiple
          className="hidden"
          onChange={(event) => void handleUpload(event.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-2.5 rounded-lg border-2 border-dashed border-border-default bg-bg-page/50 p-8 text-center transition-all duration-200 hover:border-amber hover:bg-amber-surface/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          <span className="flex size-10 items-center justify-center rounded-lg border border-border-default bg-white text-amber shadow-xs">
            <UploadCloud className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-[13px] font-medium text-text-primary">
            {isUploading ? "Uploading receipts..." : "Drag files here or click to upload"}
          </span>
          <span className="max-w-sm text-[11px] leading-relaxed text-text-muted">
            AI-powered extraction processes your receipts automatically after upload.
          </span>
          <span className="mt-1 flex gap-1.5">
            {["PDF", "JPG", "PNG", "HEIC"].map((type) => (
              <span key={type} className="rounded bg-white px-2 py-0.5 border border-border-default font-mono text-[10px] text-text-muted">
                {type}
              </span>
            ))}
          </span>
        </button>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>Progress</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <Button variant="ghost" size="sm" onClick={() => setProgress(0)} disabled={isUploading} className="text-[11px]">
          Reset queue
        </Button>
      </div>

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </section>
  );
}
