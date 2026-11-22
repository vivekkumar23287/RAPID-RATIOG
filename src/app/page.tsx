"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import HeroNew from "@/components/HeroNew";
import ScrollShowcase from "@/components/ScrollShowcase";
import MarqueeSection from "@/components/MarqueeSection";
import ServicesSection from "@/components/ServicesSection";
import StocksBadgeSection from "@/components/Stocksbadgesection";
import { LogosSection, FutureSection } from "@/components/Logosandfuture";
import ScrollCTA from "@/components/ScrollCTA";
import Footer from "@/components/Footer";
import { fetchBatchPricesCached, markAppReady, prefetchAllNiftyPrices, prefetchAllTricksData } from "@/lib/data-cache";

// Canvas components that need browser window/document APIs
const EquiductBackground = dynamic(() => import("@/components/EquiductBackground"), { ssr: false });
const InteractiveDemo = dynamic(() => import("@/components/InteractiveDemo"), { ssr: false });

const CRITICAL_HOME_SYMBOLS = ["NIFTY50", "POLYCAB", "IFORGE", "IEX", "DEEPAKNI", "COCHINSHIP"];

export default function HomePage() {
  useEffect(() => {
    // 1. Fetch critical home badge data before marking ready
    fetchBatchPricesCached(CRITICAL_HOME_SYMBOLS)
      .finally(() => {
        markAppReady();
      });

    // 2. Idle prefetch: pre-warm the full Nifty 50 dataset & Tricks data for instant transitions
    const idleTimer = setTimeout(() => {
      prefetchAllNiftyPrices();
      prefetchAllTricksData();
    }, 1200);

    return () => clearTimeout(idleTimer);
  }, []);

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