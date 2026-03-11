"use client";

import { useState } from "react";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/types";

export default function Legend() {
  const [expanded, setExpanded] = useState(false);
  const severities = ["critical", "very-high", "high", "elevated", "moderate", "low", "minimal"] as const;

  const segmentColors = [
    { color: "#6b7280", label: "0" },
    { color: "#22c55e", label: "1–14" },
    { color: "#84cc16", label: "15–34" },
    { color: "#eab308", label: "35–59" },
    { color: "#f97316", label: "60–99" },
    { color: "#dc2626", label: "100–149" },
    { color: "#7f1d1d", label: "150+" },
  ];

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="absolute bottom-6 left-6 bg-[#1a1d27]/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs border border-[#363b4e] z-10 hover:bg-[#242836] transition-colors flex items-center gap-2 text-gray-300"
      >
        <span className="flex gap-0.5">
          {["#7f1d1d", "#dc2626", "#f97316", "#eab308", "#84cc16", "#22c55e", "#6b7280"].map((c) => (
            <span key={c} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </span>
        Legend
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 left-6 bg-[#1a1d27]/90 backdrop-blur-sm rounded-lg text-xs border border-[#363b4e] z-10 max-w-[280px]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="font-semibold text-gray-300">Legend</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>
      
      <div className="px-4 pb-2">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 mt-1">Development Severity</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {severities.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SEVERITY_COLORS[s] }} />
              <span className="text-gray-400 truncate">{SEVERITY_LABELS[s].split(" (")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-3 pt-1 border-t border-[#363b4e]">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 mt-1">Street Ped. Injuries</div>
        <div className="flex items-center gap-0.5">
          {segmentColors.map((item) => (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[9px] text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
