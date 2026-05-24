"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, patchApiData, deleteApiData, uploadApiData } from "@/lib/api-client";
import { getApiUrl } from "@/lib/env";
import { toast } from "sonner";
import type { Receipt, ReceiptListResponse, ReceiptUploadResponse, Exception } from "@/types";

export type ReceiptStatus = "pending" | "processing" | "processed" | "failed";

// Backend receipt shape from Go API
type BackendReceipt = {
  id: string;
  organization_id: string;
  user_id: string;
  file_path: string;
  status: string;
  raw_vendor_name?: string | null;
  raw_amount?: number | null;
  raw_date?: string | null;
  raw_category?: string | null;
  raw_confidence?: number | null;
  vendor_name?: string | null;
  amount?: number | null;
  receipt_date?: string | null;
  category?: string | null;
  confidence?: number | null;
  created_at: string;
  exceptions?: BackendException[];
};

type BackendException = {
  id: string;
  receipt_id: string;
  organization_id: string;
  type: string;
  field: string;
  message: string;
  status: string;
  created_at: string;
};

type BackendReceiptListResponse = {
  receipts: BackendReceipt[];
  total: number;
  limit: number;
  offset: number;
};

function mapReceipt(r: BackendReceipt): Receipt {
  return {
    id: r.id,
    organizationId: r.organization_id,
    userId: r.user_id,
    filePath: r.file_path,
    status: r.status,
    rawVendorName: r.raw_vendor_name,
    rawAmount: r.raw_amount == null ? null : Number(r.raw_amount),
    rawDate: r.raw_date,
    rawCategory: r.raw_category,
    rawConfidence: r.raw_confidence,
    vendorName: r.vendor_name,
    amount: r.amount == null ? null : Number(r.amount),
    receiptDate: r.receipt_date,
    category: r.category,
    confidence: r.confidence ?? null,
    createdAt: r.created_at,
    fileUrl: r.file_path,
    exceptions: r.exceptions?.map(mapException),
  };
}

function mapException(e: BackendException): Exception {
  return {
    id: e.id,
    receiptId: e.receipt_id,
    organizationId: e.organization_id,
    type: e.type,
    field: e.field,
    message: e.message,
    status: e.status,
    createdAt: e.created_at,
  };
}

const API_URL = getApiUrl();

// ==================== USE RECEIPTS (with polling) ====================
export function useReceipts() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  return useQuery({
    queryKey: ["receipts", token],
    queryFn: async () => {
      const result = await getApiData<BackendReceiptListResponse>("/receipts?limit=50", {
        authToken: token,
      });
      return result.receipts.map(mapReceipt);
    },
    enabled: status === "authenticated" && !!token,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchInterval: (query) => {
      const data = query.state.data as Receipt[] | undefined;
      if (data?.some((r) => r.status === "pending" || r.status === "processing")) {
        return 2000;
      }
      return false;
    },
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}

// ==================== USE SINGLE RECEIPT (with polling) ====================
export function useReceipt(receiptId: string | null) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useQuery({
    queryKey: ["receipt", token, receiptId],
    queryFn: async () => {
      if (!receiptId) return null;
      const r = await getApiData<BackendReceipt>(`/receipts/${receiptId}`, {
        authToken: token,
      });
      return mapReceipt(r);
    },
    enabled: !!receiptId && !!token,
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 2,
    refetchInterval: (query) => {
      const data = query.state.data as Receipt | null;
      if (data?.status === "pending" || data?.status === "processing") {
        return 2000;
      }
      return false;
    },
    retry: 2,
  });
}

