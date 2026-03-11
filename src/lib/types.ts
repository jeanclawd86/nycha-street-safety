export interface Filters {
  borough: string;
  minInjuries: number;
  maxInjuries: number;
  minStreets: number;
  hasDeaths: boolean | null;
  truckRoute: "all" | "truck" | "non-truck";
  search: string;
}

export interface Development {
  name: string;
  borough: string;
  adjacent_wide_streets: number;
  total_pedestrian_injuries: number;
  total_pedestrian_deaths: number;
  total_crashes: number;
  severity: SeverityLevel;
}

// 7-tier severity scale calibrated to percentiles (N=105, range 0–255, median 39)
export type SeverityLevel = "critical" | "very-high" | "high" | "elevated" | "moderate" | "low" | "minimal";

export function getSeverity(injuries: number, deaths: number): Development["severity"] {
  if (injuries >= 100 || deaths >= 3) return "critical";       // P90+ (5 devs)
  if (injuries >= 65) return "very-high";                       // P75-P90 (13 devs)
  if (injuries >= 40) return "high";                            // P50-P75 (24 devs)
  if (injuries >= 22) return "elevated";                        // P25-P50 (24 devs)
  if (injuries >= 10) return "moderate";                        // P10-P25 (21 devs)
  if (injuries >= 1) return "low";                              // bottom (15 devs)
  return "minimal";                                             // 0 injuries (3 devs)
}

export const SEVERITY_COLORS: Record<Development["severity"], string> = {
  critical: "#7f1d1d",   // dark red
  "very-high": "#dc2626", // red
  high: "#f97316",        // orange
  elevated: "#eab308",    // yellow
  moderate: "#84cc16",    // lime
  low: "#22c55e",         // green
  minimal: "#6b7280",     // gray
};

export const SEVERITY_LABELS: Record<Development["severity"], string> = {
  critical: "Critical (100+ injuries or 3+ deaths)",
  "very-high": "Very High (65–99 injuries)",
  high: "High (40–64 injuries)",
  elevated: "Elevated (22–39 injuries)",
  moderate: "Moderate (10–21 injuries)",
  low: "Low (1–9 injuries)",
  minimal: "Minimal (0 injuries)",
};

export const DEFAULT_FILTERS: Filters = {
  borough: "all",
  minInjuries: 0,
  maxInjuries: Infinity,
  minStreets: 0,
  hasDeaths: null,
  truckRoute: "all",
  search: "",
};
