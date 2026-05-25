"use client";

import Link from "next/link";
import { GithubLogo, LinkedinLogo, Globe, ChartLineUp, ArrowRight } from "@phosphor-icons/react";

// TODO: Replace these with your actual links
const SOCIAL_LINKS = {
  github: "https://github.com/YOUR_GITHUB",
  linkedin: "https://linkedin.com/in/YOUR_LINKEDIN",
  portfolio: "https://YOUR_PORTFOLIO.com",
};

const NAV_LINKS = [
  { group: "Platform", links: [
    { label: "Home", href: "/" },
    { label: "Live Prices", href: "/prices" },
    { label: "Tricks in NSE", href: "/trick-in-nse" },
    { label: "Sheet Flow", href: "/sheetflow" },
  ]},
  { group: "Stocks", links: [
    { label: "Nifty 50", href: "/prices" },
    { label: "Polycab India", href: "/prices" },
    { label: "IEX", href: "/prices" },
    { label: "Deepak Nitrite", href: "/prices" },
  ]},
  { group: "Legal", links: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Disclaimer", href: "#" },
  ]},
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "transparent",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        paddingTop: "4rem",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 2rem",
        }}
      >
        {/* Top row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr repeat(3, 1fr)",
            gap: "3rem",
            paddingBottom: "3rem",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
          className="footer-grid"
        >
          {/* Brand col */}
          <div>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  background: "linear-gradient(135deg, #00C9A7, #7CFFEF)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ChartLineUp size={20} color="#070B14" weight="bold" />
              </div>
              <span
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 800,
                  fontSize: "18px",
                  color: "#FFFFFF",
                  letterSpacing: "-0.3px",
                }}
              >
                Rapid<span style={{ color: "#7CFFEF" }}>RatioG</span>
              </span>
            </Link>

            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "14px",
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.8,
                marginBottom: "1.5rem",
                maxWidth: "280px",
              }}
            >
              Live trading intelligence for Indian markets. Prices, charts, and Excel — all in one place.
            </p>

            {/* Social links */}
            <div style={{ display: "flex", gap: "12px" }}>
              {[
                { icon: <GithubLogo size={18} weight="fill" />, href: SOCIAL_LINKS.github, label: "GitHub" },
                { icon: <LinkedinLogo size={18} weight="fill" />, href: SOCIAL_LINKS.linkedin, label: "LinkedIn" },
                { icon: <Globe size={18} weight="bold" />, href: SOCIAL_LINKS.portfolio, label: "Portfolio" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  style={{
                    width: "38px",
                    height: "38px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.5)",
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(124,255,239,0.15)";
                    e.currentTarget.style.borderColor = "rgba(124,255,239,0.4)";
                    e.currentTarget.style.color = "#7CFFEF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav link groups */}
          {NAV_LINKS.map((group) => (
            <div key={group.group}>
              <h4
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "#FFFFFF",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "1.25rem",
                }}
              >
                {group.group}
              </h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "14px",
                        color: "rgba(255,255,255,0.45)",
                        textDecoration: "none",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#7CFFEF"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter CTA strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "2rem 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap",
            gap: "1.5rem",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "18px",
                color: "#FFFFFF",
                marginBottom: "4px",
              }}
            >
              Stay ahead of the market
            </div>
            <div
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "14px",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Get alerts when new stocks are added or features launch.
            </div>
          </div>
          <Link
            href="/prices"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "linear-gradient(135deg, #00C9A7 0%, #7CFFEF 100%)",
              color: "#070B14",
              borderRadius: "10px",
              padding: "12px 22px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(124,255,239,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            View live prices
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.5rem 0",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            © {new Date().getFullYear()} RapidRatioG. All rights reserved. Not SEBI registered — for informational purposes only.
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Made with ❤️ for Indian traders
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}