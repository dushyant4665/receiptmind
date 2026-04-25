import Link from "next/link";

const posts = [
  {
    title: "How to Track Freelance Expenses for Taxes 2026",
    excerpt: "A complete guide for freelancers and independent contractors. Learn what expenses you can deduct, how to categorize them, and the best tools to stay organized before tax season.",
    date: "Jan 15, 2026",
    category: "Taxes",
    slug: "freelance-expenses-taxes-2026",
  },
  {
    title: "Best Receipt Scanning Apps Compared (2026)",
    excerpt: "We tested 10 popular receipt scanning apps including Expensify, Dext, and ReceiptMind. See which one offers the best accuracy, pricing, and features for your business.",
    date: "Jan 10, 2026",
    category: "Reviews",
    slug: "best-receipt-scanning-apps-compared",
  },
  {
    title: "How to Connect Receipts to QuickBooks",
    excerpt: "Step-by-step guide to automatically import receipt data into QuickBooks Online. Save hours of manual data entry and keep your books accurate.",
    date: "Jan 5, 2026",
    category: "Tutorial",
    slug: "connect-receipts-quickbooks",
  },
];

export default function BlogPage() {
  return (
    <main className="bg-bg-page px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="font-heading text-[32px] text-text-primary md:text-[40px]">ReceiptMind Blog</h1>
          <p className="mt-4 text-[15px] text-text-muted">
            Insights on expense management, AI automation, and financial workflows
          </p>
        </div>

        <div className="mt-12 grid gap-6">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-[12px] border border-border-default bg-bg-surface p-6 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center gap-3 text-[12px] text-text-muted">
                <span className="rounded-[4px] bg-amber-surface px-2 py-1 text-amber">{post.category}</span>
                <span>{post.date}</span>
              </div>
              <h2 className="mt-3 text-[20px] font-medium text-text-primary">
                <Link href={`/blog/${post.slug}`} className="hover:text-amber transition-colors">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-[15px] leading-[1.6] text-text-secondary">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-block text-[14px] text-amber hover:text-amber-hover transition-colors"
              >
                Read more →
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[14px] text-text-muted">
            Subscribe to get the latest posts delivered to your inbox.
          </p>
        </div>
      </div>
    </main>
  );
}
