import { formatCurrency, formatPercent } from "@/lib/calculations";

interface PnLCellProps {
  pnl: number;
  pnlPct: number;
}

export function PnLCell({ pnl, pnlPct }: PnLCellProps) {
  const isPositive = pnl >= 0;
  const color = isPositive ? "text-emerald-400" : "text-red-400";
  const arrow = isPositive ? "▲" : "▼";

  return (
    <div className={`font-mono ${color}`}>
      <div className="font-medium">
        {arrow} {formatCurrency(Math.abs(pnl))}
      </div>
      <div className="text-xs">{formatPercent(pnlPct)}</div>
    </div>
  );
}
