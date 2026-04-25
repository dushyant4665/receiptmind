import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Demo", "Integrations"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "GDPR"],
  },
];

export function Footer() {
  return (
    <footer className="bg-bg-invert px-4 pb-8 pt-12 text-[#666662] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-[240px]">
            <Link href="/" className="flex items-center gap-2" aria-label="ReceiptMind home">
              <span className="flex size-7 items-center justify-center rounded-[6px] bg-text-invert text-[11px] font-medium tracking-[1px] text-bg-invert">
                RM
              </span>
              <span className="text-[15px] font-medium tracking-[-0.3px] text-text-invert">
                ReceiptMind
              </span>
            </Link>
            <p className="mt-3 text-[13px] leading-[1.6] text-[#555552]">
              Stop typing. Start uploading.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#444440]">
                  {column.title}
                </h3>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link}>
                      <Link
                        href={`/${link.toLowerCase().replaceAll(" ", "-")}`}
                        className="text-[13px] text-[#666662] transition-[color] hover:text-[#aaaaaa]"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-border-invert pt-6 md:flex-row md:items-center">
          <p className="text-[12px] text-[#444440]">© 2026 ReceiptMind. All rights reserved.</p>
          <button
            type="button"
            className="w-fit rounded-[8px] border border-border-invert px-3 py-1.5 text-[13px] text-[#666662] transition-[border-color,color] hover:border-[#444440] hover:text-[#aaaaaa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-invert"
          >
            System theme
          </button>
        </div>
      </div>
    </footer>
  );
}
