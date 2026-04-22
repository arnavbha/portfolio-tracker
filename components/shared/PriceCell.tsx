import { formatCurrency, formatPercent, formatChange } from "@/lib/calculations";

interface PriceCellProps {
  price: number;
  change?: number;
  changePct?: number;
  showChange?: boolean;
}

export function PriceCell({ price, change, changePct, showChange = true }: PriceCellProps) {
  const isPositive = (change ?? 0) >= 0;
  const color = isPositive ? "text-emerald-400" : "text-red-400";

  return (
    <div>
      <div className="font-mono font-medium text-white">{formatCurrency(price)}</div>
      {showChange && change !== undefined && changePct !== undefined && (
        <div className={`text-xs font-mono ${color}`}>
          {formatChange(change)} ({formatPercent(changePct)})
        </div>
      )}
    </div>
  );
}
