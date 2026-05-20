"use client";

import { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { getApiUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

interface ReceiptPreviewProps {
  receiptId: string;
  className?: string;
}

export function ReceiptPreview({ receiptId, className }: ReceiptPreviewProps) {
  const { data: session } = useSession();
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptId || !session?.accessToken) return;

    let isMounted = true;
    const fetchImage = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = getApiUrl();
        // Use custom axios-like fetch with auth
        const response = await fetch(`${apiUrl}/api/files/${receiptId}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load receipt (HTTP ${response.status})`);
        }

        const blob = await response.blob();
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        setImageUrl(url);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [receiptId, session?.accessToken]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border-default pb-3">
        <h2 className="text-[15px] font-medium text-text-primary">Receipt preview</h2>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomOut} 
            disabled={zoom <= 0.5 || !!error || loading}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[45px] text-center text-[11px] font-medium text-text-muted">
            {Math.round(zoom * 100)}%
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomIn} 
            disabled={zoom >= 3 || !!error || loading}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleResetZoom}
            disabled={!!error || loading}
            className="h-8 w-8"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative mt-4 flex-1 overflow-auto rounded-[12px] border border-border-default bg-bg-page p-4">
        <div className="flex h-full min-h-[500px] items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-text-ghost" />
              <p className="font-mono text-[11px] text-text-ghost">Loading receipt...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p className="max-w-[200px] text-center font-mono text-[11px]">{error}</p>
            </div>
          ) : imageUrl ? (
            <div
              className="transition-transform duration-200 ease-out"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Receipt Preview"
                className="max-h-[700px] w-auto rounded-[4px] shadow-lg"
              />
            </div>
          ) : (
            <p className="font-mono text-[11px] text-text-ghost">Receipt preview unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}
