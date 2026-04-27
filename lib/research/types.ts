export type FactorType = "computable" | "qualitative";

export interface FactorConfig {
  id: string;
  label: string;
  type: FactorType;
  weight: number;
  hardFloor: number | null;
}

export interface FrameworkRule {
  id: string;
  expression: string;
  severity: "hard" | "soft";
}

export interface FrameworkConfig {
  version: string;
  factors: FactorConfig[];
  thresholds: {
    viability: number;
    nearMissBandLow: number;
    nearMissBandHigh: number;
  };
  rules: FrameworkRule[];
}

export type ProseStatus =
  | "pending_validation"
  | "published"
  | "rate_limited"
  | "unavailable";

export type PickStatus = "active" | "invalidated";

export type AnnotationSource = "8-K" | "news" | "manual" | "llm-commentary";

export type ForwardReturnWindow = "1w" | "1m" | "3m" | "6m" | "1y";

export type BreakerState = "tripped" | "cleared";

export interface FactorScore {
  score: number;
  weight: number;
  note: string | null;
}

export interface NearMiss {
  ticker: string;
  score: number;
  failingFactor: string;
  factorGap: number;
}

export interface ProseSource {
  n: number;
  sourceType: AnnotationSource;
  url: string;
  label: string;
}

export interface ScanSnapshotRow {
  id: string;
  scanDate: string;
  frameworkVersion: string;
  universeSize: number;
  scores: Record<string, { score: number; factors: Record<string, FactorScore> }>;
  topScore: number;
  topTicker: string;
  viabilityThreshold: number;
  viabilityPassed: boolean;
  pickedTicker: string | null;
  nearMisses: NearMiss[];
  reasonText: string | null;
  createdAt: string;
}

export interface PickRow {
  id: string;
  ticker: string;
  scanSnapshotId: string;
  frameworkVersion: string;
  score: number;
  factorScores: Record<string, FactorScore>;
  thesisText: string;
  proseText: string | null;
  proseStatus: ProseStatus;
  proseSources: ProseSource[] | null;
  status: PickStatus;
  issuedDate: string;
  invalidatedAt: string | null;
  invalidationTrigger: string | null;
  createdAt: string;
}

export interface ThesisAnnotationRow {
  id: string;
  pickId: string;
  sourceType: AnnotationSource;
  sourceUrl: string | null;
  headline: string;
  bodyText: string | null;
  isAuto: boolean;
  occurredAt: string;
  createdAt: string;
}

export interface ForwardReturnRow {
  id: string;
  pickId: string;
  window: ForwardReturnWindow;
  pickDateClose: number | null;
  currentClose: number | null;
  absReturn: number | null;
  spyReturn: number | null;
  vsSpyReturn: number | null;
  computedAt: string;
}

export interface FrameworkVersionRow {
  id: string;
  version: string;
  configSnapshotJson: FrameworkConfig;
  migrationNotes: string | null;
  effectiveFrom: string;
  createdAt: string;
}

export interface ValidatorFailureRow {
  id: string;
  pickId: string | null;
  attemptNumber: number;
  rawProse: string;
  failedSentences: Array<{ sentence: string; reason: string }>;
  createdAt: string;
}

export interface ThesisBreakerEventRow {
  id: string;
  pickId: string;
  ruleId: string;
  state: BreakerState;
  triggerEvent: string | null;
  triggerUrl: string | null;
  isAuto: boolean;
  occurredAt: string;
  createdAt: string;
}

export interface LlmCallCounterRow {
  scanDate: string;
  callCount: number;
  lastCallAt: string | null;
}
