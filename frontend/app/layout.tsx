import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Providers } from "@/components/common/providers";
import { authOptions } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReceiptMind - Stop typing. Start uploading.",
  description: "AI-powered receipt processing for operators and finance teams.",
  keywords: "receipt scanner, expense management, AI OCR, bookkeeping automation",
  authors: [{ name: "ReceiptMind" }],
  openGraph: {
    title: "ReceiptMind - Stop typing. Start uploading.",
    description: "AI-powered receipt processing for operators and finance teams.",
    type: "website",
    locale: "en_US",
    siteName: "ReceiptMind",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReceiptMind - Stop typing. Start uploading.",
    description: "AI-powered receipt processing for operators and finance teams.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full font-sans antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
