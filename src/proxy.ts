import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the home/landing page and Clerk auth pages are public.
// Everything else requires a signed-in user.
const isPublicRoute = createRouteMatcher([
  "/",             // Landing / home page
  "/sign-in(.*)", // Clerk sign-in (all sub-paths)
  "/sign-up(.*)", // Clerk sign-up (all sub-paths)
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