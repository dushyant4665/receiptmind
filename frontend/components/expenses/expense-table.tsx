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
    <section className="rounded-[12px] border border-border-default bg-bg-surface">
      <div className="flex flex-col gap-4 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-sans text-[15px] font-medium tracking-[-0.1px] text-text-primary">
          Spend by submission
        </h2>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vendor, category, or status"
            className="pl-9"
          />
        </div>
      </div>
      <div className="p-5">
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
                  <div className="font-medium text-text-primary">{expense.vendorName}</div>
                  <div className="text-[12px] text-text-muted">{expense.description}</div>
                </TableCell>
                <TableCell className="font-mono text-[12px] text-text-muted">{expense.date}</TableCell>
                <TableCell>
                  <span className="rounded-[4px] bg-[var(--cat-software-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--cat-software-text)]">
                    {expense.category}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-[12px] ${
                      expense.status === "approved" ? "text-success" : "text-amber"
                    }`}
                  >
                    <span
                      className={`mr-1 inline-block size-1.5 rounded-full ${
                        expense.status === "approved" ? "bg-success" : "bg-amber"
                      }`}
                    />
                    {expense.status}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium text-text-primary tabular-nums">
                  {expense.currency} {expense.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-text-muted">
                  No expenses matched your current filter.
                </TableCell>
              </TableRow>
            )}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-text-muted">
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
