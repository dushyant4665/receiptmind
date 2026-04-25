"use client";

import { startTransition, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadApiData } from "@/lib/api-client";

type UploadResponse = {
  receipts: Array<{ id: string }>;
};

export function UploadDropzone() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { data: session } = useSession();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    if (!session?.accessToken) {
      toast.error("Sign in again to upload receipts.");
      return;
    }

    setIsUploading(true);
    setProgress(18);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("receipts", file);
    });

    try {
      startTransition(() => {
        window.setTimeout(() => setProgress(42), 150);
        window.setTimeout(() => setProgress(66), 300);
      });

      const response = await uploadApiData<UploadResponse>("/receipts/upload", formData, {
        authToken: session.accessToken,
      });

      setProgress(100);
      toast.success(`${response.receipts.length} receipt${response.receipts.length === 1 ? "" : "s"} uploaded.`);
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
    } catch {
      toast.error("Upload failed. Please try again.");
      setProgress(0);
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <section className="rounded-[12px] border border-border-default bg-bg-surface">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="font-sans text-[15px] font-medium tracking-[-0.1px] text-text-primary">
          Bulk upload receipts
        </h2>
      </div>
      <div className="space-y-6 p-5">
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
          className="flex w-full cursor-pointer flex-col items-center gap-2.5 rounded-[12px] border-[1.5px] border-dashed border-border-default bg-bg-surface p-9 text-center transition-[background-color,border-color] duration-200 hover:border-border-strong hover:bg-amber-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        >
          <span className="flex size-10 items-center justify-center rounded-[10px] border border-border-default bg-bg-page text-text-secondary">
            <UploadCloud className="size-[18px]" strokeWidth={1.5} />
          </span>
          <span className="text-[14px] font-medium text-text-primary">
            {isUploading ? "Uploading receipts..." : "Drag files here or click to upload"}
          </span>
          <span className="max-w-md text-[12px] leading-[1.6] text-text-muted">
            Files are sent to the Go backend receipt endpoint and processed with your configured
            storage pipeline.
          </span>
          <span className="mt-0.5 flex gap-1.5">
            {["PDF", "JPG", "PNG", "HEIC"].map((type) => (
              <span key={type} className="rounded-[4px] bg-bg-subtle px-2 py-0.5 font-mono text-[11px] text-text-muted">
                {type}
              </span>
            ))}
          </span>
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px] text-text-muted">
            <span>Upload progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <Button variant="ghost" onClick={() => setProgress(0)} disabled={isUploading}>
          Reset queue
        </Button>
      </div>
    </section>
  );
}
