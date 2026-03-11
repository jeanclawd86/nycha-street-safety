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

// 7-tier severity scale based on actual data distribution (0–255, median 39)
export type SeverityLevel = "critical" | "very-high" | "high" | "elevated" | "moderate" | "low" | "minimal";

export function getSeverity(injuries: number, deaths: number): Development["severity"] {
  if (injuries >= 120 || deaths >= 3) return "critical";      // top ~5%
  if (injuries >= 75) return "very-high";                      // P85+
  if (injuries >= 50) return "high";                           // P65+
  if (injuries >= 30) return "elevated";                       // ~median
  if (injuries >= 15) return "moderate";                       // P25+
  if (injuries >= 1) return "low";                             // some injuries
  return "minimal";                                            // 0 injuries
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
  critical: "Critical (120+ injuries or 3+ deaths)",
  "very-high": "Very High (75–119 injuries)",
  high: "High (50–74 injuries)",
  elevated: "Elevated (30–49 injuries)",
  moderate: "Moderate (15–29 injuries)",
  low: "Low (1–14 injuries)",
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
