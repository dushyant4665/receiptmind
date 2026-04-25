import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="border-t border-border-default bg-bg-page px-4 py-24 text-center md:px-8">
      <div className="mx-auto max-w-[520px]">
        <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
          Ready to save 8 to 12 hours
          <br />
          every month?
        </h2>
        <p className="mx-auto mt-4 max-w-[400px] text-[15px] leading-[1.65] text-text-muted">
          Join thousands of operators and finance teams who stopped wasting time on manual receipt entry.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button variant="amber" asChild>
            <Link href="/signup">Try free - no card needed</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="#demo" className="inline-flex items-center gap-2">
              See a demo
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-[12px] text-text-ghost">No credit card required. Free tier available.</p>
      </div>
    </section>
  );
}
