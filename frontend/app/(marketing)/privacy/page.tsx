export default function PrivacyPage() {
  return (
    <main className="bg-bg-page px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-[32px] text-text-primary md:text-[40px]">Privacy Policy</h1>
        <p className="mt-4 text-[15px] text-text-muted">Last updated: January 2026</p>

        <div className="mt-12 space-y-8 text-[15px] leading-[1.7] text-text-secondary">
          <section>
            <h2 className="text-[18px] font-medium text-text-primary">1. Information We Collect</h2>
            <p className="mt-3">
              ReceiptMind collects information you provide directly, including your name, email address, 
              company details, and payment information. We also collect receipt images, financial documents, 
              and extracted data you upload to our platform.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">2. How We Use Your Data</h2>
            <p className="mt-3">
              We use your information to provide AI-powered receipt extraction, expense categorization, 
              and financial reporting services. Your data enables us to improve our OCR accuracy, 
              detect duplicates, and generate spending analytics.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">3. Data Security</h2>
            <p className="mt-3">
              We implement bank-grade encryption (AES-256) for data at rest and TLS 1.3 for data in transit. 
              Your financial documents are stored in isolated, encrypted storage with strict access controls.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">4. Third-Party Integrations</h2>
            <p className="mt-3">
              With your consent, we may share data with accounting platforms (QuickBooks, Xero) 
              and email providers (Gmail) to enable automatic receipt fetching. We never sell your 
              financial data to advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-[18px] font-medium text-text-primary">5. Your Rights</h2>
            <p className="mt-3">
              You can access, export, or delete your data at any time from your account settings. 
              Contact support@receiptmind.io for data deletion requests or privacy inquiries.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
