"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * The map as scenery.
 *
 * `RiskMap` is an instrument: it is clicked, hovered, read off. This is the
 * other thing a map can be — a place the product flies you through while it
 * explains itself. It carries the landing page and the onboarding, where the
 * camera is driven by where the conversation has got to rather than by the
 * user's hands.
 *
 * Kept separate from RiskMap deliberately. Bolting a camera and a
 * non-interactive mode onto the working instrument would put cinematic
 * behaviour one bad conditional away from the screen people rely on during a
 * flood.
 */

export interface Camera {
  center: { lat: number; lng: number };
  zoom: number;
  /**
   * Fit these points instead of using `center`/`zoom`, when there are at least
   * two. Used the moment home and work are both known and the interesting
   * frame is the distance between them.
   */
  fit?: { lat: number; lng: number }[];
  /** Flight time in seconds. */
  duration?: number;
}

export interface CinematicSegment {
  id: string;
  geometry: { lat: number; lng: number }[];
  color: string;
  /** 0–1; drives width and opacity so risk reads before anything is labelled. */
  intensity: number;
}

export interface CinematicPin {
  id: string;
  at: { lat: number; lng: number };
  kind: "home" | "work" | "focus" | "frequent";
  label?: string;
}

interface CinematicMapProps {
  camera: Camera;
  segments?: CinematicSegment[];
  pins?: CinematicPin[];
  /** Route polyline, drawn above the segments. */
  route?: { lat: number; lng: number }[];
  /** Let the user pan and zoom. Off during onboarding; on once they arrive. */
  interactive?: boolean;
  /** Slow continuous rotation of the view centre, for the idle landing shot. */
  drift?: boolean;
  className?: string;
}

