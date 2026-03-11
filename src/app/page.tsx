"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import TableView from "@/components/TableView";
import Legend from "@/components/Legend";
import FilterBar from "@/components/FilterBar";
import { Filters, Development, getSeverity, DEFAULT_FILTERS } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type ViewMode = "map" | "table" | "split";

function StatChip({ value, total, label, color }: { value: number; total?: number; label: string; color?: string }) {
  const colorClasses = {
    yellow: "text-yellow-400",
    red: "text-red-400",
    default: "text-gray-200",
  };
  const textClass = colorClasses[color as keyof typeof colorClasses] || colorClasses.default;
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-[#242836] rounded text-[11px]">
      <span className={`font-semibold ${textClass}`}>{value.toLocaleString()}</span>
      {total !== undefined && <span className="text-gray-600">/{total}</span>}
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<ViewMode>("map");
  const [nychaData, setNychaData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [segmentsData, setSegmentsData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [devData, setDevData] = useState<Development[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; name?: string } | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedDev, setSelectedDev] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [nychaRes, segRes, devRes] = await Promise.all([
          fetch("/data/nycha.geojson"),
          fetch("/data/segments.geojson"),
          fetch("/data/developments.json"),
        ]);

        if (!nychaRes.ok || !segRes.ok || !devRes.ok) {
          throw new Error("Data files not found. Run `npm run build-data` first.");
        }

        const [nycha, segments, devs] = await Promise.all([
          nychaRes.json(),
          segRes.json(),
          devRes.json(),
        ]);

        // Enrich developments with severity
        const enrichedDevs = devs.map((d: Development) => ({
          ...d,
          severity: getSeverity(d.total_pedestrian_injuries, d.total_pedestrian_deaths),
        }));

        setNychaData(nycha);
        setSegmentsData(segments);
        setDevData(enrichedDevs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Get unique boroughs for filter
  const boroughs = useMemo(() => {
    if (!devData) return [];
    return Array.from(new Set(devData.map((d) => d.borough))).sort();
  }, [devData]);

  // Get max injuries for slider
  const maxInjuryCount = useMemo(() => {
    if (!devData) return 100;
    return Math.max(...devData.map((d) => d.total_pedestrian_injuries), 1);
  }, [devData]);

  // Filter developments
  const filteredDevs = useMemo(() => {
    if (!devData) return [];
    return devData.filter((d) => {
      if (filters.borough !== "all" && d.borough !== filters.borough) return false;
      if (d.total_pedestrian_injuries < filters.minInjuries) return false;
      if (filters.maxInjuries !== Infinity && d.total_pedestrian_injuries > filters.maxInjuries) return false;
      if (d.adjacent_wide_streets < filters.minStreets) return false;
      if (filters.hasDeaths === true && d.total_pedestrian_deaths === 0) return false;
      if (filters.hasDeaths === false && d.total_pedestrian_deaths > 0) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !d.borough.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [devData, filters]);

  // Filter NYCHA GeoJSON to match
  const filteredNychaNames = useMemo(() => new Set(filteredDevs.map((d) => d.name)), [filteredDevs]);

  // Filtered segments: only those adjacent to filtered NYCHA developments
  const filteredSegments = useMemo(() => {
    if (!segmentsData) return null;
    return {
      ...segmentsData,
      features: segmentsData.features.filter((f) => {
        try {
          const adjacent = JSON.parse(f.properties?.adjacent_nycha || "[]");
          return adjacent.some((name: string) => filteredNychaNames.has(name));
        } catch {
          return false;
        }
      }),
    };
  }, [segmentsData, filteredNychaNames]);

  // Filtered NYCHA polygons
  const filteredNycha = useMemo(() => {
    if (!nychaData) return null;
    return {
      ...nychaData,
      features: nychaData.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          _visible: filteredNychaNames.has(f.properties?.name),
        },
      })),
    };
  }, [nychaData, filteredNychaNames]);

  const handleSelectDevelopment = useCallback((coords: { lng: number; lat: number }, name?: string) => {
    setFlyTo({ ...coords, name });
    setSelectedDev(name || null);
    if (view === "table") setView("split");
  }, [view]);

  const totalFilteredInjuries = filteredDevs.reduce((s, d) => s + d.total_pedestrian_injuries, 0);
  const totalFilteredDeaths = filteredDevs.reduce((s, d) => s + d.total_pedestrian_deaths, 0);

  const filteredSegmentCount = filteredSegments?.features.length || 0;

  return (
    <div className="flex flex-col h-screen bg-[#0f1117]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#1a1d27] border-b border-[#242836] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base sm:text-lg font-bold tracking-tight whitespace-nowrap">NYCHA Street Safety</h1>
          {!loading && devData && (
            <div className="hidden md:flex items-center gap-2 ml-2">
              <StatChip value={filteredDevs.length} total={devData.length} label="devs" />
              <StatChip value={totalFilteredInjuries} label="injuries" color="yellow" />
              <StatChip value={totalFilteredDeaths} label="deaths" color="red" />
              <StatChip value={filteredSegments?.features.length || 0} label="segments" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#242836] rounded-lg p-0.5 flex">
            {(["map", "split", "table"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md transition-colors capitalize ${
                  view === v ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {v === "map" ? "🗺 Map" : v === "table" ? "📊 Table" : "⬜ Split"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      {!loading && !error && (
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          boroughs={boroughs}
          maxInjuryCount={maxInjuryCount}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1117] z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Loading map data...</p>
              <p className="text-gray-600 text-xs">
                If this persists, run <code className="bg-[#242836] px-2 py-0.5 rounded">npm run build-data</code> first
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1117] z-50">
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
              <div className="text-red-400 text-4xl">!</div>
              <p className="text-gray-200 font-medium">Data not available</p>
              <p className="text-gray-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="flex h-full">
            {/* Map panel */}
            <div
              className={`transition-all duration-300 relative ${
                view === "table" ? "w-0 opacity-0" : view === "split" ? "w-1/2" : "w-full"
              }`}
            >
              <MapView
                nychaData={filteredNycha}
                segmentsData={filteredSegments}
                allNychaData={nychaData}
                devData={filteredDevs}
                flyTo={flyTo}
                selectedDev={selectedDev}
              />
              {view !== "table" && <Legend />}
            </div>

            {/* Table panel */}
            <div
              className={`transition-all duration-300 overflow-hidden ${
                view === "map" ? "w-0 opacity-0" : view === "split" ? "w-1/2 border-l border-[#242836]" : "w-full"
              }`}
            >
              <div className="p-6 h-full">
                <TableView
                  data={filteredDevs}
                  nychaData={nychaData}
                  onSelectDevelopment={handleSelectDevelopment}
                  selectedDev={selectedDev}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
