"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";
import { getDemoReceipts } from "@/lib/demo-data";
import type { Receipt } from "@/types";

type BackendReceipt = {
  id: string;
  filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  status: string;
  vendor_name?: string;
  amount?: number | null;
  currency?: string;
  date?: string | null;
  receipt_date?: string | null;
  category?: string;
  description?: string;
  created_at: string;
  processed_at?: string | null;
};

function mapReceipt(receipt: BackendReceipt): Receipt {
  return {
    id: receipt.id,
    filename: receipt.filename,
    fileUrl: receipt.file_url,
    fileSize: Number(receipt.file_size ?? 0),
    mimeType: receipt.mime_type ?? "",
    status: receipt.status,
    vendorName: receipt.vendor_name ?? "",
    amount: receipt.amount == null ? undefined : Number(receipt.amount),
    currency: receipt.currency ?? "USD",
    date: (receipt.date ?? receipt.receipt_date ?? undefined)?.slice(0, 10),
    category: receipt.category ?? "",
    description: receipt.description ?? "",
    createdAt: receipt.created_at,
    processedAt: receipt.processed_at ?? undefined,
  };
}

export function useReceipts() {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["receipts", session?.accessToken],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      try {
        const receipts = await getApiData<BackendReceipt[]>("/receipts", {
          authToken: session?.accessToken,
        });

        return receipts.map(mapReceipt);
      } catch {
        return getDemoReceipts();
      }
    },
  });
}

export function useReceipt(receiptId: string) {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["receipt", session?.accessToken, receiptId],
    enabled: status === "authenticated" && Boolean(session?.accessToken) && Boolean(receiptId),
    queryFn: async () => {
      try {
        const receipt = await getApiData<BackendReceipt>(`/receipts/${receiptId}`, {
          authToken: session?.accessToken,
        });

        return mapReceipt(receipt);
      } catch {
        return getDemoReceipts().find((receipt) => receipt.id === receiptId) ?? null;
      }
    },
  });
}
