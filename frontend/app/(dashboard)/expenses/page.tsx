import { ExpenseTable } from "@/components/expenses/expense-table";
import { SectionHeading } from "@/components/common/section-heading";

export default function ExpensesPage() {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Expense ledger"
        title="Review, filter, and export spend with full receipt traceability."
        description="Operations-friendly tables for reimbursements, AP sync, and supplier trend monitoring."
        align="left"
      />
      <ExpenseTable />
    </div>
  );
}
