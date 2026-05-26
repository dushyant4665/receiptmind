"use client";

import { useState } from "react";

const endpoints = [
  {
    category: "Authentication",
    items: [
      { method: "POST", path: "/auth/register", desc: "Create new account" },
      { method: "POST", path: "/auth/login", desc: "Authenticate user" },
      { method: "POST", path: "/auth/refresh", desc: "Refresh access token" },
      { method: "POST", path: "/auth/logout", desc: "Invalidate session" },
    ],
  },
  {
    category: "Receipts",
    items: [
      { method: "POST", path: "/receipts/upload", desc: "Upload receipt images or PDFs" },
      { method: "GET", path: "/receipts", desc: "List all receipts" },
      { method: "GET", path: "/receipts/:id", desc: "Get receipt details" },
      { method: "PATCH", path: "/receipts/:id", desc: "Edit receipt fields" },
      { method: "DELETE", path: "/receipts/:id", desc: "Delete receipt" },
      { method: "POST", path: "/receipts/bulk/export", desc: "Export selected receipts as CSV" },
    ],
  },
  {
    category: "Expenses",
    items: [
      { method: "GET", path: "/expenses", desc: "List expense-style receipt records" },
    ],
  },
  {
    category: "Category Rules",
    items: [
      { method: "GET", path: "/rules", desc: "List auto-categorization rules" },
      { method: "POST", path: "/rules", desc: "Create new rule" },
    ],
  },
  {
    category: "Exceptions",
    items: [
      { method: "GET", path: "/exceptions", desc: "List exceptions" },
      { method: "POST", path: "/exceptions/:id/resolve", desc: "Resolve exception" },
    ],
  },
  {
    category: "Exports and Metrics",
    items: [
      { method: "GET", path: "/exports/csv", desc: "Export receipts as CSV" },
      { method: "GET", path: "/exports/history", desc: "List export history" },
      { method: "GET", path: "/metrics/processing-times", desc: "View processing duration summary" },
      { method: "GET", path: "/metrics/summary", desc: "View receipt and exception summary" },
      { method: "GET", path: "/dashboard", desc: "Get dashboard statistics" },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
  PATCH: "bg-amber-100 text-amber-700",
  PUT: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

export default function ApiDocsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className="bg-bg-page px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="font-heading text-[32px] text-text-primary md:text-[40px]">API Reference</h1>
          <p className="mt-4 text-[15px] text-text-muted">
            RESTful API for integrating ReceiptMind into your workflow
          </p>
        </div>

        <div className="mt-8 rounded-[12px] border border-border-default bg-bg-surface p-4">
          <p className="font-mono text-[13px] text-text-secondary">
            <span className="text-text-ghost">Base URL:</span> https://your-backend-domain.com
          </p>
        </div>

        <div className="mt-12 grid gap-8">
          {endpoints.map((group) => (
            <section key={group.category}>
              <h2 className="text-[18px] font-medium text-text-primary">{group.category}</h2>
              <div className="mt-4 space-y-3">
                {group.items.map((endpoint) => (
                  <button
                    key={endpoint.path}
                    onClick={() => setSelected(selected === endpoint.path ? null : endpoint.path)}
                    className="flex w-full items-center gap-4 rounded-[8px] border border-border-default bg-bg-surface p-4 text-left transition-colors hover:border-border-strong"
                  >
                    <span className={`rounded-[4px] px-2 py-1 font-mono text-[11px] font-medium ${methodColors[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-[13px] text-text-primary">{endpoint.path}</span>
                    <span className="ml-auto text-[13px] text-text-muted">{endpoint.desc}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-[12px] border border-border-default bg-bg-surface p-6">
          <h3 className="text-[16px] font-medium text-text-primary">Authentication</h3>
          <p className="mt-2 text-[14px] text-text-muted">
            Include your JWT token in the Authorization header:
          </p>
          <code className="mt-3 block rounded-[8px] bg-bg-page p-4 font-mono text-[13px] text-text-secondary">
            Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
          </code>
        </div>
      </div>
    </main>
  );
}
