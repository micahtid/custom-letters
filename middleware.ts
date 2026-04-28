import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect
} from "@convex-dev/auth/nextjs/server";

// Routes that require sign-in. The home page (/) is always accessible —
// it renders the sign-in card itself when the user isn't authenticated.
// `/l/...` is the public letter view and stays open. `/api/auth` is handled
// by Convex auth's proxy and must not be matched here.
const isProtectedRoute = createRouteMatcher([
  "/notes(.*)",
  "/characters(.*)"
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
};
