"use client";

import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { useExpenses } from "@/hooks/use-expenses";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ExpenseTable() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const { data, isLoading } = useExpenses(deferredQuery);

  return (
    <section className="rounded-lg border border-border-default bg-white overflow-hidden shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-3.5 md:flex-row md:items-center md:justify-between">
        <h2 className="text-[13px] font-semibold text-text-primary">
          Spend by submission
        </h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-ghost" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vendor, category..."
            className="pl-9 h-8 text-[12px]"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  <div className="text-[12px] font-medium text-text-primary">{expense.vendorName}</div>
                  <div className="text-[11px] text-text-muted">{expense.description}</div>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-text-ghost tabular-nums">{expense.date}</TableCell>
                <TableCell>
                  <span className="rounded-md bg-blue-surface px-2 py-0.5 text-[10px] font-semibold text-blue">
                    {expense.category}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-[11px] font-medium ${
                      expense.status === "approved" ? "text-emerald" : "text-amber"
                    }`}
                  >
                    <span
                      className={`mr-1 inline-block size-1.5 rounded-full ${
                        expense.status === "approved" ? "bg-emerald" : "bg-amber"
                      }`}
                    />
                    {expense.status}
                  </span>
                </TableCell>
                <TableCell className="text-right text-[12px] font-medium text-text-primary tabular-nums">
                  {expense.currency} {expense.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-[12px] text-text-muted">
                  No expenses matched your filter.
                </TableCell>
              </TableRow>
            )}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-[12px] text-text-muted">
                  Loading expenses...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
