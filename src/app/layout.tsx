import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import LoadingScreen from "@/components/LoadingScreen";
import GlobalNotification from "@/components/GlobalNotification";

export const metadata: Metadata = {

  title: "RapidRatioG",
  description: "Live Indian stock prices, interactive charts, and Excel integration in one platform.",
  icons: {
    icon: "/logo1.png",
    shortcut: "/logo1.png",
    apple: "/logo1.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{
      elements: {
        devModeHelpBanner: { display: "none" },
        internalDeveloperModeHelpBanner: { display: "none" }
      }
    }}>
      <html lang="en">
        <head>
          
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link
            href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&family=Inter:wght@300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
        </head>
        <body style={{ margin: 0, padding: 0, fontFamily: "Satoshi, sans-serif" }}>
          <LoadingScreen />
          <GlobalNotification />
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </body>

      </html>
    </ClerkProvider>
  );
}