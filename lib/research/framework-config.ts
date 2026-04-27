import type { FrameworkConfig } from "./types";

export const FRAMEWORK_CONFIG: FrameworkConfig = {
  version: "v1.0.0",
  factors: [
    { id: "revenue-quality",        label: "Revenue quality",                    type: "computable",  weight: 11, hardFloor: null },
    { id: "margin-durability",      label: "Margin durability",                  type: "computable",  weight: 11, hardFloor: null },
    { id: "fcf-conversion",         label: "FCF conversion",                     type: "computable",  weight: 9,  hardFloor: null },
    { id: "balance-sheet-strength", label: "Balance sheet strength",             type: "computable",  weight: 9,  hardFloor: null },
    { id: "valuation-vs-quality",   label: "Valuation vs quality",               type: "computable",  weight: 8,  hardFloor: null },
    { id: "backlog-quality",        label: "Backlog quality",                    type: "computable",  weight: 4,  hardFloor: null },
    { id: "moat-defensibility",     label: "Moat / defensibility",               type: "qualitative", weight: 10, hardFloor: 2 },
    { id: "pricing-power",          label: "Pricing power",                      type: "qualitative", weight: 7,  hardFloor: 2 },
    { id: "switching-costs",        label: "Switching costs",                    type: "qualitative", weight: 6,  hardFloor: null },
    { id: "scarce-assets",          label: "Scarce assets / bottleneck control", type: "qualitative", weight: 5,  hardFloor: null },
    { id: "industry-structure",     label: "Industry structure",                 type: "qualitative", weight: 5,  hardFloor: 2 },
    { id: "management-record",      label: "Management record",                  type: "qualitative", weight: 5,  hardFloor: 3 },
    { id: "catalysts",              label: "Catalysts",                          type: "qualitative", weight: 5,  hardFloor: null },
    { id: "thesis-breakers",        label: "Key risks / thesis breakers",        type: "qualitative", weight: 5,  hardFloor: null },
  ],
  thresholds: {
    viability: 75,
    nearMissBandLow: 70,
    nearMissBandHigh: 74,
  },
  rules: [
    { id: "min-history",          severity: "hard", expression: "Require minimum 6 months of price history." },
    { id: "mgmt-floor",           severity: "hard", expression: "Drop any ticker where management-record < 3." },
    { id: "moat-floor",           severity: "hard", expression: "Drop any ticker where moat-defensibility < 2." },
    { id: "pricing-floor",        severity: "hard", expression: "Drop any ticker where pricing-power < 2." },
    { id: "industry-floor",       severity: "hard", expression: "Drop any ticker where industry-structure < 2." },
    { id: "soft-revenue-decline", severity: "soft", expression: "Soft-flag tickers with two consecutive quarters of revenue decline." },
  ],
};

export function totalWeight(config: FrameworkConfig): number {
  return config.factors.reduce((sum, f) => sum + f.weight, 0);
}

export function serializeSnapshot(config: FrameworkConfig): FrameworkConfig {
  // Snapshot = the live config, JSON-cloned. The diff page renders against snapshots,
  // not the live TS, so the snapshot must be self-contained (no symbol references).
  return JSON.parse(JSON.stringify(config));
}

export function snapshotsEqual(a: FrameworkConfig, b: FrameworkConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
