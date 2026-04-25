import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-page">
      <Navbar />
      <main className="bg-bg-page">
        <section className="px-4 pb-20 pt-24 md:px-8">
          <div className="mx-auto max-w-[640px] text-center">
            <p className="inline-flex rounded-[20px] border border-border-default px-4 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Receipt intelligence
            </p>
            <h1 className="mt-6 font-heading text-[40px] leading-[1.04] tracking-[-0.8px] text-text-primary md:text-[52px] md:tracking-[-1px]">
              Stop typing.
              <br />
              <em className="italic text-amber">Start uploading.</em>
            </h1>
            <p className="mx-auto mt-4 max-w-[420px] text-[16px] leading-[1.65] text-text-muted">
              AI reads your receipts, extracts every number, and hands you a clean spreadsheet.
              Tax season done in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="amber">
                <Link href="/signup">Try free - no card needed</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/features" className="inline-flex items-center gap-2">
                  See features
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-[12px] text-text-ghost">
              10 receipts free · No credit card · Cancel anytime
            </p>
          </div>
        </section>

        <section className="border-t border-border-default px-4 py-24 md:px-8">
          <div className="mx-auto max-w-[520px] text-center">
            <h2 className="font-heading text-[40px] leading-[1.1] tracking-[-0.8px] text-text-primary">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-[400px] text-[15px] leading-[1.65] text-text-muted">
              Join finance teams that want one reliable workflow from upload to export.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="amber">
                <Link href="/signup">Try free - no card needed</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/features" className="inline-flex items-center gap-2">
                  See features
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-[12px] text-text-ghost">No credit card required. Free tier available.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
