"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getApiData } from "@/lib/api-client";
import type { Expense } from "@/types";

type BackendExpense = {
  id: string;
  vendor_name: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  description: string;
  status: Expense["status"];
};

function mapExpense(expense: BackendExpense): Expense {
  return {
    id: expense.id,
    vendorName: expense.vendor_name,
    amount: Number(expense.amount),
    currency: expense.currency,
    date: expense.date.slice(0, 10),
    category: expense.category || "Uncategorized",
    description: expense.description || "No description",
    status: expense.status,
  };
}

export function useExpenses(query = "") {
  const { data: session, status } = useSession();

  return useQuery({
    queryKey: ["expenses", session?.accessToken, query],
    enabled: status === "authenticated" && Boolean(session?.accessToken),
    queryFn: async () => {
      const expenses = await getApiData<BackendExpense[]>("/expenses", {
        authToken: session?.accessToken,
      });

      return expenses.map(mapExpense);
    },
    select: (expenses) => {
      if (!query) {
        return expenses;
      }

      const normalized = query.toLowerCase();
      return expenses.filter((expense) =>
        [expense.vendorName, expense.category, expense.status, expense.description].some((value) =>
          value.toLowerCase().includes(normalized),
        ),
      );
    },
  });
}
