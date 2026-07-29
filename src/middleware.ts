import { NextResponse, type NextRequest } from "next/server";
import { GOV_COOKIE, verifyGovToken } from "@/lib/gov/auth";

/**
 * Gate the government dashboard.
 *
 * Enforced here rather than in the page so that the API behind it is protected
 * too — a dashboard whose data endpoint is open is not gated, it is hidden.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isGovPage = pathname === "/gov" || pathname.startsWith("/gov/");
  const isGovApi = pathname.startsWith("/api/gov/");
  if (!isGovPage && !isGovApi) return NextResponse.next();

  // The sign-in page and the auth endpoint must stay reachable.
  if (pathname === "/gov/login" || pathname === "/api/gov/auth") {
    return NextResponse.next();
  }

  const authorised = await verifyGovToken(request.cookies.get(GOV_COOKIE)?.value);
  if (authorised) return NextResponse.next();

  if (isGovApi) {
    return NextResponse.json(
      { error: "Authorisation required for the operations dashboard." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/gov/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/gov/:path*", "/api/gov/:path*"],
};
