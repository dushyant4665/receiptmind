import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CTASection } from "@/components/landing/cta-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-page">
      <HeroSection />
      <HowItWorks />
      <FeaturesSection />
      <CTASection />
    </div>
  );
}