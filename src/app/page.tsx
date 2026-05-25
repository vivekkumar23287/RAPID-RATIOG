import Navbar from "@/components/Navbar";
import HeroNew from "@/components/HeroNew";
import ScrollShowcase from "@/components/ScrollShowcase";
import MarqueeSection from "@/components/MarqueeSection";
import ServicesSection from "@/components/ServicesSection";
import InteractiveDemo from "@/components/InteractiveDemo";
import StocksBadgeSection from "@/components/Stocksbadgesection";
import { LogosSection, FutureSection } from "@/components/Logosandfuture";
import ScrollCTA from "@/components/ScrollCTA";
import Footer from "@/components/Footer";
import EquiductBackground from "@/components/EquiductBackground";

export default function HomePage() {
  return (
    <main className="noise-overlay" style={{ background: "transparent", minHeight: "100vh", position: "relative" }}>
      <EquiductBackground />
      <Navbar />
      <HeroNew />
      <ScrollShowcase />
      <MarqueeSection />
      <ServicesSection />
      <InteractiveDemo />
      <StocksBadgeSection />
      <LogosSection />
      <FutureSection />
      <ScrollCTA />
      <Footer />
    </main>
  );
}