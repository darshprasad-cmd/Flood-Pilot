import { NextResponse } from "next/server";
import {
  GOV_COOKIE,
  configuredAccessCode,
  deriveGovToken,
} from "@/lib/gov/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let code = "";
  try {
    const body = (await request.json()) as { code?: string };
    code = body.code?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (code !== configuredAccessCode()) {
    // Deliberately vague: an access-code gate should not confirm partial guesses.
    return NextResponse.json({ error: "Access code not recognised." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: GOV_COOKIE,
    value: await deriveGovToken(code),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: GOV_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
