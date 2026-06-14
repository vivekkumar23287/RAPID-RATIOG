"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { List, X, ChartLineUp } from "@phosphor-icons/react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "NSE", href: "/prices" },
  { label: "Tricks in NSE", href: "/trick-in-nse" },
  { label: "Crypto", href: "/crypto" },
  { label: "Sheet Flow", href: "/sheetflow" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pillStyle, setPillStyle] = useState({ opacity: 0, left: 0, width: 0 });
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { isSignedIn } = useAuth();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      gsap.fromTo(navRef.current,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "power4.out", delay: 0.1 }
      );
      gsap.fromTo(".nav-link-item",
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out", delay: 0.5 }
      );
      gsap.fromTo(".nav-auth-btn",
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.7)", delay: 0.7 }
      );
    };
    load();
  }, []);

  return (
    <header
      ref={navRef}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        background: scrolled
          ? (isHome ? "rgba(12,74,110,0.85)" : "rgba(255,255,255,0.95)")
          : (isHome ? "transparent" : "rgba(255,255,255,0.95)"),
        backdropFilter: scrolled || !isHome ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled || !isHome ? `1px solid ${isHome ? "rgba(124,255,239,0.12)" : "#E2E8F0"}` : "none",
        boxShadow: scrolled || !isHome ? `0 4px 32px rgba(0,0,0,${isHome ? "0.15" : "0.06"})` : "none",
        padding: "0 2rem",
      }}
    >
      <nav style={{
        maxWidth: "1280px",
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: scrolled ? "80px" : "106px",
        transition: "height 0.3s ease",
      }}>
        
        <Link
          href="https://portfolio159.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", position: "relative" }}
        >
          <img
            src="/logo1.png"
            alt="RapidRatioG Logo"
            style={{
              height: scrolled ? "68px" : "86px",
              width: "auto",
              display: "block",
              position: "relative",
              zIndex: 1,
              transition: "height 0.3s ease",
              filter: "contrast(1.5) brightness(1.1)",
            }}
          />
        </Link>

        
        <div
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", position: "relative" }}
          className="desktop-nav"
          onMouseLeave={() => {
            setHoveredIdx(null);
            setPillStyle({ opacity: 0, left: 0, width: 0 });
          }}
        >
          
          <div
            style={{
              position: "absolute",
              top: "50%",
              height: "36px",
              borderRadius: "100px",
              background: "rgba(124,255,239,0.08)",
              border: "1px solid rgba(124,255,239,0.15)",
              pointerEvents: "none",
              transition: "all 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: "translateY(-50%)",
              opacity: pillStyle.opacity,
              left: pillStyle.left,
              width: pillStyle.width,
              zIndex: 0,
            }}
          />
          {navLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link-item"
              data-nav-idx={i}
              onMouseEnter={(e) => {
                setHoveredIdx(i);
                const rect = e.currentTarget.getBoundingClientRect();
                const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (parentRect) {
                  setPillStyle({
                    opacity: 1,
                    left: rect.left - parentRect.left,
                    width: rect.width,
                  });
                }
              }}
              style={{
                fontFamily: "Satoshi, sans-serif",
                fontWeight: pathname === link.href ? 600 : 500,
                fontSize: "15px",
                color: hoveredIdx === i ? "#7CFFEF" : pathname === link.href ? (isHome ? "#7CFFEF" : "#0F2044") : (isHome ? "#FFFFFF" : "#64748B"),
                textDecoration: "none",
                position: "relative",
                padding: "6px 16px",
                borderRadius: "8px",
                transition: "color 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                background: "transparent",
                zIndex: 1,
              }}
            >
              {link.label}
              {pathname === link.href && hoveredIdx === null && (
                <span style={{
                  position: "absolute", bottom: "0px", left: "16px", right: "16px",
                  height: "2px",
                  background: "linear-gradient(90deg, #7CFFEF, #45E180)",
                  borderRadius: "2px",
                  animation: "slideIn 0.3s ease",
                }} />
              )}
            </Link>
          ))}
        </div>

        
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="desktop-nav">
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button
                  className="nav-auth-btn"
                  style={{
                    fontFamily: "Satoshi, sans-serif", fontWeight: 500, fontSize: "14px",
                    color: isHome ? "#FFFFFF" : "#0F2044", background: "transparent", border: `1.5px solid ${isHome ? "rgba(255,255,255,0.2)" : "#E2E8F0"}`,
                    borderRadius: "10px", padding: "8px 20px", cursor: "pointer",
                    transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#7CFFEF";
                    e.currentTarget.style.color = "#7CFFEF";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isHome ? "rgba(255,255,255,0.2)" : "#E2E8F0";
                    e.currentTarget.style.color = isHome ? "#FFFFFF" : "#0F2044";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  className="nav-auth-btn"
                  style={{
                    fontFamily: "Satoshi, sans-serif", fontWeight: 600, fontSize: "14px",
                    color: "#070B14", background: "linear-gradient(135deg, #00C9A7 0%, #7CFFEF 100%)",
                    border: "none", borderRadius: "10px", padding: "8px 20px", cursor: "pointer",
                    transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                    boxShadow: "0 3px 12px rgba(124,255,239,0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px) scale(1.03)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(124,255,239,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0) scale(1)";
                    e.currentTarget.style.boxShadow = "0 3px 12px rgba(124,255,239,0.3)";
                  }}
                >Get Started</button>
              </SignUpButton>
            </>
          ) : <UserButton />}
        </div>

        
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="mobile-menu-btn"
          style={{
            background: "transparent", border: `1.5px solid ${isHome ? "rgba(255,255,255,0.2)" : "#E2E8F0"}`, borderRadius: "8px",
            cursor: "pointer", color: isHome ? "#FFFFFF" : "#0F2044", display: "none", padding: "6px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7CFFEF"; e.currentTarget.style.color = "#7CFFEF"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = isHome ? "rgba(255,255,255,0.2)" : "#E2E8F0"; e.currentTarget.style.color = isHome ? "#FFFFFF" : "#0F2044"; }}
        >
          {menuOpen ? <X size={22} /> : <List size={22} />}
        </button>
      </nav>

      
      <div style={{
        maxHeight: menuOpen ? "400px" : "0",
        overflow: "hidden",
        transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
        background: "rgba(12, 74, 110, 0.95)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: menuOpen ? "1.25rem 2rem" : "0 2rem",
          display: "flex", flexDirection: "column", gap: "0.75rem",
        }}>
          {navLinks.map((link, i) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{
              fontFamily: "Satoshi, sans-serif", fontWeight: 500, fontSize: "16px",
              color: pathname === link.href ? "#7CFFEF" : "rgba(255,255,255,0.75)",
              textDecoration: "none", padding: "10px 14px", borderRadius: "10px",
              background: pathname === link.href ? "rgba(124,255,239,0.1)" : "transparent",
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? "translateX(0)" : "translateX(-16px)",
              transition: `all 0.3s ease ${i * 0.05}s`,
            }}>
              {link.label}
            </Link>
          ))}
          <div style={{ display: "flex", gap: "10px", paddingTop: "0.5rem" }}>
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button style={{ flex: 1, padding: "11px", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: "10px", background: "transparent", color: "white", fontWeight: 500, cursor: "pointer", fontFamily: "Satoshi, sans-serif" }}>Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, #00C9A7, #7CFFEF)", color: "#070B14", border: "none", borderRadius: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "Satoshi, sans-serif" }}>Get Started</button>
                </SignUpButton>
              </>
            ) : <UserButton />}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @keyframes slideIn {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </header>
  );
}