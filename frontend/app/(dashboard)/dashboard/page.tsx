import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SectionHeading } from "@/components/common/section-heading";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { UploadDropzone } from "@/components/expenses/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          eyebrow="Operations overview"
          title="Keep your expense program fast, compliant, and audit-ready."
          description="Monitor submission velocity, reimbursement exposure, and policy drift from one executive console."
          align="left"
        />
        <Badge variant="secondary" className="w-fit">
          Quarter close: on track
        </Badge>
      </div>

      <MetricsGrid />
      <UploadDropzone />

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[12px] border border-border-default bg-bg-surface">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="font-sans text-[15px] font-medium tracking-[-0.1px] text-text-primary">
              Automation coverage
            </h2>
          </div>
          <div className="space-y-6 p-5">
            {[
              ["OCR extraction", 96],
              ["Policy auto-approval", 71],
              ["Duplicate detection", 88],
              ["Category confidence", 91],
            ].map(([label, value]) => (
              <div key={label as string} className="space-y-2">
                <div className="flex items-center justify-between text-[13px] text-text-secondary">
                  <span>{label}</span>
                  <span className="font-medium text-text-primary">{value}%</span>
                </div>
                <Progress value={Number(value)} />
              </div>
            ))}
          </div>
        </section>

        <RecentActivity />
      </div>

      <ExpenseTable />
    </div>
  );
}
