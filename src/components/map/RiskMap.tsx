"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * The risk map.
 *
 * Leaflet is driven directly rather than through a React wrapper: the layers
 * here are redrawn on every prediction tick, and owning the imperative lifecycle
 * avoids a whole class of reconciliation bugs for no real benefit.
 *
 * The basemap is deliberately desaturated almost to grey. Roads coloured by risk
 * are the data; the city underneath is context, and if it competes for attention
 * the map stops working.
 */

export interface MapSegment {
  id: string;
  name: string;
  geometry: { lat: number; lng: number }[];
  isUnderpass: boolean;
  state: {
    riskLevel: string;
    riskColor: string;
    probability: number;
    peakDepthCm: number;
    timeToImpassableMin: number | null;
  };
  hotspot: { name: string; severity: string } | null;
}

export interface MapDrain {
  id: string;
  name: string;
  kind: string;
  path: { lat: number; lng: number }[];
  siltationIndex: number;
}

export interface MapRoute {
  id: string;
  geometry: { lat: number; lng: number }[];
  color: string;
  dashed?: boolean;
  width?: number;
}

export interface MapMarker {
  id: string;
  at: { lat: number; lng: number };
  label: string;
  kind: "origin" | "destination" | "report" | "hotspot" | "gauge";
}

interface RiskMapProps {
  center: { lat: number; lng: number };
  bounds?: [number, number, number, number];
  segments: MapSegment[];
  drains?: MapDrain[];
  routes?: MapRoute[];
  markers?: MapMarker[];
  selectedSegmentId?: string | null;
  showSegments?: boolean;
  showDrains?: boolean;
  onSelectSegment?: (segmentId: string) => void;
  className?: string;
  /**
   * Change this whenever the map's container is resized or revealed.
   *
   * On mobile the map sits underneath full-screen panels, so Leaflet lays out
   * against a container it cannot measure while hidden. Without a nudge it
   * renders a quarter of the city into the corner.
   */
  resizeSignal?: string | number;
}

