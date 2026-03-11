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
  severity: "critical" | "high" | "moderate" | "low" | "none";
}

export function getSeverity(injuries: number, deaths: number): Development["severity"] {
  if (deaths > 0 || injuries >= 30) return "critical";
  if (injuries >= 15) return "high";
  if (injuries >= 5) return "moderate";
  if (injuries >= 1) return "low";
  return "none";
}

export const SEVERITY_COLORS: Record<Development["severity"], string> = {
  critical: "#dc2626",
  high: "#f97316",
  moderate: "#eab308",
  low: "#22c55e",
  none: "#6b7280",
};

export const SEVERITY_LABELS: Record<Development["severity"], string> = {
  critical: "Critical (30+ injuries or fatalities)",
  high: "High (15–29 injuries)",
  moderate: "Moderate (5–14 injuries)",
  low: "Low (1–4 injuries)",
  none: "None (0 injuries)",
};

export const DEFAULT_FILTERS: Filters = {
  borough: "all",
  minInjuries: 0,
  maxInjuries: Infinity,
  minStreets: 0,
  hasDeaths: null,
  search: "",
};
