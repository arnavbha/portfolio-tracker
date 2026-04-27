/**
 * S&P 100 universe. Hand-curated, snapshot-style — committed to git so scan
 * runs are reproducible. Update this list when index composition changes;
 * the diff page makes drift visible to anyone tracking the framework.
 *
 * Source of truth: S&P Global OEX constituents. Verify against
 * https://www.spglobal.com/spdji/en/indices/equity/sp-100/ before edits.
 *
 * Note: dual-class names (e.g. GOOG/GOOGL) are listed only once — pick the
 * primary share class so a single ticker represents one company in the
 * scoring layer. Do NOT add both classes; it would double-count the issuer.
 */

export const SP100_UNIVERSE: readonly string[] = [
  "AAPL", "ABBV", "ABT",  "ACN",  "ADBE", "AIG",  "AMD",  "AMGN", "AMT",  "AMZN",
  "AVGO", "AXP",  "BA",   "BAC",  "BK",   "BKNG", "BLK",  "BMY",  "BRK.B","C",
  "CAT",  "CHTR", "CL",   "CMCSA","COF",  "COP",  "COST", "CRM",  "CSCO", "CVS",
  "CVX",  "DE",   "DHR",  "DIS",  "DOW",  "DUK",  "ELV",  "EMR",  "EXC",  "F",
  "FDX",  "GD",   "GE",   "GILD", "GM",   "GOOGL","GS",   "HD",   "HON",  "IBM",
  "INTC", "INTU", "ISRG", "JNJ",  "JPM",  "KHC",  "KMI",  "KO",   "LIN",  "LLY",
  "LMT",  "LOW",  "MA",   "MCD",  "MDLZ", "MDT",  "MET",  "META", "MMM",  "MO",
  "MRK",  "MS",   "MSFT", "NEE",  "NFLX", "NKE",  "NVDA", "ORCL", "PEP",  "PFE",
  "PG",   "PM",   "PYPL", "QCOM", "RTX",  "SBUX", "SCHW", "SO",   "SPG",  "T",
  "TGT",  "TMO",  "TMUS", "TSLA", "TXN",  "UNH",  "UNP",  "UPS",  "USB",  "V",
  "VZ",   "WBA",  "WFC",  "WMT",  "XOM",
];

export function isInUniverse(ticker: string): boolean {
  return SP100_UNIVERSE.includes(ticker);
}

export function universeSize(): number {
  return SP100_UNIVERSE.length;
}
