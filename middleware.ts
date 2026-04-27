import { NextResponse, type NextRequest } from "next/server";

const REALM = "Research (private shakedown)";
const USERNAME = "operator";

function isShakedownActive(): boolean {
  // Empty / unset ADMIN_PASSWORD = no gate. Useful for local dev.
  // Set ADMIN_PASSWORD in Vercel env to enable the gate during the 14-day window.
  // At flip-to-public (day 14), narrow the matcher below to /research/admin/:path*.
  return Boolean(process.env.ADMIN_PASSWORD);
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(request: NextRequest): NextResponse {
  if (!isShakedownActive()) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("basic ")) return unauthorized();

  const encoded = header.slice("basic ".length).trim();
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  if (sep < 0) return unauthorized();

  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  const expected = process.env.ADMIN_PASSWORD ?? "";

  if (!timingSafeEqual(user, USERNAME) || !timingSafeEqual(pass, expected)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/research/:path*"],
};
