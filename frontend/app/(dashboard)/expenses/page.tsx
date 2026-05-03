import { ExpenseTable } from "@/components/expenses/expense-table";

export default function ExpensesPage() {
  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-[24px] font-heading text-text-primary tracking-tight">Expenses</h1>
        <p className="mt-1 text-[13px] text-text-muted">Review, filter, and export spend with full receipt traceability</p>
      </div>
      <ExpenseTable />
    </div>
  );
}
