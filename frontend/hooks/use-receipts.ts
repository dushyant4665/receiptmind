"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, deleteApiData, uploadApiData, patchApiData } from "@/lib/api-client";
import type { Receipt, ReceiptListResponse, ReceiptUploadResponse, Exception } from "@/types";
import { toast } from "sonner";

type BackendReceipt = {
  id: string;
  organization_id: string;
  user_id: string;
  file_path: string;
  file_url?: string | null;
  file_name?: string | null;
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
  error_message?: string | null;
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
    confidence: r.confidence,
    createdAt: r.created_at,
    fileUrl: r.file_url ?? r.file_path,
    exceptions: r.exceptions?.map(mapException),
    errorMessage: r.error_message,
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

export type ReceiptFilters = {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
};

export function useReceipts(limit = 50, offset = 0, filters?: ReceiptFilters) {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["receipts", session?.accessToken, limit, offset, filters],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (filters?.search) params.set("search", filters.search);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.startDate) params.set("start_date", filters.startDate);
      if (filters?.endDate) params.set("end_date", filters.endDate);
      if (filters?.minAmount != null) params.set("min_amount", String(filters.minAmount));
      if (filters?.maxAmount != null) params.set("max_amount", String(filters.maxAmount));

      const result = await getApiData<BackendReceiptListResponse>(
        `/receipts?${params.toString()}`,
        { authToken: session?.accessToken },
      );

      return {
        receipts: result.receipts.map(mapReceipt),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      } satisfies ReceiptListResponse;
    },
  });
}

export function useReceipt(receiptId: string) {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["receipt", session?.accessToken, receiptId],
    enabled: status === "authenticated" && Boolean(session?.accessToken) && Boolean(receiptId),
    refetchInterval: (query) => {
      const data = query.state.data as Receipt | undefined;
      if (data?.status === "pending" || data?.status === "processing") {
        return 2000;
      }
      return false;
    },
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const receipt = await getApiData<BackendReceipt>(`/receipts/${receiptId}`, {
        authToken: session?.accessToken,
      });

      return mapReceipt(receipt);
    },
  });
}

export function useUploadReceipt() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return uploadApiData<ReceiptUploadResponse>("/receipts/upload", formData, {
        authToken: session?.accessToken,
      });
    },
    onSuccess: () => {
      toast.success("Receipt uploaded");
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 402) {
        toast.error("Monthly receipt limit reached. Upgrade your plan to continue.", { id: "paywall" });
      } else if (error.status === 409) {
        toast.error("This file was already uploaded (duplicate detected).", { id: "duplicate" });
      } else {
        toast.error(error.message || "Upload failed");
      }
    },
  });
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteApiData(`/receipts/${id}`, { authToken: session?.accessToken });
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["receipts"] });
      const previous = queryClient.getQueryData<ReceiptListResponse>(["receipts"]);
      queryClient.setQueryData<ReceiptListResponse>(["receipts"], (old) => {
        if (!old) return old;
        return { ...old, receipts: old.receipts.filter((r) => r.id !== id), total: old.total - 1 };
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Receipt deleted");
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["receipts"], context.previous);
      }
      toast.error("Failed to delete receipt");
    },
  });
}

export function useEditReceipt() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ id, edits }: { id: string; edits: Record<string, unknown> }) => {
      return patchApiData(`/receipts/${id}`, edits, { authToken: session?.accessToken });
    },
    onSuccess: (_data, variables) => {
      toast.success("Receipt updated");
      queryClient.invalidateQueries({ queryKey: ["receipt", session?.accessToken, variables.id] });
      queryClient.invalidateQueries({ queryKey: ["receipts", session?.accessToken] });
    },
    onError: () => {
      toast.error("Failed to update receipt");
    },
  });
}

export function useBulkDeleteReceipts() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await deleteApiData("/receipts/bulk", {
        authToken: session?.accessToken,
        config: { data: { receipt_ids: ids } },
      });
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(`${ids.length} receipts deleted`);
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: () => {
      toast.error("Failed to delete receipts");
    },
  });
}

export function useBulkExportReceipts() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await getApiData<Blob>("/receipts/bulk/export", {
        authToken: session?.accessToken,
        config: {
          method: "POST",
          data: { receipt_ids: ids },
          responseType: "blob",
        },
      });

      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bulk_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onSuccess: () => {
      toast.success("Export started");
    },
    onError: () => {
      toast.error("Failed to export receipts");
    },
  });
}
