import Link from "next/link";
import type { Metadata } from "next";
import { AGENT_REGISTRY } from "@/lib/agents/base";
import { DELHI_CREDITS } from "@/lib/cities/delhi";
import { DELHI_HOTSPOTS } from "@/lib/cities/delhi/hotspots";
import { DELHI_PLUGIN } from "@/lib/cities/delhi";

export const metadata: Metadata = {
  title: "FloodPilot — AI Urban Flood Intelligence for Delhi",
  description:
    "FloodPilot predicts where Delhi floods, how deep, and when — then tells you what to do about it. Risk-based routing, vehicle survivability and explainable decisions built on IMD, CWC and OpenStreetMap data.",
};

const RISK_RAMP = [
  "#2fbf6f",
  "#8fc93a",
  "#e8b62c",
  "#f08a3c",
  "#e8503a",
  "#b32b1d",
];

export default function LandingPage() {
  const chronic = DELHI_HOTSPOTS.filter((h) => h.severity === "chronic");

  return (
    <div className="min-h-dvh bg-ink-950">
      <SiteHeader />

      {/* ══ Hero ════════════════════════════════════════════════════════ */}
      <section className="grid-backdrop relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{
            background:
              "radial-gradient(900px 380px at 50% -10%, rgba(43,140,240,0.16), transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
          <p className="eyebrow mb-5">
            Delhi NCR · Version 1
          </p>

          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Delhi floods in four different ways.
            <span className="block text-fg-muted">
              A weather app tells you about one of them.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            FloodPilot predicts where the city waterlogs, how deep, and when —
            from cloudbursts, from trunk drains backing up hours after the rain,
            from underpasses filling like the sealed boxes they are, and from the
            Yamuna crossing 205.33 m and reversing the city&apos;s outfalls. Then it
            tells one specific person, in one specific vehicle, what to do about it.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-xl bg-signal-500 px-6 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-signal-600/25 transition-all hover:bg-signal-400 hover:shadow-signal-500/30"
            >
              Launch App
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <path
                  d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <a
              href="#how"
              className="rounded-xl border border-line-bright px-5 py-3.5 text-[14px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              How it works
            </a>

            <span className="text-[12px] text-fg-faint">
              No sign-up. Runs on live open data.
            </span>
          </div>

          {/* Risk ramp as a visual signature */}
          <div className="mt-14 max-w-2xl">
            <div className="flex gap-1">
              {RISK_RAMP.map((color, i) => (
                <div
                  key={color}
                  className="animate-rise h-1.5 flex-1 rounded-full"
                  style={{ background: color, animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-fg-faint">
              <span>Passable</span>
              <span>Impassable</span>
            </div>
          </div>

          <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-7 sm:grid-cols-4">
            <Stat value="120" label="Road segments modelled" />
            <Stat value={String(DELHI_HOTSPOTS.length)} label="Waterlogging points" />
            <Stat value="7" label="Trunk drains tracked" />
            <Stat value="1,475" label="OSM drainage channels" />
          </dl>
        </div>
      </section>

      {/* ══ The problem ═════════════════════════════════════════════════ */}
      <Section id="problem" eyebrow="Why Delhi is different">
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          The city has almost no gravity to work with.
        </h2>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-fg-muted">
          {DELHI_PLUGIN.floodCharacter}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Mechanism
            title="Cloudburst"
            detail="Rainfall intensity overwhelms the storm network in twenty minutes. Warning time is short and the water arrives from above."
            accent="#4aa8ff"
          />
          <Mechanism
            title="Drain backup"
            detail="The Najafgarh drain runs full and pushes water back onto Zakhira and Punjabi Bagh hours after the rain has stopped."
            accent="#e8b62c"
          />
          <Mechanism
            title="Underpass filling"
            detail="Minto Bridge and Pul Prahladpur are sealed boxes below grade. Water leaves only by pump, and it goes deep enough to submerge a bus."
            accent="#f08a3c"
          />
          <Mechanism
            title="River flooding"
            detail="Above 205.33 m at Old Railway Bridge the outfalls reverse. Warned two days ahead by a Hathnikund release, and lasts for days."
            accent="#e8503a"
          />
        </div>
      </Section>

      {/* ══ How it works ════════════════════════════════════════════════ */}
      <Section id="how" eyebrow="How it works" tinted>
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          From rainfall to a decision, in four steps.
        </h2>

        <ol className="mt-10 grid gap-8 lg:grid-cols-4">
          <Step
            number="01"
            title="Signals"
            detail="Rainfall, ground saturation, elevation, traffic, river stage, drainage geography and citizen reports. Official Indian sources first — IMD for rain, CWC for the Yamuna — with open fallbacks that are always labelled as such."
          />
          <Step
            number="02"
            title="Road risk graph"
            detail="The city as a graph of 87 junctions and 120 road segments. Each carries elevation, slope, catchment, drain condition, trunk-drain proximity, floodplain exposure and flood history."
          />
          <Step
            number="03"
            title="Waterlogging engine"
            detail="Per road: accumulation probability, depth over time, drain overflow likelihood, time until impassable, and recovery time once the rain stops. Nine failure modes, each with the basis it rests on."
          />
          <Step
            number="04"
            title="Decision"
            detail="Risk-weighted routing over that graph, judged against your specific vehicle, then an action: leave now, wait, take the Metro, work remotely, or move the car out of the basement before 19:40."
          />
        </ol>
      </Section>

      {/* ══ Features ════════════════════════════════════════════════════ */}
      <Section id="features" eyebrow="What it does">
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Built to answer the question you actually have.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Risk-based routing"
            detail="Not the fastest route — the one you survive. Depth is evaluated at the moment you would reach each road, so a stretch that is clear now but 40 cm deep in eighteen minutes is correctly treated as unsafe."
            proof="Najafgarh → Karol Bagh: 82 min through 1.25 m, or 105 min through 12 cm."
          />
          <Feature
            title="Vehicle survivability"
            detail="Ground clearance is the wrong number. A hatchback and a motorcycle with identical clearance behave completely differently, because what stops you is the air intake, not the axle."
            proof="Safe · Borderline · Unsafe, with the reasoning attached."
          />
          <Feature
            title="Explainable by construction"
            detail="Every recommendation carries a Why panel generated from the model's own feature contributions. The type system makes explanations non-optional — an unexplained output does not compile."
            proof="Never an unexplained AI output."
          />
          <Feature
            title="Confidence that is earned"
            detail="Every prediction exposes a confidence score built from the actual state of its inputs — data source, forecast lead time, terrain quality, historical support, past accuracy on that road. When it is low, it says why."
            proof="81% probability · 88% confidence — and the reason."
          />
          <Feature
            title="Prediction timeline"
            detail="Rain begins, traffic builds, the underpass floods, the route becomes unsafe. Found by re-planning at five-minute steps, which is the only way to locate the moment your window shuts."
            proof="Recommended departure: 07:25."
          />
          <Feature
            title="Live learning"
            detail="Citizen reports of flooding, clear roads, blocked drains and stalled vehicles re-weight predictions immediately, and are recorded against what was forecast so the model gets better on that specific road."
            proof="Corroborated, contradicted and decayed — never trusted blind."
          />
        </div>
      </Section>

      {/* ══ AI architecture ═════════════════════════════════════════════ */}
      <Section id="architecture" eyebrow="AI architecture" tinted>
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Six agents, each replaceable.
        </h2>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-fg-muted">
          The intelligence layer is a set of independent services behind one
          contract. Each returns its data plus its reasoning, its confidence and
          the provenance of every input it used. Swapping the heuristic scoring
          model for a gradient-boosted one means implementing a single interface
          against the same feature spec — nothing downstream changes.
        </p>

        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {AGENT_REGISTRY.map((agent) => (
            <div key={agent.id} className="surface p-5">
              <p className="eyebrow mb-2">{agent.role}</p>
              <h3 className="text-[15px] font-semibold tracking-tight">
                {agent.name}
              </h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
                {agent.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="surface mt-6 p-6">
          <p className="eyebrow mb-4">Data sources, official first</p>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {DELHI_CREDITS.map((credit) => (
              <li key={credit.id} className="flex gap-3">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    credit.requiresKey ? "bg-ink-700" : "bg-risk-safe"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">
                    {credit.name}
                    {credit.requiresKey ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-fg-faint">
                        API key
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11.5px] leading-snug text-fg-faint">
                    {credit.provides.slice(0, 3).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-[11.5px] leading-relaxed text-fg-faint">
            Sources requiring credentials become primary the moment a key is
            configured. Until then the app runs on open data and says so — every
            prediction lists which provider actually answered.
          </p>
        </div>
      </Section>

      {/* ══ Hotspots ════════════════════════════════════════════════════ */}
      <Section id="hotspots" eyebrow="Waterlogging register">
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          The places Delhi already knows will flood.
        </h2>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-fg-muted">
          Loaded as data, not logic. The engine reads them as prior evidence
          rather than special-casing any location — and the register is
          overridable at runtime, because civic bodies republish these lists every
          monsoon.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {chronic.map((hotspot) => (
            <span
              key={hotspot.id}
              className="rounded-lg border border-risk-severe/25 bg-risk-severe/[0.07] px-3 py-1.5 text-[12px] text-fg-muted"
            >
              {hotspot.name}
              <span className="numeric ml-2 text-[11px] text-risk-severe">
                ~{hotspot.typicalDepthCm} cm
              </span>
            </span>
          ))}
        </div>
      </Section>

      {/* ══ Government ══════════════════════════════════════════════════ */}
      <Section id="government" eyebrow="For flood control rooms" tinted>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              A separate view for the people with the pumps.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-fg-muted">
              The same predictions, reframed around a different question. A
              citizen asks whether they can get there; a control room asks where
              to send resources and what fails next. The operations dashboard
              ranks everything by people affected rather than by depth, and it is
              gated in middleware — the API behind it is protected too, because a
              dashboard with an open endpoint is hidden rather than restricted.
            </p>

            <Link
              href="/gov"
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-line-bright px-5 py-3 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              Operations dashboard
              <span className="text-[10px] uppercase tracking-wider text-fg-faint">
                Restricted
              </span>
            </Link>
          </div>

          <ul className="space-y-3">
            {[
              ["Live flood heatmap", "Every road coloured by risk, with trunk drains and the Yamuna as layers."],
              ["Resource deployment", "Pumps and teams allocated against a finite budget, ranked by people protected — and it will tell you when pumping is futile and closure is the answer."],
              ["Predicted drain failures", "Which trunk drain surcharges, where, and how many people that affects."],
              ["Flood hotspots", "The register, live, with current probability and depth against each entry."],
              ["Citizen reports", "The public feed, verifiable against what was predicted."],
              ["Escalation", "I&FC, PWD, MCD, DDMA and Traffic Police control rooms, one tap away."],
            ].map(([title, detail]) => (
              <li key={title} className="surface px-4 py-3">
                <p className="text-[13px] font-semibold">{title}</p>
                <p className="mt-1 text-[12px] leading-snug text-fg-muted">{detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ══ Premium ═════════════════════════════════════════════════════ */}
      <Section id="premium" eyebrow="Premium">
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Free for citizens. Priced where it saves money.
        </h2>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <Tier
            name="Citizen"
            price="Free"
            blurb="Everything a person needs to get home safely."
            features={[
              "Risk-based routing across Delhi NCR",
              "Vehicle survivability for your own vehicle",
              "Prediction timeline and departure window",
              "Basement parking alerts",
              "Report conditions and improve the model",
            ]}
            cta={{ href: "/app", label: "Launch App" }}
            highlighted
          />
          <Tier
            name="Fleet"
            price="Planned"
            blurb="For anyone who moves vehicles across the city for a living."
            features={[
              "Whole-fleet survivability by vehicle class",
              "Depot and route-network exposure",
              "Driver alerts and dispatch integration",
              "Historical incident reconstruction",
              "API access to predictions and routing",
            ]}
          />
          <Tier
            name="Government"
            price="Contact"
            blurb="For municipal bodies and disaster management authorities."
            features={[
              "Operations dashboard and deployment planning",
              "Asset register integration (PWD, I&FC drainage)",
              "Ward-level exposure and post-event reporting",
              "Private deployment with SSO",
              "Custom hotspot register and data feeds",
            ]}
          />
        </div>
      </Section>

      {/* ══ Roadmap ═════════════════════════════════════════════════════ */}
      <Section id="roadmap" eyebrow="Roadmap" tinted>
        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Delhi is version one.
        </h2>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-fg-muted">
          The hazard engine, routing, vehicle model and decision layer are
          city-agnostic. Adding a city means supplying GIS layers, a drainage
          network, historical flood records and source adapters — Bengaluru is
          already in the repository specifically to keep that claim honest.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Roadmap
            phase="Next"
            items={[
              "IMD and CWC live feeds once credentials are issued",
              "PostGIS deployment for hotspots, drains and history",
              "Gradient-boosted model trained on the outcome table",
              "Ward-level and colony-level resolution",
            ]}
          />
          <Roadmap
            phase="Then"
            items={[
              "Mumbai, Chennai and Bengaluru as full deployments",
              "Basement and property-level flood risk",
              "Fleet and logistics integration",
              "Push alerts tied to your own departure window",
            ]}
          />
          <Roadmap
            phase="Beyond flooding"
            items={[
              "Heatwaves — the same hazard contract, new model",
              "Dust storms and air quality",
              "Power outages during monsoon",
              "Water shortage and supply disruption",
            ]}
          />
        </div>
      </Section>

      {/* ══ CTA ═════════════════════════════════════════════════════════ */}
      <section className="border-t border-line px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            See what the roads look like right now.
          </h2>
          <p className="mt-4 text-[15px] text-fg-muted">
            Live Delhi conditions, or run a cloudburst against the city and watch
            the decisions change.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-signal-500 px-7 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-signal-600/25 transition-all hover:bg-signal-400"
          >
            Launch App
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[14px] font-semibold tracking-tight">FloodPilot</span>
        </Link>

        <nav className="ml-2 hidden gap-6 text-[13px] text-fg-muted md:flex">
          <a href="#how" className="transition-colors hover:text-fg">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-fg">
            Features
          </a>
          <a href="#architecture" className="transition-colors hover:text-fg">
            Architecture
          </a>
          <a href="#government" className="transition-colors hover:text-fg">
            Government
          </a>
          <a href="#roadmap" className="transition-colors hover:text-fg">
            Roadmap
          </a>
        </nav>

        <Link
          href="/app"
          className="ml-auto rounded-lg bg-signal-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-signal-400"
        >
          Launch App
        </Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[13px] font-semibold tracking-tight">FloodPilot</span>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fg-faint">
            An operating system for urban flood resilience. Junctions, corridors,
            drains and gauge thresholds are real; segment geometry is a
            straight-line approximation and the flood history is an illustrative
            seed, not an official municipal record. FloodPilot is decision support,
            not an emergency service — in an emergency call the numbers below.
          </p>
        </div>

        <div className="text-[11.5px] text-fg-faint">
          <p className="eyebrow mb-2">Delhi flood control</p>
          <p>Flood Control Room (I&amp;FC) · 1800-11-0093</p>
          <p>DDMA emergency · 1077</p>
          <p>Delhi Traffic Police · 1095</p>
        </div>

        <div className="flex flex-col gap-2 text-[12px] text-fg-muted">
          <Link href="/app" className="transition-colors hover:text-fg">
            Launch App
          </Link>
          <Link href="/gov" className="transition-colors hover:text-fg">
            Operations dashboard
          </Link>
          <a
            href="https://github.com/darshprasad-cmd/Flood-Pilot"
            className="transition-colors hover:text-fg"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}

function Section({
  id,
  eyebrow,
  children,
  tinted = false,
}: {
  id: string;
  eyebrow: string;
  children: React.ReactNode;
  tinted?: boolean;
}) {
  return (
    <section
      id={id}
      className={`border-b border-line px-6 py-20 ${tinted ? "bg-ink-900/40" : ""}`}
    >
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow mb-6">{eyebrow}</p>
        {children}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="numeric text-2xl font-semibold tracking-tight">{value}</dd>
      <dt className="mt-1 text-[11.5px] leading-snug text-fg-faint">{label}</dt>
    </div>
  );
}

function Mechanism({
  title,
  detail,
  accent,
}: {
  title: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="surface p-5" style={{ borderTopWidth: 2, borderTopColor: accent }}>
      <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">{detail}</p>
    </div>
  );
}

function Step({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <p className="numeric text-[11px] font-semibold text-signal-400">{number}</p>
      <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">{detail}</p>
    </li>
  );
}

function Feature({
  title,
  detail,
  proof,
}: {
  title: string;
  detail: string;
  proof: string;
}) {
  return (
    <div className="surface flex flex-col p-5">
      <h3 className="text-[14.5px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-fg-muted">
        {detail}
      </p>
      <p className="mt-4 border-t border-line pt-3 text-[11.5px] text-signal-300">
        {proof}
      </p>
    </div>
  );
}

function Tier({
  name,
  price,
  blurb,
  features,
  cta,
  highlighted = false,
}: {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta?: { href: string; label: string };
  highlighted?: boolean;
}) {
  return (
    <div className={`${highlighted ? "surface-raised" : "surface"} flex flex-col p-6`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight">{name}</h3>
        <span className="numeric text-[13px] text-fg-muted">{price}</span>
      </div>
      <p className="mt-2 text-[12.5px] text-fg-muted">{blurb}</p>

      <ul className="mt-5 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[12.5px] text-fg-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-400" />
            {feature}
          </li>
        ))}
      </ul>

      {cta ? (
        <Link
          href={cta.href}
          className="mt-6 rounded-lg bg-signal-500 px-4 py-2.5 text-center text-[13px] font-semibold text-white transition-colors hover:bg-signal-400"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

function Roadmap({ phase, items }: { phase: string; items: string[] }) {
  return (
    <div className="surface p-5">
      <p className="eyebrow mb-3">{phase}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[12.5px] text-fg-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-700" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5c3.6 4.2 6 7.6 6 10.6a6 6 0 1 1-12 0c0-3 2.4-6.4 6-10.6Z"
        stroke="var(--color-signal-400)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 14.2c1 .9 2 .9 3 0s2-.9 3 0"
        stroke="var(--color-aqua-400)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
