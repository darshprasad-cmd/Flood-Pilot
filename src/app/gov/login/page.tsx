"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gov/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError("Access code not recognised.");
        return;
      }
      router.push(params.get("from") || "/gov");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-raised w-full max-w-sm p-6">
      <p className="eyebrow mb-2">Restricted</p>
      <h1 className="text-lg font-semibold tracking-tight">
        Flood operations dashboard
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
        This view carries resource deployment and infrastructure failure
        predictions. It is not part of the public application.
      </p>

      <label className="mt-5 block">
        <span className="eyebrow mb-1.5 block">Access code</span>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          className="w-full rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-sm outline-none focus:border-signal-500"
          placeholder="Enter access code"
        />
      </label>

      {error ? (
        <p className="mt-2 text-[12px] text-risk-severe">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !code}
        className="mt-4 w-full rounded-lg bg-signal-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-400 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>

      <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-fg-faint">
        Evaluating this build? The development access code is{" "}
        <code className="numeric rounded bg-ink-800 px-1.5 py-0.5 text-fg-muted">
          delhi-flood-control
        </code>
        . Set <code className="numeric">GOV_ACCESS_CODE</code> to change it. A real
        deployment would put SSO in front of this page.
      </p>
    </form>
  );
}

export default function GovLoginPage() {
  return (
    <main className="grid-backdrop grid min-h-dvh place-items-center p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
