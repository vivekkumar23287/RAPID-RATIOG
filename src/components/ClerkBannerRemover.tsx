"use client";

import { useEffect } from "react";

export default function ClerkBannerRemover() {
  useEffect(() => {
    const removeBanner = () => {
      // Find all divs and check for the specific onboarding text
      const allDivs = document.getElementsByTagName("div");
      for (let i = 0; i < allDivs.length; i++) {
        const el = allDivs[i];
        if (
          el.textContent &&
          el.textContent.includes("You've created your first user!") &&
          el.textContent.includes("Configure your application")
        ) {
          // Check if it's the small popup, not the whole page
          const style = window.getComputedStyle(el);
          if (style.position === "fixed" || style.position === "absolute" || el.offsetWidth < 500) {
             el.style.display = "none";
             el.style.setProperty("display", "none", "important");
          }
        }
      }
    };

    // Run immediately
    removeBanner();

    // Run on mutations (when Clerk injects it)
    const observer = new MutationObserver(removeBanner);
    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback interval
    const interval = setInterval(removeBanner, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null;
}
