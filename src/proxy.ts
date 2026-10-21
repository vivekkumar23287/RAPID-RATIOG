import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the home/landing page, Clerk auth pages, and public data APIs are public.
const isPublicRoute = createRouteMatcher([
  "/",              // Landing / home page
  "/sign-in(.*)",   // Clerk sign-in (all sub-paths)
  "/sign-up(.*)",   // Clerk sign-up (all sub-paths)
  "/prices(.*)",    // Prices page — public
  "/stock(.*)",     // Stock chart page — public
  "/trick-in-nse(.*)", // Public scanner page
  // Public data APIs — market data, no user-specific content
  "/api/batch-prices(.*)",
  "/api/stock-data(.*)",
  "/api/candles(.*)",
  "/api/nse-gaps(.*)",
  "/api/scanner-5c(.*)",
  "/api/setup-db(.*)",
  "/api/signals(.*)",
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