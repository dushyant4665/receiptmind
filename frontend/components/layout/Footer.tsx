import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/changelog", label: "Changelog" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/api-docs", label: "API Docs" },
      { href: "/features", label: "Integrations" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-bg-invert px-4 pb-8 pt-12 text-[#666662] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[6px] bg-text-invert text-[11px] font-medium tracking-[1px] text-bg-invert">
                RM
              </span>
              <span className="text-[15px] font-medium tracking-[-0.3px] text-text-invert">
                ReceiptMind
              </span>
            </div>
            <p className="mt-3 max-w-[220px] text-[13px] leading-[1.6] text-[#555552]">
              Calm finance software for receipt-heavy teams.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#444440]">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[#666662] transition-[color] hover:text-[#aaaaaa]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border-invert pt-6 text-[12px] text-[#444440] md:flex-row md:items-center md:justify-between">
          <p>&copy; 2026 ReceiptMind. All rights reserved.</p>
          <p>Built for finance teams</p>
        </div>
      </div>
    </footer>
  );
}
