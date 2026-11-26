import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: Landing page, auth pages, and public data APIs.
// The Trick page (/trick-in-nse) is strictly protected for logged-in users only.
const isPublicRoute = createRouteMatcher([
  "/",              // Landing / home page
  "/sign-in(.*)",   // Clerk sign-in (all sub-paths)
  "/sign-up(.*)",   // Clerk sign-up (all sub-paths)
  "/prices(.*)",    // Prices page — public
  "/stock(.*)",     // Stock chart page — public
  "/sheetflow(.*)", // Sheet Flow page — public
  // Public data APIs — market data, no user-specific content
  "/api/batch-prices(.*)",
  "/api/stock-data(.*)",
  "/api/candles(.*)",
  "/api/nse-gaps(.*)",
  "/api/scanner-5c(.*)",
  "/api/scanner-3c(.*)",
  "/api/scanner-rsi(.*)",
  "/api/setup-db(.*)",
  "/api/signals(.*)",
  "/api/export-tricks(.*)",
  "/api/sync-scanners(.*)",
  "/api/new-trick(.*)",
  "/api/cron/chartink-gap(.*)",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    // Throws and redirects to sign-in if the user is not authenticated
    await auth.protect();
  }
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};