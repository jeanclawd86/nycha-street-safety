"use client";

import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/types";

export default function Legend() {
  const severities = ["critical", "very-high", "high", "elevated", "moderate", "low", "minimal"] as const;

  return (
    <div className="absolute bottom-6 left-6 bg-[#1a1d27]/90 backdrop-blur-sm rounded-lg px-4 py-3 text-xs border border-[#363b4e] z-10">
      <div className="font-semibold mb-2 text-gray-300">NYCHA Development Severity</div>
      <div className="flex flex-col gap-1.5">
        {severities.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: `${SEVERITY_COLORS[s]}66`, borderColor: SEVERITY_COLORS[s] }} />
            <span className="text-gray-400">{SEVERITY_LABELS[s]}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-[#363b4e]">
        <div className="font-semibold mb-1.5 text-gray-300">Street Segments</div>
        <div className="flex items-center gap-3">
          {[
            { color: "#6b7280", label: "0" },
            { color: "#22c55e", label: "1–14" },
            { color: "#84cc16", label: "15–34" },
            { color: "#eab308", label: "35–59" },
            { color: "#f97316", label: "60–99" },
            { color: "#dc2626", label: "100–149" },
            { color: "#7f1d1d", label: "150+" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-4 h-1 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
