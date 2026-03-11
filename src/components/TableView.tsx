"use client";

import { useState, useMemo } from "react";
import { Development, SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/types";

type SortKey = "name" | "borough" | "adjacent_wide_streets" | "total_pedestrian_injuries" | "total_pedestrian_deaths" | "severity";

interface TableViewProps {
  data: Development[] | null;
  nychaData: GeoJSON.FeatureCollection | null;
  onSelectDevelopment: (coords: { lng: number; lat: number }, name?: string) => void;
  selectedDev?: string | null;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 6,
  "very-high": 5,
  high: 4,
  elevated: 3,
  moderate: 2,
  low: 1,
  minimal: 0,
};

export default function TableView({ data, nychaData, onSelectDevelopment, selectedDev }: TableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("total_pedestrian_injuries");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === "severity") {
        av = SEVERITY_ORDER[a.severity] || 0;
        bv = SEVERITY_ORDER[b.severity] || 0;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function handleRowClick(devName: string) {
    if (!nychaData) return;
    const feature = nychaData.features.find((f) => f.properties?.name === devName);
    if (!feature) return;
    try {
      const coords = JSON.stringify(feature.geometry);
      const lngs: number[] = [], lats: number[] = [];
      const numRegex = /-?\d+\.\d+/g;
      let match;
      const allNums: number[] = [];
      while ((match = numRegex.exec(coords)) !== null) allNums.push(parseFloat(match[0]));
      for (let i = 0; i < allNums.length - 1; i += 2) {
        if (Math.abs(allNums[i]) > 50 && Math.abs(allNums[i]) < 80) {
          lngs.push(allNums[i]); lats.push(allNums[i + 1]);
        }
      }
      if (lngs.length > 0) {
        const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
        const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        onSelectDevelopment({ lng: avgLng, lat: avgLat }, devName);
      }
    } catch { /* skip */ }
  }

  const sortIcon = (key: SortKey) => sortKey !== key ? "↕" : sortAsc ? "↑" : "↓";

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "severity", label: "Severity" },
    { key: "name", label: "NYCHA Development" },
    { key: "borough", label: "Borough" },
    { key: "adjacent_wide_streets", label: "Wide Streets", align: "right" },
    { key: "total_pedestrian_injuries", label: "Ped. Injuries", align: "right" },
    { key: "total_pedestrian_deaths", label: "Ped. Deaths", align: "right" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto rounded-lg border border-[#242836]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#1a1d27] z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-8">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.label} <span className="ml-1">{sortIcon(col.key)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242836]">
            {sorted.map((dev, i) => {
              const color = SEVERITY_COLORS[dev.severity];
              const isSelected = selectedDev === dev.name;
              return (
                <tr
                  key={dev.name}
                  onClick={() => handleRowClick(dev.name)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-600/10 border-l-2 border-l-blue-500" : "hover:bg-[#242836]"
                  }`}
                >
                  <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: `${color}22`,
                        color: color,
                        border: `1px solid ${color}44`,
                      }}
                    >
                      {dev.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{dev.name}</td>
                  <td className="px-4 py-3 text-gray-400">{dev.borough}</td>
                  <td className="px-4 py-3 text-right">{dev.adjacent_wide_streets}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={
                      dev.total_pedestrian_injuries >= 150 ? "text-red-700 font-bold" :
                      dev.total_pedestrian_injuries >= 100 ? "text-red-400 font-semibold" :
                      dev.total_pedestrian_injuries >= 60 ? "text-orange-400 font-semibold" :
                      dev.total_pedestrian_injuries >= 35 ? "text-yellow-400" :
                      dev.total_pedestrian_injuries >= 15 ? "text-lime-400" : "text-gray-300"
                    }>
                      {dev.total_pedestrian_injuries}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={dev.total_pedestrian_deaths > 0 ? "text-red-500 font-semibold" : "text-gray-300"}>
                      {dev.total_pedestrian_deaths}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {data ? "No developments match current filters" : "Loading..."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-gray-500">
        {sorted.length} developments · Click a row to zoom on the map
      </div>
    </div>
  );
}
