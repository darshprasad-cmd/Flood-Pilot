import { NextResponse } from "next/server";
import {
  DEFAULT_CITY_ID,
  cityExists,
  getCityPlugin,
  listCityPlugins,
  loadHotspots,
} from "@/lib/cities/registry";
import { getCityGraph } from "@/lib/graph";
import { JOURNEY_PURPOSES } from "@/lib/agents/orchestrator";
import { AGENT_REGISTRY } from "@/lib/agents/base";
import { VEHICLE_CATALOG } from "@/lib/vehicles/catalog";
import { SCENARIOS } from "@/lib/signals/scenarios";

export const dynamic = "force-dynamic";

/**
 * Everything static about a city.
 *
 * Junctions for the origin/destination pickers, the drainage network and gauges
 * for the map, the hotspot register, control-room numbers, and the source
 * credits shown under "prediction based on".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city") ?? DEFAULT_CITY_ID;

  if (!cityExists(cityId)) {
    return NextResponse.json({ error: `Unknown city "${cityId}"` }, { status: 404 });
  }

  const plugin = getCityPlugin(cityId);
  const graph = getCityGraph(cityId);
  const hotspots = await loadHotspots(cityId);

  return NextResponse.json({
    city: {
      ...plugin.meta,
      floodCharacter: plugin.floodCharacter,
    },
    cities: listCityPlugins().map((p) => ({
      id: p.meta.id,
      name: p.meta.name,
      country: p.meta.country,
      center: p.meta.center,
      isDefault: p.meta.id === DEFAULT_CITY_ID,
    })),
    nodes: graph.allNodes().map((n) => ({
      id: n.id,
      name: n.name,
      at: n.at,
      ward: n.ward,
      elevationM: Math.round(n.elevationM * 10) / 10,
      metro: n.metro ?? null,
    })),
    drains: plugin.majorDrains.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind,
      path: d.path,
      designCapacityCumecs: d.designCapacityCumecs,
      siltationIndex: d.siltationIndex,
      outfall: d.outfall,
      operator: d.operator,
      note: d.note,
    })),
    gauges: plugin.gauges,
    hotspots,
    controlRooms: plugin.controlRooms,
    credits: plugin.credits,
    scenarios: Object.values(SCENARIOS).map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
      simulated: s.simulated,
    })),
    vehicles: VEHICLE_CATALOG,
    journeyPurposes: JOURNEY_PURPOSES,
    agents: AGENT_REGISTRY,
  });
}
