"use client";

import { Filters } from "@/lib/types";

interface FilterBarProps {
  filters: Filters;
  setFilters: (f: Filters) => void;
  boroughs: string[];
  maxInjuryCount: number;
  onReset: () => void;
}

export default function FilterBar({ filters, setFilters, boroughs, maxInjuryCount, onReset }: FilterBarProps) {
  const isFiltered = filters.borough !== "all" || filters.minInjuries > 0 || 
    filters.hasDeaths !== null || filters.search !== "" || filters.minStreets > 0;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-[#141620] border-b border-[#242836] shrink-0 overflow-x-auto">
      {/* Search */}
      <input
        type="text"
        placeholder="Search developments..."
        value={filters.search}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        className="w-48 px-3 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
      />

      {/* Borough */}
      <select
        value={filters.borough}
        onChange={(e) => setFilters({ ...filters, borough: e.target.value })}
        className="px-3 py-1.5 bg-[#242836] border border-[#363b4e] rounded-md text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer"
      >
        <option value="all">All Boroughs</option>
        {boroughs.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      {/* Min Injuries */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="whitespace-nowrap">Min injuries:</span>
        <input
          type="range"
          min={0}
          max={Math.min(maxInjuryCount, 100)}
          value={filters.minInjuries}
          onChange={(e) => setFilters({ ...filters, minInjuries: parseInt(e.target.value) })}
          className="w-24 accent-blue-500"
        />
        <span className="text-gray-200 font-medium w-6 text-right">{filters.minInjuries}</span>
      </div>

      {/* Deaths filter */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setFilters({ ...filters, hasDeaths: filters.hasDeaths === true ? null : true })}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filters.hasDeaths === true
              ? "bg-red-600/30 text-red-300 border border-red-500/50"
              : "bg-[#242836] text-gray-400 border border-[#363b4e] hover:text-gray-200"
          }`}
        >
          Has Fatalities
        </button>
      </div>

      {/* Min wide streets */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="whitespace-nowrap">Min streets:</span>
        <input
          type="range"
          min={0}
          max={20}
          value={filters.minStreets}
          onChange={(e) => setFilters({ ...filters, minStreets: parseInt(e.target.value) })}
          className="w-20 accent-blue-500"
        />
        <span className="text-gray-200 font-medium w-6 text-right">{filters.minStreets}</span>
      </div>

      {/* Reset */}
      {isFiltered && (
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white bg-[#242836] border border-[#363b4e] hover:border-gray-500 transition-colors ml-auto"
        >
          ✕ Reset
        </button>
      )}
    </div>
  );
}
