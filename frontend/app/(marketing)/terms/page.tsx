export default function TermsPage() {
  return (
    <main className="bg-bg-page px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-[32px] text-text-primary md:text-[40px]">Terms of Service</h1>
        <p className="mt-4 text-[15px] text-text-muted">Last updated: January 2026</p>

        <div className="mt-12 space-y-8 text-[15px] leading-[1.7] text-text-secondary">
          <section>
            <h2 className="text-[18px] font-medium text-text-primary">1. Acceptance of Terms</h2>
            <p className="mt-3">
              By using ReceiptMind, you agree to these Terms of Service. If you do not agree, 
              please do not use our platform. We reserve the right to modify these terms at any time.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">2. Service Description</h2>
            <p className="mt-3">
              ReceiptMind provides AI-powered receipt extraction, expense management, and financial 
              reporting tools. We process images and documents to extract structured data including 
              vendor names, amounts, dates, and categories.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">3. Account Responsibilities</h2>
            <p className="mt-3">
              You are responsible for maintaining the confidentiality of your account credentials. 
              You agree to notify us immediately of any unauthorized access. You must ensure 
              you have the right to upload any documents processed through our platform.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">4. Subscription & Billing</h2>
            <p className="mt-3">
              Some features require a paid subscription. Billing occurs monthly or annually based 
              on your selected plan. You may cancel anytime; access continues until the billing period ends.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">5. Limitation of Liability</h2>
            <p className="mt-3">
              ReceiptMind is provided &ldquo;as is&rdquo; without warranties. While we strive for accuracy, 
              we are not liable for financial decisions based on extracted data. Always verify 
              critical financial information before acting on it.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">6. Contact</h2>
            <p className="mt-3">
              For questions about these terms, contact us at support@receiptmind.io.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