export default function CinematicMap({
  camera,
  segments = [],
  pins = [],
  route,
  interactive = false,
  drift = false,
  className = "",
}: CinematicMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const layersRef = useRef<{
    segments?: L.LayerGroup;
    route?: L.LayerGroup;
    pins?: L.LayerGroup;
  }>({});
  const [ready, setReady] = useState(false);
  // The first camera is a jump, not a flight: animating in from Leaflet's
  // default view would open the product with a swoop across the Atlantic.
  const flownRef = useRef(false);

  /* ── Create once ─────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = leaflet;

      const map = leaflet.map(containerRef.current, {
        center: [camera.center.lat, camera.center.lng],
        zoom: camera.zoom,
        zoomControl: false,
        attributionControl: true,
        renderer: leaflet.svg(),
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: false,
        keyboard: interactive,
        // Leaflet's default easing makes a long flight feel like a whip-pan.
        zoomSnap: 0,
        fadeAnimation: true,
      });

      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        })
        .addTo(map);

      layersRef.current.segments = leaflet.layerGroup().addTo(map);
      layersRef.current.route = leaflet.layerGroup().addTo(map);
      layersRef.current.pins = leaflet.layerGroup().addTo(map);

      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 120);
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      flownRef.current = false;
      setReady(false);
    };
    // Created once; everything after is driven by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Interactivity can be turned on mid-life ─────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const handlers = [
      map.dragging,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.touchZoom,
      map.keyboard,
    ];
    for (const handler of handlers) {
      if (interactive) handler?.enable();
      else handler?.disable();
    }
  }, [ready, interactive]);

  /* ── Fly the camera ──────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!ready || !map || !leaflet) return;

    const duration = camera.duration ?? 2.2;

    if (camera.fit && camera.fit.length >= 2) {
      const bounds = leaflet.latLngBounds(
        camera.fit.map((p) => [p.lat, p.lng] as [number, number]),
      );
      if (flownRef.current) {
        map.flyToBounds(bounds, { padding: [80, 80], duration, maxZoom: 13 });
      } else {
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 });
      }
    } else if (flownRef.current) {
      map.flyTo([camera.center.lat, camera.center.lng], camera.zoom, {
        duration,
        // Below 1 the flight decelerates into the target, which is what makes
        // it read as arriving somewhere rather than stopping.
        easeLinearity: 0.22,
      });
    } else {
      map.setView([camera.center.lat, camera.center.lng], camera.zoom, {
        animate: false,
      });
    }
    flownRef.current = true;
  }, [ready, camera]);

  /* ── Idle drift ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !drift) return;

    // A very slow orbit. Fast enough that the page is alive, slow enough that
    // nobody watching a flood map feels the ground moving under them.
    let frame = 0;
    let raf = 0;
    const origin = map.getCenter();
    const radius = 0.012;

    const tick = () => {
      frame += 1;
      const angle = (frame / 1400) * Math.PI * 2;
      map.setView(
        [origin.lat + Math.sin(angle) * radius * 0.55, origin.lng + Math.cos(angle) * radius],
        map.getZoom(),
        { animate: false },
      );
      raf = requestAnimationFrame(tick);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, drift]);

  /* ── Road risk ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.segments;
    if (!leaflet || !group) return;

    group.clearLayers();
    for (const segment of segments) {
      const path = segment.geometry.map((p) => [p.lat, p.lng] as [number, number]);
      if (path.length < 2) continue;
      leaflet
        .polyline(path, {
          color: segment.color,
          weight: 1.6 + segment.intensity * 4.4,
          opacity: 0.34 + segment.intensity * 0.56,
          lineCap: "round",
          interactive: false,
        })
        .addTo(group);
    }
  }, [ready, segments]);

  /* ── Route ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.route;
    if (!leaflet || !group) return;

    group.clearLayers();
    if (!route || route.length < 2) return;

    const path = route.map((p) => [p.lat, p.lng] as [number, number]);
    leaflet
      .polyline(path, {
        color: "#05070b",
        weight: 10,
        opacity: 0.65,
        lineCap: "round",
        interactive: false,
      })
      .addTo(group);
    leaflet
      .polyline(path, {
        color: "#2fbf6f",
        weight: 4,
        opacity: 0.95,
        lineCap: "round",
        className: "fp-flow-line",
        interactive: false,
      })
      .addTo(group);
  }, [ready, route]);

  /* ── Pins ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = layersRef.current.pins;
    if (!leaflet || !group) return;

    group.clearLayers();
    for (const pin of pins) {
      const style = PIN_STYLES[pin.kind];
      const icon = leaflet.divIcon({
        className: "",
        html: `<div style="position:relative;width:${style.size}px;height:${style.size}px">
            ${
              style.pulse
                ? `<span class="animate-pulse-ring" style="position:absolute;inset:0;border-radius:99px;color:${style.fill};display:block"></span>`
                : ""
            }
            <span style="position:absolute;inset:0;border-radius:99px;background:${style.fill};
              border:2px solid ${style.ring};box-shadow:0 0 0 3px rgba(5,7,11,0.7),0 6px 18px rgba(0,0,0,0.6)"></span>
          </div>`,
        iconSize: [style.size, style.size],
        iconAnchor: [style.size / 2, style.size / 2],
      });
      const marker = leaflet.marker([pin.at.lat, pin.at.lng], {
        icon,
        interactive: false,
        keyboard: false,
      });
      if (pin.label) {
        marker.bindTooltip(pin.label, {
          direction: "top",
          permanent: true,
          className: "fp-cine-label",
          offset: [0, -style.size / 2 - 2],
        });
      }
      marker.addTo(group);
    }
  }, [ready, pins]);

  /* ── Resize ──────────────────────────────────────────────────────────── */
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
      className={`fp-cinematic h-full w-full ${className}`}
      style={{ touchAction: interactive ? "none" : "auto" }}
      aria-hidden={!interactive}
    />
  );
}

const PIN_STYLES: Record<
  CinematicPin["kind"],
  { fill: string; ring: string; size: number; pulse: boolean }
> = {
  home: { fill: "#4aa8ff", ring: "#cfe8ff", size: 14, pulse: true },
  work: { fill: "#35d6d6", ring: "#d3fbfb", size: 12, pulse: false },
  frequent: { fill: "#7cc4ff", ring: "#0e131e", size: 9, pulse: false },
  focus: { fill: "#2fbf6f", ring: "#d6f7e5", size: 16, pulse: true },
};