// ==================== USE UPLOAD (optimistic) ====================
export function useUploadReceipts() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useMutation({
    mutationFn: async (files: File[]) => {
      const results: ReceiptUploadResponse[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadApiData<ReceiptUploadResponse>("/receipts/upload", formData, {
          authToken: token,
        });
        results.push(result);
      }
      return results;
    },

    onMutate: async (files) => {
      await queryClient.cancelQueries({ queryKey: ["receipts"] });
      const previousReceipts = queryClient.getQueryData<Receipt[]>(["receipts"]);

      const optimisticReceipts: Receipt[] = files.map((file) => ({
        id: `optimistic-${crypto.randomUUID()}`,
        organizationId: "",
        userId: "",
        filePath: "",
        status: "pending",
        vendorName: "Processing...",
        amount: null,
        receiptDate: null,
        category: "",
        confidence: null,
        createdAt: new Date().toISOString(),
        fileUrl: URL.createObjectURL(file),
      }));

      queryClient.setQueryData<Receipt[]>(["receipts"], (old) => {
        return [...optimisticReceipts, ...(old || [])];
      });

      return { previousReceipts, optimisticReceipts };
    },

    onSuccess: (results, _variables, context) => {
      queryClient.setQueryData<Receipt[]>(["receipts"], (old) => {
        if (!old) return [];

        const withoutOptimistic = old.filter(
          (r) => !context?.optimisticReceipts.some((o) => o.id === r.id),
        );

        const newReceipts: Receipt[] = results.map((res) => ({
          id: res.receipt_id,
          organizationId: "",
          userId: "",
          filePath: "",
          status: "pending",
          vendorName: "Processing...",
          amount: null,
          receiptDate: null,
          category: "",
          confidence: null,
          createdAt: new Date().toISOString(),
        }));

        return [...newReceipts, ...withoutOptimistic];
      });

      toast.success(`${results.length} receipt(s) uploaded`);
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },

    onError: (error, _variables, context) => {
      if (context?.previousReceipts) {
        queryClient.setQueryData(["receipts"], context.previousReceipts);
      }
      toast.error(error.message || "Upload failed");
    },
  });
}

// ==================== USE UPDATE RECEIPT (optimistic) ====================
export function useUpdateReceipt() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Record<string, unknown>;
    }) => {
      return await patchApiData<Receipt, Record<string, unknown>>(`/receipts/${id}`, updates, {
        authToken: token,
      });
    },

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["receipt", token, id] });
      await queryClient.cancelQueries({ queryKey: ["receipts"] });

      const previousReceipt = queryClient.getQueryData<Receipt>(["receipt", token, id]);
      const previousReceipts = queryClient.getQueryData<Receipt[]>(["receipts"]);

      queryClient.setQueryData<Receipt>(["receipt", token, id], (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      queryClient.setQueryData<Receipt[]>(["receipts"], (old) => {
        if (!old) return old;
        return old.map((r) => (r.id === id ? { ...r, ...updates } : r));
      });

      return { previousReceipt, previousReceipts };
    },

    onError: (_error, variables, context) => {
      if (context?.previousReceipt) {
        queryClient.setQueryData(["receipt", token, variables.id], context.previousReceipt);
      }
      if (context?.previousReceipts) {
        queryClient.setQueryData(["receipts"], context.previousReceipts);
      }
      toast.error("Failed to update receipt");
    },

    onSuccess: () => {
      toast.success("Receipt updated");
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["receipt", token, variables.id] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}

// ==================== USE DELETE RECEIPT (optimistic) ====================
export function useDeleteReceipt() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteApiData(`/receipts/${id}`, { authToken: token });
      return id;
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["receipts"] });
      const previousReceipts = queryClient.getQueryData<Receipt[]>(["receipts"]);

      queryClient.setQueryData<Receipt[]>(["receipts"], (old) => {
        if (!old) return old;
        return old.filter((r) => r.id !== id);
      });

      return { previousReceipts };
    },

    onSuccess: () => {
      toast.success("Receipt deleted");
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },

    onError: (_error, _id, context) => {
      if (context?.previousReceipts) {
        queryClient.setQueryData(["receipts"], context.previousReceipts);
      }
      toast.error("Failed to delete receipt");
    },
  });
}

// ==================== RETRY WRAPPER ====================
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError!;
}
