"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData, uploadApiData } from "@/lib/api-client";
import { toast } from "sonner";

export type BankTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  matched_receipt_id: string;
  match_confidence: number;
  status: string;
};

export function useBankTransactions(status?: string) {
  const { data: session, status: authStatus } = useSession();

  return useQuery({
    queryKey: ["bank-transactions", session?.accessToken, status],
    enabled: authStatus === "authenticated" && Boolean(session?.accessToken),
    staleTime: 10_000,
    refetchInterval: 5000,
    queryFn: () => {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      return getApiData<BankTransaction[]>(`/bank/transactions${query}`, {
        authToken: session?.accessToken,
      });
    },
  });
}

export function useImportBankCsv() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return uploadApiData<{ id: string; rows_imported: number }>("/bank/imports", formData, {
        authToken: session?.accessToken,
      });
    },
    onSuccess: (data) => {
      toast.success(`${data.rows_imported} bank rows imported`);
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Bank import failed");
    },
  });
}
