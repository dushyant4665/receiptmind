import { Bot, Layers, CheckCircle2, ShieldCheck, Zap, Database } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Extraction Engine",
    description:
      "Powered by Gemini/OpenRouter to automatically extract Vendor, Amount, Date, and Category from any receipt image or PDF with high accuracy.",
  },
  {
    icon: Zap,
    title: "Asynchronous Queue",
    description:
      "Built on Redis and Bull. Uploads are processed in the background, ensuring zero dropped requests even under massive enterprise load.",
  },
  {
    icon: CheckCircle2,
    title: "Confidence & Exceptions",
    description:
      "Receipts with <75% AI confidence are automatically routed to a dedicated Exceptions Inbox for manual human-in-the-loop review.",
  },
  {
    icon: Database,
    title: "Duplicate Detection",
    description:
      "Cryptographic SHA-256 file hashing instantly detects and blocks duplicate receipt uploads across your entire organization.",
  },
  {
    icon: Layers,
    title: "Smart Rules Engine",
    description:
      "Create custom 'If-This-Then-That' rules to auto-categorize receipts based on vendor names or amounts before they hit your dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-Tenant & JWT Auth",
    description:
      "Enterprise-grade security with strictly scoped organizational data, short-lived access tokens, and HttpOnly refresh tokens.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white px-6 py-24 md:px-10">
      <div className="mx-auto max-w-[1000px]">
        <div className="mx-auto mb-16 max-w-[600px] text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
            A production-ready stack built for scale, speed, and accuracy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-border-subtle bg-bg-page p-8 transition-shadow hover:shadow-md"
            >
              <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-white border border-border-subtle text-text-primary shadow-sm">
                <feature.icon className="size-5" strokeWidth={2} />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight text-text-primary">
                {feature.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
