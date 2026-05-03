"use client";

import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiUrl } from "@/lib/env";
import { toast } from "sonner";

type CsvExportParams = {
  startDate?: string;
  endDate?: string;
  status?: string;
};

export function useCsvExport() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useMutation({
    mutationFn: async (params: CsvExportParams = {}) => {
      const API_URL = getApiUrl();
      const searchParams = new URLSearchParams();
      if (params.startDate) searchParams.set("start_date", params.startDate);
      if (params.endDate) searchParams.set("end_date", params.endDate);
      if (params.status) searchParams.set("status", params.status);

      const query = searchParams.toString();
      const url = `${API_URL}/receipts/export/csv${query ? `?${query}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("CSV export failed");
      }

      const blob = await response.blob();

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "receipts.csv";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      return filename;
    },
    onSuccess: (filename) => {
      toast.success(`Exported ${filename}`);
    },
    onError: () => {
      toast.error("Failed to export CSV");
    },
  });
}
