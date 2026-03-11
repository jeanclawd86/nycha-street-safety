"use client";

import { useState } from "react";
import { Filters } from "@/lib/types";

interface FilterBarProps {
  filters: Filters;
  setFilters: (f: Filters) => void;
  boroughs: string[];
  maxInjuryCount: number;
  yearMin: number;
  yearMax: number;
  onReset: () => void;
}

export default function FilterBar({ filters, setFilters, boroughs, maxInjuryCount, yearMin, yearMax, onReset }: FilterBarProps) {
  const [expanded, setExpanded] = useState(true);

  const isDateFiltered = filters.yearStart !== yearMin || filters.yearEnd !== yearMax;
  const isFiltered = filters.borough !== "all" || filters.minInjuries > 0 || 
    filters.hasDeaths !== null || filters.search !== "" || filters.minStreets > 0 || filters.truckRoute !== "all" || isDateFiltered;

  const activeCount = [
    filters.borough !== "all",
    filters.minInjuries > 0,
    filters.hasDeaths !== null,
    filters.search !== "",
    filters.minStreets > 0,
    filters.truckRoute !== "all",
    isDateFiltered,
  ].filter(Boolean).length;

  if (!expanded) {
    return (
      <div className="flex items-center gap-2 px-6 py-2 bg-[#141620] border-b border-[#242836] shrink-0">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-sm text-gray-300 hover:text-white hover:bg-[#2a2f42] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          Filters
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
        {isFiltered && (
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              {filters.borough !== "all" && (
                <FilterChip label={filters.borough} onRemove={() => setFilters({ ...filters, borough: "all" })} />
              )}
              {filters.minInjuries > 0 && (
                <FilterChip label={`≥${filters.minInjuries} injuries`} onRemove={() => setFilters({ ...filters, minInjuries: 0 })} />
              )}
              {filters.hasDeaths === true && (
                <FilterChip label="Has fatalities" onRemove={() => setFilters({ ...filters, hasDeaths: null })} color="red" />
              )}
              {filters.minStreets > 0 && (
                <FilterChip label={`≥${filters.minStreets} streets`} onRemove={() => setFilters({ ...filters, minStreets: 0 })} />
              )}
              {filters.truckRoute !== "all" && (
                <FilterChip label={filters.truckRoute === "truck" ? "Truck routes only" : "Non-truck only"} onRemove={() => setFilters({ ...filters, truckRoute: "all" })} color={filters.truckRoute === "truck" ? "red" : "blue"} />
              )}
              {isDateFiltered && (
                <FilterChip label={`${filters.yearStart}–${filters.yearEnd}`} onRemove={() => setFilters({ ...filters, yearStart: yearMin, yearEnd: yearMax })} />
              )}
              {filters.search && (
                <FilterChip label={`"${filters.search}"`} onRemove={() => setFilters({ ...filters, search: "" })} />
              )}
            </div>
            <button
              onClick={onReset}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto"
            >
              Clear all
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#141620] border-b border-[#242836] shrink-0">
      <div className="flex items-center gap-3 px-6 py-2.5 overflow-x-auto">
        {/* Collapse button */}
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          <span className="font-medium">Filters</span>
        </button>

        <div className="w-px h-5 bg-[#363b4e]" />

        {/* Search */}
        <div className="relative shrink-0">
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-40 pl-7 pr-3 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>

        {/* Borough */}
        <select
          value={filters.borough}
          onChange={(e) => setFilters({ ...filters, borough: e.target.value })}
          className="px-3 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer pr-8 shrink-0"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="all">All Boroughs</option>
          {boroughs.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* Min Injuries */}
        <div className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
          <span className="whitespace-nowrap text-xs">Injuries ≥</span>
          <input
            type="range"
            min={0}
            max={Math.min(maxInjuryCount, 200)}
            value={filters.minInjuries}
            onChange={(e) => setFilters({ ...filters, minInjuries: parseInt(e.target.value) })}
            className="w-24 accent-blue-500 h-1"
          />
          <span className="text-gray-200 font-mono text-xs w-7 text-right">{filters.minInjuries}</span>
        </div>

        {/* Min Streets */}
        <div className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
          <span className="whitespace-nowrap text-xs">Streets ≥</span>
          <input
            type="range"
            min={0}
            max={25}
            value={filters.minStreets}
            onChange={(e) => setFilters({ ...filters, minStreets: parseInt(e.target.value) })}
            className="w-16 accent-blue-500 h-1"
          />
          <span className="text-gray-200 font-mono text-xs w-4 text-right">{filters.minStreets}</span>
        </div>

        {/* Deaths filter */}
        <button
          onClick={() => setFilters({ ...filters, hasDeaths: filters.hasDeaths === true ? null : true })}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${
            filters.hasDeaths === true
              ? "bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm shadow-red-500/10"
              : "bg-[#242836] text-gray-400 border border-[#363b4e] hover:text-gray-200 hover:border-[#4a4f63]"
          }`}
        >
          ☠ Fatalities
        </button>

        {/* Truck route filter */}
        <div className="flex items-center bg-[#242836] border border-[#363b4e] rounded-md overflow-hidden shrink-0">
          {([["all", "All"], ["truck", "🚛 Truck"], ["non-truck", "Non-truck"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilters({ ...filters, truckRoute: val as any })}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filters.truckRoute === val
                  ? "bg-blue-600/30 text-blue-300"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
          <span className="whitespace-nowrap text-xs">📅</span>
          <select
            value={filters.yearStart}
            onChange={(e) => setFilters({ ...filters, yearStart: parseInt(e.target.value) })}
            className="px-1.5 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer"
          >
            {Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-gray-600 text-xs">–</span>
          <select
            value={filters.yearEnd}
            onChange={(e) => setFilters({ ...filters, yearEnd: parseInt(e.target.value) })}
            className="px-1.5 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer"
          >
            {Array.from({ length: yearMax - filters.yearStart + 1 }, (_, i) => filters.yearStart + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Reset */}
        {isFiltered && (
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-md text-xs text-gray-500 hover:text-white bg-[#242836] border border-[#363b4e] hover:border-gray-500 transition-colors ml-auto shrink-0"
          >
            ✕ Reset
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove, color = "blue" }: { label: string; onRemove: () => void; color?: string }) {
  const colors = {
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${colors[color as keyof typeof colors] || colors.blue}`}>
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors">✕</button>
    </span>
  );
}
