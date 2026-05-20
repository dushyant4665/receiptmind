"use client";

import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SectionHeading } from "@/components/common/section-heading";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { UploadDropzone } from "@/components/expenses/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ArrowUpRight, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-in">
      {/* Hero */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-amber-surface text-amber border-amber-border/50 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-amber-surface">
              <Zap className="size-3 mr-1 fill-amber" /> Live
            </Badge>
            <Badge variant="outline" className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-text-ghost border-border-default">
              v1.6.2
            </Badge>
          </div>
          <h1 className="font-heading text-[32px] leading-[1.1] tracking-tight text-text-primary lg:text-[40px]">
            Operations Command
          </h1>
          <p className="mt-2 text-[15px] text-text-muted leading-relaxed">
            Monitor submission velocity and reimbursement exposure. Your finance program is currently <span className="font-semibold text-emerald">healthy</span>.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-border-default bg-white p-4 shadow-xs min-w-[180px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-text-ghost uppercase tracking-widest">System Status</span>
              <ShieldCheck className="size-3.5 text-emerald" />
            </div>
            <div className="text-[22px] font-heading text-text-primary">Online</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald font-medium">
              <div className="size-1.5 rounded-full bg-emerald animate-pulse" /> All systems active
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <MetricsGrid />

      {/* Main Grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <UploadDropzone />
          <ExpenseTable />
        </div>

        <aside className="space-y-6">
          <RecentActivity />

          {/* AI Coverage */}
          <section className="rounded-lg border border-border-default bg-white overflow-hidden shadow-xs">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <h2 className="text-[13px] font-semibold text-text-primary flex items-center gap-2">
                <Sparkles className="size-3.5 text-amber" /> Automation Coverage
              </h2>
            </div>
            <div className="space-y-5 p-5">
              {[
                { label: "OCR extraction", value: 96, color: "bg-blue-500" },
                { label: "Duplicate detection", value: 88, color: "bg-amber-500" },
                { label: "Category confidence", value: 91, color: "bg-rose-500" },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-muted font-medium">{item.label}</span>
                    <span className="font-bold text-text-primary tabular-nums">{item.value}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-bg-subtle overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000", item.color)}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-bg-page/50 border-t border-border-subtle">
              <button className="text-[11px] font-semibold text-text-muted hover:text-amber transition-colors w-full text-center uppercase tracking-wider">
                Optimize AI Rules
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
