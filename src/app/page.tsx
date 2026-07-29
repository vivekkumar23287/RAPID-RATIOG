"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import HeroNew from "@/components/HeroNew";
import ScrollShowcase from "@/components/ScrollShowcase";
import MarqueeSection from "@/components/MarqueeSection";

const EquiductBackground = dynamic(() => import("@/components/EquiductBackground"), { ssr: false });
const ServicesSection = dynamic(() => import("@/components/ServicesSection"));
const InteractiveDemo = dynamic(() => import("@/components/InteractiveDemo"), { ssr: false });
const StocksBadgeSection = dynamic(() => import("@/components/Stocksbadgesection"));
const LogosSection = dynamic(() => import("@/components/Logosandfuture").then(mod => mod.LogosSection));
const FutureSection = dynamic(() => import("@/components/Logosandfuture").then(mod => mod.FutureSection));
const ScrollCTA = dynamic(() => import("@/components/ScrollCTA"));
const Footer = dynamic(() => import("@/components/Footer"));

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