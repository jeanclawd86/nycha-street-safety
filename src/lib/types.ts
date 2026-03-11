export interface Filters {
  borough: string;
  minInjuries: number;
  maxInjuries: number;
  minStreets: number;
  hasDeaths: boolean | null;
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

// 7-tier severity scale based on actual data distribution (1–85, median 25)
export type SeverityLevel = "critical" | "very-high" | "high" | "elevated" | "moderate" | "low" | "minimal";

export function getSeverity(injuries: number, deaths: number): Development["severity"] {
  if (injuries >= 60 || deaths >= 2) return "critical";      // top tier
  if (injuries >= 45) return "very-high";                     // P85+
  if (injuries >= 30) return "high";                          // P65+
  if (injuries >= 20) return "elevated";                      // ~median
  if (injuries >= 10) return "moderate";                      // P25+
  if (injuries >= 1) return "low";                            // some injuries
  return "minimal";                                           // 0 injuries
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
  critical: "Critical (60+ injuries or 2+ deaths)",
  "very-high": "Very High (45–59 injuries)",
  high: "High (30–44 injuries)",
  elevated: "Elevated (20–29 injuries)",
  moderate: "Moderate (10–19 injuries)",
  low: "Low (1–9 injuries)",
  minimal: "Minimal (0 injuries)",
};

export const DEFAULT_FILTERS: Filters = {
  borough: "all",
  minInjuries: 0,
  maxInjuries: Infinity,
  minStreets: 0,
  hasDeaths: null,
  search: "",
};
