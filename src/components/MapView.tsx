"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { Development, SEVERITY_COLORS } from "@/lib/types";

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

  useEffect(() => {
    const m = new Map<string, Development>();
    devData.forEach((d) => m.set(d.name, d));
    devLookup.current = m;
  }, [devData]);

  const buildNychaColorExpr = useCallback(() => {
    const severityByName = new Map<string, string>();
    devData.forEach((d) => {
      severityByName.set(d.name, SEVERITY_COLORS[d.severity]);
    });

    return [
      "case",
      ["==", ["get", "_visible"], false],
      "rgba(30,33,47,0.1)",
      ["match", ["get", "name"],
        ...Array.from(severityByName.entries()).flatMap(([name, color]) => [name, color]),
        "#4b5563"
      ]
    ];
  }, [devData]);

  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      // Use a minimal style with free CARTO dark basemap tiles (no token needed for basemap)
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [-73.93, 40.75],
      zoom: 11.5,
      minZoom: 9,
      maxZoom: 18,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      const m = map.current!;

      // NYCHA polygons - add BELOW road labels so streets remain readable
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
              0.35,
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
              "interpolate", ["linear"], ["zoom"],
              10, 0.5,
              14, 2,
              17, 3,
            ],
          },
        });

        // NYCHA development name labels
        m.addLayer({
          id: "nycha-labels",
          type: "symbol",
          source: "nycha",
          minzoom: 13,
          filter: ["==", ["get", "_visible"], true],
          layout: {
            "text-field": ["get", "name"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 13, 9, 16, 13],
            "text-anchor": "center",
            "text-max-width": 8,
            "text-allow-overlap": false,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": "#f1f5f9",
            "text-halo-color": "rgba(15,17,23,0.9)",
            "text-halo-width": 2,
          },
        });
      }

      // Street segments - add ON TOP of everything for visibility
      if (segmentsData) {
        m.addSource("segments", { type: "geojson", data: segmentsData });

        // Segment outline (glow effect for visibility at low zoom)
        m.addLayer({
          id: "segments-glow",
          type: "line",
          source: "segments",
          paint: {
            "line-color": "rgba(0,0,0,0.5)",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              10, 4,
              14, 8,
              18, 14,
            ],
            "line-blur": 3,
          },
        });

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
              "interpolate", ["linear"], ["zoom"],
              10, 2.5,
              13, 4,
              15, 6,
              18, 10,
            ],
            "line-opacity": 0.9,
          },
        });

        // Street name labels on segments (visible at zoom 14+)
        m.addLayer({
          id: "segments-labels",
          type: "symbol",
          source: "segments",
          minzoom: 14,
          layout: {
            "symbol-placement": "line-center",
            "text-field": [
              "concat",
              ["get", "street_name"],
              " (",
              ["to-string", ["get", "width"]],
              "ft)"
            ],
            "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 17, 13],
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-max-angle": 30,
            "text-offset": [0, -1],
          },
          paint: {
            "text-color": "#f8fafc",
            "text-halo-color": "rgba(0,0,0,0.85)",
            "text-halo-width": 2,
          },
        });

        // Injury count badges on segments (zoom 15+)
        m.addLayer({
          id: "segments-injury-badges",
          type: "symbol",
          source: "segments",
          minzoom: 15,
          filter: [">", ["get", "pedestrian_injuries"], 0],
          layout: {
            "symbol-placement": "line-center",
            "text-field": [
              "concat",
              ["to-string", ["get", "pedestrian_injuries"]],
              " inj"
            ],
            "text-size": 10,
            "text-offset": [0, 1],
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#fbbf24",
            "text-halo-color": "rgba(0,0,0,0.8)",
            "text-halo-width": 1.5,
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

          const injuryColor = (props.pedestrian_injuries || 0) >= 30 ? "#dc2626" :
            (props.pedestrian_injuries || 0) >= 15 ? "#f97316" :
            (props.pedestrian_injuries || 0) >= 5 ? "#eab308" : "#22c55e";

          const html = `
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${props.street_name || "Unknown Street"}</div>
              <div style="color: #94a3b8; margin-bottom: 8px;">Width: <strong style="color: #e2e8f0;">${props.width || "?"}ft</strong> curb-to-curb</div>
              <div style="display: grid; grid-template-columns: auto auto; gap: 2px 16px;">
                <span style="color: #94a3b8;">Ped. Injuries:</span>
                <span style="font-weight: 600; color: ${injuryColor};">${props.pedestrian_injuries || 0}</span>
                <span style="color: #94a3b8;">Ped. Deaths:</span>
                <span style="font-weight: 600; color: ${(props.pedestrian_deaths || 0) > 0 ? '#dc2626' : '#94a3b8'};">${props.pedestrian_deaths || 0}</span>
                <span style="color: #94a3b8;">Total Crashes:</span>
                <span style="font-weight: 600;">${props.crash_count || 0}</span>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; color: #94a3b8; font-size: 11px;">Adjacent to: ${nychaNames}</div>
            </div>
          `;
          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new mapboxgl.Popup({ maxWidth: "320px", className: "nycha-popup" })
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
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 2px;">${props.name}</div>
              <div style="color: #94a3b8; margin-bottom: 6px;">${props.borough || ""}</div>
              <div style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${color}22; color: ${color}; border: 1px solid ${color}44;">
                ${severity.toUpperCase()} SEVERITY
              </div>
              ${props.has_qualifying_streets ? `
                <div style="display: grid; grid-template-columns: auto auto; gap: 2px 16px; margin-top: 8px;">
                  <span style="color: #94a3b8;">Wide streets (>60ft):</span>
                  <span style="font-weight: 600;">${props.adjacent_wide_streets || 0}</span>
                  <span style="color: #94a3b8;">Ped. Injuries:</span>
                  <span style="font-weight: 600; color: #fbbf24;">${props.total_pedestrian_injuries || 0}</span>
                  <span style="color: #94a3b8;">Ped. Deaths:</span>
                  <span style="font-weight: 600; color: ${(props.total_pedestrian_deaths || 0) > 0 ? '#dc2626' : '#94a3b8'};">${props.total_pedestrian_deaths || 0}</span>
                </div>
              ` : `<div style="margin-top: 6px; color: #64748b; font-size: 12px;">No qualifying wide streets adjacent</div>`}
            </div>
          `;
          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new mapboxgl.Popup({ maxWidth: "320px", className: "nycha-popup" })
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