export default function RiskMap({
  center,
  bounds,
  segments,
  drains = [],
  routes = [],
  markers = [],
  selectedSegmentId = null,
  showSegments = true,
  showDrains = true,
  onSelectSegment,
  className = "",
  resizeSignal,
}: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const layersRef = useRef<{
    segments?: L.LayerGroup;
    drains?: L.LayerGroup;
    routes?: L.LayerGroup;
    markers?: L.LayerGroup;
  }>({});
  const selectHandler = useRef(onSelectSegment);
  selectHandler.current = onSelectSegment;
  /**
   * Which route the camera was last framed on, so the five-minute prediction
   * poll — which hands down a fresh `routes` array whether or not the route
   * changed — cannot yank the view back out to the whole journey while someone
   * is zoomed into their own junction reading the water depth there.
   */
  const lastFitRef = useRef<string | null>(null);

  /**
   * Leaflet is imported dynamically, so map creation is asynchronous while the
   * data effects are not. Without an explicit readiness flag in their
   * dependency lists, a fast API response wins the race: the draw effects run
   * against a null layer group, bail out, and — because their data has not
   * changed since — never run again, leaving a basemap with no roads on it.
   */
  const [ready, setReady] = useState(false);

  /* ── Create the map once ────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Leaflet touches `window` at import time, so it can only be loaded in the
      // browser.
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = leaflet;

      const map = leaflet.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
        // SVG rather than canvas. At this scale (a few hundred polylines) canvas
        // buys nothing, and SVG gives crisper lines, per-road DOM elements for
        // hover and click, and CSS animation — which the flowing dash on the
        // recommended route depends on.
        renderer: leaflet.svg(),
      });

      leaflet
        .tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        )
        .addTo(map);

      layersRef.current.drains = leaflet.layerGroup().addTo(map);
      layersRef.current.segments = leaflet.layerGroup().addTo(map);
      layersRef.current.routes = leaflet.layerGroup().addTo(map);
      layersRef.current.markers = leaflet.layerGroup().addTo(map);

      if (bounds) {
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: [24, 24] },
        );
      }

      mapRef.current = map;
      setReady(true);
      // Tiles occasionally lay out before the container has its final size.
      setTimeout(() => map.invalidateSize(), 120);
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      lastFitRef.current = null;
      setReady(false);
    };
    // Intentionally once: subsequent prop changes are handled by the draw effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Road segments ──────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.segments;
    if (!leaflet || !group) return;

    group.clearLayers();
    if (!showSegments) return;

    for (const segment of segments) {
      const path = segment.geometry.map(
        (p) => [p.lat, p.lng] as [number, number],
      );
      const selected = segment.id === selectedSegmentId;
      const risky = segment.state.probability > 0.35 && segment.state.peakDepthCm > 5;

      // Wider roads for higher risk: the eye should find the dangerous stretches
      // before it reads any label.
      const weight = selected
        ? 8
        : risky
          ? 5 + Math.min(3, segment.state.peakDepthCm / 25)
          : 3;

      // A halo under the line keeps a bright road legible against bright tiles.
      leaflet
        .polyline(path, {
          color: "#05070b",
          weight: weight + 4,
          opacity: 0.55,
          lineCap: "round",
          interactive: false,
        })
        .addTo(group);

      const line = leaflet
        .polyline(path, {
          color: segment.state.riskColor,
          weight,
          opacity: risky ? 0.95 : 0.62,
          lineCap: "round",
          dashArray: segment.isUnderpass ? "1 7" : undefined,
        })
        .addTo(group);

      line.bindTooltip(
        `<strong>${escapeHtml(segment.name)}</strong><br/>${Math.round(
          segment.state.probability * 100,
        )}% · ${segment.state.peakDepthCm.toFixed(0)} cm peak${
          segment.hotspot ? `<br/><em>${escapeHtml(segment.hotspot.name)}</em>` : ""
        }`,
        { sticky: true, direction: "top", opacity: 1 },
      );

      line.on("click", () => selectHandler.current?.(segment.id));
      line.on("mouseover", () => line.setStyle({ weight: weight + 2, opacity: 1 }));
      line.on("mouseout", () =>
        line.setStyle({ weight, opacity: risky ? 0.95 : 0.62 }),
      );

      if (selected) {
        leaflet
          .polyline(path, {
            color: "#ffffff",
            weight: 1.5,
            opacity: 0.85,
            interactive: false,
          })
          .addTo(group);
      }
    }
  }, [ready, segments, selectedSegmentId, showSegments]);

  /* ── Trunk drains ───────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.drains;
    if (!leaflet || !group) return;

    group.clearLayers();
    if (!showDrains) return;

    for (const drain of drains) {
      const path = drain.path.map((p) => [p.lat, p.lng] as [number, number]);
      const isRiver = drain.kind === "river";

      leaflet
        .polyline(path, {
          color: isRiver ? "#2b6fa8" : "#3f5a72",
          weight: isRiver ? 7 : 4,
          opacity: isRiver ? 0.55 : 0.42,
          dashArray: isRiver ? undefined : "10 6",
          lineCap: "round",
          interactive: true,
        })
        .bindTooltip(
          `<strong>${escapeHtml(drain.name)}</strong><br/>${Math.round(
            drain.siltationIndex * 100,
          )}% silted`,
          { sticky: true, direction: "top" },
        )
        .addTo(group);
    }
  }, [ready, drains, showDrains]);

  /* ── Routes ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.routes;
    const map = mapRef.current;
    if (!leaflet || !group || !map) return;

    group.clearLayers();
    if (routes.length === 0) {
      // Dropping the route forgets the framing, so re-planning the same journey
      // still flies back to it.
      lastFitRef.current = null;
      return;
    }

    for (const route of routes) {
      const path = route.geometry.map((p) => [p.lat, p.lng] as [number, number]);
      if (path.length < 2) continue;

      leaflet
        .polyline(path, {
          color: "#05070b",
          weight: (route.width ?? 6) + 6,
          opacity: 0.7,
          lineCap: "round",
          interactive: false,
        })
        .addTo(group);

      const line = leaflet
        .polyline(path, {
          color: route.color,
          weight: route.width ?? 6,
          opacity: 0.95,
          lineCap: "round",
          dashArray: route.dashed ? "12 10" : undefined,
          className: route.dashed ? "fp-flow-line" : undefined,
          interactive: false,
        })
        .addTo(group);

      void line;
    }

    // The redraw above must run every tick — it is what keeps the route's colour
    // honest about current risk. The camera must not: `routes` is a fresh array
    // on every prediction refresh, so identity cannot tell "new journey" from
    // "same journey, newer numbers". Endpoints and point count can.
    const fitKey = routes
      .map(
        (r) =>
          `${r.id}:${r.geometry.length}:${r.geometry[0]?.lat},${r.geometry[0]?.lng}:${r.geometry.at(-1)?.lat},${r.geometry.at(-1)?.lng}`,
      )
      .join("|");
    if (fitKey === lastFitRef.current) return;

    const all = routes.flatMap((r) =>
      r.geometry.map((p) => [p.lat, p.lng] as [number, number]),
    );
    if (all.length > 1) {
      map.fitBounds(leaflet.latLngBounds(all), { padding: [56, 56], maxZoom: 14 });
      lastFitRef.current = fitKey;
    }
  }, [ready, routes]);

  /* ── Markers ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.markers;
    if (!leaflet || !group) return;

    group.clearLayers();

    for (const marker of markers) {
      const style = MARKER_STYLES[marker.kind];
      const icon = leaflet.divIcon({
        className: "",
        html: `<div style="
            width:${style.size}px;height:${style.size}px;border-radius:99px;
            background:${style.fill};border:2px solid ${style.ring};
            box-shadow:0 0 0 3px rgba(5,7,11,0.75), 0 4px 14px rgba(0,0,0,0.6);
          "></div>`,
        iconSize: [style.size, style.size],
        iconAnchor: [style.size / 2, style.size / 2],
      });

      leaflet
        .marker([marker.at.lat, marker.at.lng], { icon, title: marker.label })
        .bindTooltip(escapeHtml(marker.label), { direction: "top" })
        .addTo(group);
    }
  }, [ready, markers]);

  /* ── Container resized or revealed ──────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // Two frames: one for the CSS change to land, one for layout to settle.
    const timer = setTimeout(() => map.invalidateSize({ animate: false }), 60);
    return () => clearTimeout(timer);
  }, [ready, resizeSignal]);

  /* ── Orientation and window resize ──────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const onResize = () => map.invalidateSize({ animate: false });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [ready]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className}`}
      // Leaflet handles its own gestures; letting the browser also pan the page
      // makes dragging the map on a phone feel broken.
      style={{ touchAction: "none" }}
    />
  );
}

const MARKER_STYLES: Record<
  MapMarker["kind"],
  { fill: string; ring: string; size: number }
> = {
  origin: { fill: "#4aa8ff", ring: "#cfe8ff", size: 14 },
  destination: { fill: "#35d6d6", ring: "#d3fbfb", size: 14 },
  report: { fill: "#e8b62c", ring: "#3a2f10", size: 11 },
  hotspot: { fill: "#e8503a", ring: "#3a1712", size: 12 },
  gauge: { fill: "#2b6fa8", ring: "#cfe4f5", size: 12 },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
