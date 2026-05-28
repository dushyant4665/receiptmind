import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="border-t border-border-default bg-bg-page px-4 py-24 text-center md:px-8">
      <div className="mx-auto max-w-[520px]">
        <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
          Build a cleaner receipt workflow.
        </h2>
        <p className="mx-auto mt-4 max-w-[400px] text-[15px] leading-[1.65] text-text-muted">
          Start with uploads, extraction, exception review, rules, and CSV exports in one focused workspace.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button variant="amber" asChild>
            <Link href="/signup">Create workspace</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="#workflow" className="inline-flex items-center gap-2">
              See workflow
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-[12px] text-text-ghost">Designed as a focused finance automation portfolio project.</p>
      </div>
    </section>
  );
}
