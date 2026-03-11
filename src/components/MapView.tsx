"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { Development, getSeverity, SEVERITY_COLORS } from "@/lib/types";

interface MapViewProps {
  nychaData: GeoJSON.FeatureCollection | null;
  segmentsData: GeoJSON.FeatureCollection | null;
  allNychaData: GeoJSON.FeatureCollection | null;
  devData: Development[];
  flyTo?: { lng: number; lat: number; name?: string } | null;
  selectedDev?: string | null;
}

export default function MapView({ nychaData, segmentsData, allNychaData, devData, flyTo, selectedDev }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const devLookup = useRef<Map<string, Development>>(new Map());

  // Keep dev lookup fresh
  useEffect(() => {
    const m = new Map<string, Development>();
    devData.forEach((d) => m.set(d.name, d));
    devLookup.current = m;
  }, [devData]);

  // Build color expression for NYCHA polygons based on severity
  const buildNychaColorExpr = useCallback(() => {
    const expr: (string | string[] | boolean)[] = ["case"];
    // Hidden (filtered out)
    expr.push(["==", ["get", "_visible"], false] as unknown as string[]);
    expr.push("#1a1d27" as unknown as boolean); // nearly invisible

    // Color by severity based on devData
    const severityByName = new Map<string, string>();
    devData.forEach((d) => {
      severityByName.set(d.name, SEVERITY_COLORS[d.severity]);
    });

    // Create match expression for names we know about
    return [
      "case",
      ["==", ["get", "_visible"], false],
      "rgba(30,33,47,0.1)",
      // Use match for known developments
      ["match", ["get", "name"],
        ...Array.from(severityByName.entries()).flatMap(([name, color]) => [name, color]),
        "#4b5563" // default gray
      ]
    ];
  }, [devData]);

  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-73.95, 40.73],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      const m = map.current!;

      // NYCHA polygons
      if (nychaData) {
        m.addSource("nycha", { type: "geojson", data: nychaData });

        m.addLayer({
          id: "nycha-fill",
          type: "fill",
          source: "nycha",
          paint: {
            "fill-color": buildNychaColorExpr() as any,
            "fill-opacity": [
              "case",
              ["==", ["get", "_visible"], false],
              0.05,
              0.45,
            ],
          },
        });

        m.addLayer({
          id: "nycha-outline",
          type: "line",
          source: "nycha",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "_visible"], false],
              "rgba(100,100,100,0.1)",
              "#e2e8f0",
            ],
            "line-width": [
              "case",
              ["==", ["get", "_visible"], false],
              0.5,
              1.5,
            ],
          },
        });

        // NYCHA labels
        m.addLayer({
          id: "nycha-labels",
          type: "symbol",
          source: "nycha",
          minzoom: 14,
          filter: ["==", ["get", "_visible"], true],
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-anchor": "center",
            "text-max-width": 10,
          },
          paint: {
            "text-color": "#e2e8f0",
            "text-halo-color": "#0f1117",
            "text-halo-width": 1.5,
          },
        });
      }

      // Street segments
      if (segmentsData) {
        m.addSource("segments", { type: "geojson", data: segmentsData });

        m.addLayer({
          id: "segments-line",
          type: "line",
          source: "segments",
          paint: {
            "line-color": [
              "interpolate",
              ["linear"],
              ["get", "pedestrian_injuries"],
              0, "#22c55e",
              5, "#eab308",
              15, "#f97316",
              30, "#ef4444",
              60, "#dc2626",
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 1.5,
              14, 4,
              18, 8,
            ],
            "line-opacity": 0.85,
          },
        });

        // Click handler for segments
        m.on("click", "segments-line", (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties || {};
          const nychaNames = (() => {
            try { return JSON.parse(props.adjacent_nycha || "[]").join(", "); }
            catch { return props.adjacent_nycha || ""; }
          })();

          const html = `
            <div class="text-sm">
              <div class="font-bold text-base mb-1">${props.street_name || "Unknown Street"}</div>
              <div class="text-gray-400 mb-2">Width: ${props.width || "?"}ft</div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                <span class="text-gray-400">Injuries:</span>
                <span class="font-semibold text-yellow-400">${props.pedestrian_injuries || 0}</span>
                <span class="text-gray-400">Deaths:</span>
                <span class="font-semibold text-red-400">${props.pedestrian_deaths || 0}</span>
                <span class="text-gray-400">Crashes:</span>
                <span class="font-semibold">${props.crash_count || 0}</span>
              </div>
              <div class="mt-2 text-xs text-gray-400">Adjacent to: ${nychaNames}</div>
            </div>
          `;
          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new mapboxgl.Popup({ maxWidth: "300px" })
            .setLngLat(e.lngLat).setHTML(html).addTo(m);
        });

        m.on("mouseenter", "segments-line", () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", "segments-line", () => { m.getCanvas().style.cursor = ""; });
      }

      // NYCHA polygon click
      if (nychaData) {
        m.on("click", "nycha-fill", (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties || {};
          if (!props._visible) return;
          
          const dev = devLookup.current.get(props.name);
          const severity = dev?.severity || "none";
          const color = SEVERITY_COLORS[severity];
          
          const html = `
            <div class="text-sm">
              <div class="font-bold text-base mb-1">${props.name}</div>
              <div class="text-gray-400">${props.borough || ""}</div>
              <div class="mt-1 inline-block px-2 py-0.5 rounded text-xs font-medium" style="background:${color}22;color:${color};border:1px solid ${color}44">
                ${severity.toUpperCase()}
              </div>
              ${props.has_qualifying_streets ? `
                <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <span class="text-gray-400">Wide streets:</span>
                  <span class="font-semibold">${props.adjacent_wide_streets || 0}</span>
                  <span class="text-gray-400">Ped. injuries:</span>
                  <span class="font-semibold text-yellow-400">${props.total_pedestrian_injuries || 0}</span>
                  <span class="text-gray-400">Ped. deaths:</span>
                  <span class="font-semibold text-red-400">${props.total_pedestrian_deaths || 0}</span>
                </div>
              ` : `<div class="mt-1 text-gray-500 text-xs">No qualifying wide streets nearby</div>`}
            </div>
          `;
          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new mapboxgl.Popup({ maxWidth: "300px" })
            .setLngLat(e.lngLat).setHTML(html).addTo(m);
        });

        m.on("mouseenter", "nycha-fill", () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", "nycha-fill", () => { m.getCanvas().style.cursor = ""; });
      }
    });
  }, [nychaData, segmentsData, buildNychaColorExpr]);

  useEffect(() => {
    initMap();
    return () => {
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, [initMap]);

  // Update NYCHA data when filters change
  useEffect(() => {
    if (!map.current || !nychaData) return;
    const m = map.current;
    if (!m.isStyleLoaded()) return;
    
    const src = m.getSource("nycha") as mapboxgl.GeoJSONSource;
    if (src) {
      src.setData(nychaData as any);
      // Update color expression
      m.setPaintProperty("nycha-fill", "fill-color", buildNychaColorExpr() as any);
    }
  }, [nychaData, buildNychaColorExpr]);

  // Update segments data when filters change
  useEffect(() => {
    if (!map.current || !segmentsData) return;
    const m = map.current;
    if (!m.isStyleLoaded()) return;
    
    const src = m.getSource("segments") as mapboxgl.GeoJSONSource;
    if (src) src.setData(segmentsData as any);
  }, [segmentsData]);

  // Fly to selected development
  useEffect(() => {
    if (flyTo && map.current) {
      map.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 15, duration: 1500 });
    }
  }, [flyTo]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
