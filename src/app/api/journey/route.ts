import { NextResponse } from "next/server";
import { runJourneyBrief } from "@/lib/agents/orchestrator";
import type { JourneyContext, JourneyPurpose, Urgency } from "@/lib/agents/orchestrator";
import { DEFAULT_CITY_ID, cityExists } from "@/lib/cities/registry";
import { resolveScenario } from "@/lib/signals/scenarios";
import { findCatalogEntry } from "@/lib/vehicles/catalog";
import type {
  DriveType,
  FuelType,
  TyreType,
  VehicleProfile,
} from "@/lib/vehicles/types";

export const dynamic = "force-dynamic";

interface JourneyBody {
  city?: string;
  scenario?: string;
  origin?: string;
  destination?: string;
  departInMin?: number;
  vehicle?: {
    catalogId?: string;
    year?: number;
    tyreType?: TyreType;
    driveType?: DriveType;
    fuelType?: FuelType;
    groundClearanceMm?: number;
  } | null;
  journey?: {
    purpose?: JourneyPurpose;
    urgency?: Urgency;
    deadlineInMin?: number | null;
    canWorkRemotely?: boolean;
  };
}

/**
 * The main application call.
 *
 * Runs the full agent pipeline for one journey and returns the routes, the
 * timeline, the decision, the vehicle assessment, the alerts and the agent
 * trace. One request because these are one answer — showing a route without the
 * decision that goes with it is the failure mode this product exists to fix.
 */
export async function POST(request: Request) {
  let body: JourneyBody;
  try {
    body = (await request.json()) as JourneyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cityId = body.city ?? DEFAULT_CITY_ID;
  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  if (!body.origin || !body.destination) {
    return NextResponse.json(
      { error: "origin and destination junction ids are required" },
      { status: 400 },
    );
  }

  if (body.origin === body.destination) {
    return NextResponse.json(
      { error: "origin and destination must be different" },
      { status: 400 },
    );
  }

  const journey: JourneyContext = {
    purpose: body.journey?.purpose ?? "commute",
    urgency: body.journey?.urgency ?? "flexible",
    deadlineInMin: body.journey?.deadlineInMin ?? null,
    canWorkRemotely: body.journey?.canWorkRemotely ?? false,
  };

  try {
    const brief = await runJourneyBrief({
      cityId,
      scenario: resolveScenario(body.scenario),
      originNodeId: body.origin,
      destinationNodeId: body.destination,
      vehicle: buildVehicle(body.vehicle),
      journey,
      departInMin: clampDeparture(body.departInMin),
    });

    return NextResponse.json(brief);
  } catch (error) {
    console.error("[api/journey]", error);
    return NextResponse.json(
      {
        error: "Journey planning failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function clampDeparture(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(720, Math.round(value)));
}

function buildVehicle(input: JourneyBody["vehicle"]): VehicleProfile | null {
  if (!input?.catalogId) return null;
  const entry = findCatalogEntry(input.catalogId);
  if (!entry) return null;

  const fuelType: FuelType =
    input.fuelType && entry.fuelTypes.includes(input.fuelType)
      ? input.fuelType
      : entry.fuelTypes[0];

  return {
    id: entry.id,
    manufacturer: entry.manufacturer,
    model: entry.model,
    year: clampYear(input.year ?? entry.years[1]),
    bodyType: entry.bodyType,
    groundClearanceMm:
      typeof input.groundClearanceMm === "number" &&
      input.groundClearanceMm >= 90 &&
      input.groundClearanceMm <= 500
        ? Math.round(input.groundClearanceMm)
        : entry.groundClearanceMm,
    tyreType: input.tyreType ?? "standard",
    driveType: input.driveType ?? entry.driveType,
    fuelType,
  };
}

function clampYear(year: number): number {
  if (!Number.isFinite(year)) return 2022;
  return Math.max(1990, Math.min(2026, Math.round(year)));
}
