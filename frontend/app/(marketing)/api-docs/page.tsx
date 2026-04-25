"use client";

import { useState } from "react";

const endpoints = [
  {
    category: "Authentication",
    items: [
      { method: "POST", path: "/api/v1/auth/register", desc: "Create new account" },
      { method: "POST", path: "/api/v1/auth/login", desc: "Authenticate user" },
      { method: "POST", path: "/api/v1/auth/refresh", desc: "Refresh access token" },
      { method: "POST", path: "/api/v1/auth/logout", desc: "Invalidate session" },
    ],
  },
  {
    category: "Receipts",
    items: [
      { method: "POST", path: "/api/v1/receipts/upload", desc: "Upload receipt images/PDFs" },
      { method: "GET", path: "/api/v1/receipts", desc: "List all receipts" },
      { method: "GET", path: "/api/v1/receipts/:id", desc: "Get receipt details" },
      { method: "DELETE", path: "/api/v1/receipts/:id", desc: "Delete receipt" },
    ],
  },
  {
    category: "Expenses",
    items: [
      { method: "POST", path: "/api/v1/expenses", desc: "Create expense record" },
      { method: "GET", path: "/api/v1/expenses", desc: "List expenses" },
      { method: "PUT", path: "/api/v1/expenses/:id", desc: "Update expense" },
      { method: "DELETE", path: "/api/v1/expenses/:id", desc: "Delete expense" },
    ],
  },
  {
    category: "Category Rules",
    items: [
      { method: "GET", path: "/api/v1/rules", desc: "List auto-categorization rules" },
      { method: "POST", path: "/api/v1/rules", desc: "Create new rule" },
      { method: "PUT", path: "/api/v1/rules/:id", desc: "Update rule" },
      { method: "DELETE", path: "/api/v1/rules/:id", desc: "Delete rule" },
    ],
  },
  {
    category: "Exceptions",
    items: [
      { method: "GET", path: "/api/v1/exceptions", desc: "List exceptions" },
      { method: "GET", path: "/api/v1/exceptions/stats", desc: "Exception statistics" },
      { method: "POST", path: "/api/v1/exceptions/:id/resolve", desc: "Resolve exception" },
      { method: "POST", path: "/api/v1/exceptions/:id/dismiss", desc: "Dismiss exception" },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
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
            <span className="text-text-ghost">Base URL:</span> https://api.receiptmind.io/api/v1
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
