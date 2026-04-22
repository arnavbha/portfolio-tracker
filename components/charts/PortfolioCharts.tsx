"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  type PieLabelRenderProps,
} from "recharts";
import { ActualHolding, SoftHolding, WatchlistItem, StockQuote } from "@/types";
import { computeActualStats, computeSoftStats, formatCurrency, formatPercent } from "@/lib/calculations";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import CountUp from "@/components/reactbits/CountUp";
import GlareHover from "@/components/reactbits/GlareHover";

// ── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899",
  "#10b981", "#f97316", "#6366f1", "#14b8a6", "#e11d48",
  "#84cc16", "#a855f7",
];

// ── Tooltip styles ────────────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <GlareHover
      className="rounded-2xl border border-zinc-800 bg-zinc-900"
      glareColor="#6366f1"
      glareOpacity={0.06}
      glareSize={350}
    >
      <div className="p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </div>
    </GlareHover>
  );
}

// ── Custom donut label ────────────────────────────────────────────────────────
const renderCustomLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
  if ((percent ?? 0) < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = (innerRadius as number) + ((outerRadius as number) - (innerRadius as number)) * 0.5;
  const x = (cx as number) + r * Math.cos(-(midAngle as number) * RADIAN);
  const y = (cy as number) + r * Math.sin(-(midAngle as number) * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {name}
    </text>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface PortfolioChartsProps {
  actualHoldings: ActualHolding[];
  softHoldings: SoftHolding[];
  watchlist: WatchlistItem[];
  quotes: Record<string, StockQuote>;
}

export function PortfolioCharts({ actualHoldings, softHoldings, watchlist, quotes }: PortfolioChartsProps) {
  // ── Actual portfolio calculations ─────────────────────────────────────────
  const actualStats = useMemo(
    () => actualHoldings.map((h) => ({ holding: h, stats: computeActualStats(h, quotes[h.symbol]) })),
    [actualHoldings, quotes]
  );

  const totalValue = actualStats.reduce((s, { stats }) => s + (stats?.marketValue ?? 0), 0);
  const totalCost = actualStats.reduce((s, { stats }) => s + (stats?.totalCost ?? 0), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // ── Allocation donut data ─────────────────────────────────────────────────
  const allocationData = useMemo(
    () =>
      actualStats
        .filter(({ stats }) => stats && stats.marketValue > 0)
        .map(({ holding, stats }, i) => ({
          name: holding.symbol,
          value: stats!.marketValue,
          color: PALETTE[i % PALETTE.length],
          pct: totalValue > 0 ? (stats!.marketValue / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value),
    [actualStats, totalValue]
  );

  // ── P&L bar chart data ────────────────────────────────────────────────────
  const pnlData = useMemo(
    () =>
      actualStats
        .filter(({ stats }) => stats !== null)
        .map(({ holding, stats }) => ({
          symbol: holding.symbol,
          pnl: stats!.pnl,
          pnlPct: stats!.pnlPct,
          color: stats!.pnl >= 0 ? "#10b981" : "#ef4444",
        }))
        .sort((a, b) => b.pnl - a.pnl),
    [actualStats]
  );

  // ── Daily movers (all sections) ───────────────────────────────────────────
  const allSymbols = useMemo(() => {
    const seen = new Set<string>();
    const items: { symbol: string; section: "portfolio" | "soft" | "watch" }[] = [];
    for (const h of actualHoldings) {
      if (!seen.has(h.symbol)) { seen.add(h.symbol); items.push({ symbol: h.symbol, section: "portfolio" }); }
    }
    for (const h of softHoldings) {
      if (!seen.has(h.symbol)) { seen.add(h.symbol); items.push({ symbol: h.symbol, section: "soft" }); }
    }
    for (const w of watchlist) {
      if (!seen.has(w.symbol)) { seen.add(w.symbol); items.push({ symbol: w.symbol, section: "watch" }); }
    }
    return items;
  }, [actualHoldings, softHoldings, watchlist]);

  const moversData = useMemo(
    () =>
      allSymbols
        .filter(({ symbol }) => quotes[symbol])
        .map(({ symbol, section }) => ({
          symbol,
          section,
          changePct: quotes[symbol].dailyChangePct,
          change: quotes[symbol].dailyChange,
          price: quotes[symbol].currentPrice,
        }))
        .sort((a, b) => b.changePct - a.changePct),
    [allSymbols, quotes]
  );

  // ── Soft portfolio comparison data ────────────────────────────────────────
  const softCompData = useMemo(
    () =>
      softHoldings
        .map((h) => {
          const stats = computeSoftStats(h, quotes[h.symbol]);
          if (!stats) return null;
          return {
            symbol: h.symbol,
            gainPct: stats.gainPct,
            gain: stats.gain,
            color: stats.gain >= 0 ? "#10b981" : "#ef4444",
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.gainPct - a!.gainPct) as {
          symbol: string; gainPct: number; gain: number; color: string;
        }[],
    [softHoldings, quotes]
  );

  const hasActual = actualHoldings.length > 0;
  const hasSoft = softHoldings.length > 0;
  const hasAny = allSymbols.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <div className="text-5xl mb-4">📊</div>
        <div className="font-medium text-zinc-400 text-lg">No data to visualize yet</div>
        <div className="text-sm mt-1">Add holdings to your Portfolio or Soft Portfolio to see charts</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      {hasActual && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Portfolio Value",
              value: totalValue,
              prefix: "$",
              decimals: 2,
              spotlight: "rgba(59,130,246,0.25)",
              color: "text-blue-400",
            },
            {
              label: "Total Invested",
              value: totalCost,
              prefix: "$",
              decimals: 2,
              spotlight: "rgba(139,92,246,0.2)",
              color: "text-violet-400",
            },
            {
              label: "Total P&L",
              value: Math.abs(totalPnl),
              prefix: totalPnl >= 0 ? "+$" : "-$",
              decimals: 2,
              spotlight: totalPnl >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
              color: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
            },
            {
              label: "Return",
              value: Math.abs(totalPnlPct),
              prefix: totalPnlPct >= 0 ? "+" : "-",
              suffix: "%",
              decimals: 2,
              spotlight: totalPnlPct >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
              color: totalPnlPct >= 0 ? "text-emerald-400" : "text-red-400",
            },
          ].map((card) => (
            <SpotlightCard
              key={card.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              spotlightColor={card.spotlight}
            >
              <div className="text-xs text-zinc-500 mb-1">{card.label}</div>
              <div className={`font-mono font-bold text-xl ${card.color}`}>
                {card.prefix}
                <CountUp
                  to={card.value}
                  separator=","
                  duration={1.4}
                  delay={0.1}
                />
                {card.suffix}
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}

      {/* ── Row 1: Allocation donut + P&L bars ─────────────────────────────── */}
      {hasActual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Donut */}
          {allocationData.length > 0 && (
            <ChartCard title="Portfolio Allocation" subtitle="By current market value">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        dataKey="value"
                        labelLine={false}
                        label={renderCustomLabel}
                        animationBegin={0}
                        animationDuration={900}
                      >
                        {allocationData.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.color} opacity={0.9} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val) => [formatCurrency(val as number), "Value"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {allocationData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="font-mono font-semibold text-white w-12 flex-shrink-0">{d.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${d.pct}%`, background: d.color }}
                        />
                      </div>
                      <span className="text-zinc-400 w-10 text-right flex-shrink-0">{d.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          )}

          {/* P&L bars */}
          {pnlData.length > 0 && (
            <ChartCard title="P&L by Position" subtitle="Unrealized gain / loss">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pnlData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v >= 0 ? "" : ""}${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
                  />
                  <YAxis
                    dataKey="symbol"
                    type="category"
                    tick={{ fill: "#e4e4e7", fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <ReferenceLine x={0} stroke="#52525b" strokeWidth={1} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => {
                      const n = val as number;
                      return [`${n >= 0 ? "+" : ""}${formatCurrency(n)}`, "P&L"];
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {pnlData.map((entry) => (
                      <Cell key={entry.symbol} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Daily movers ───────────────────────────────────────────────────── */}
      {moversData.length > 0 && (
        <ChartCard title="Today's Movers" subtitle="Daily % change across all tracked symbols">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {moversData.map((m) => {
              const pct = m.changePct;
              const abs = Math.abs(pct);
              // Intensity: 0–1 scale, maxes out at 4%
              const intensity = Math.min(abs / 4, 1);
              const bgColor = pct >= 0
                ? `rgba(16,185,129,${0.08 + intensity * 0.22})`
                : `rgba(239,68,68,${0.08 + intensity * 0.22})`;
              const borderColor = pct >= 0
                ? `rgba(16,185,129,${0.2 + intensity * 0.4})`
                : `rgba(239,68,68,${0.2 + intensity * 0.4})`;
              const textColor = pct >= 0 ? "#34d399" : "#f87171";
              const sectionBadge = { portfolio: "●", soft: "◌", watch: "○" }[m.section];
              const sectionTitle = { portfolio: "Portfolio", soft: "Soft", watch: "Watchlist" }[m.section];

              return (
                <div
                  key={m.symbol}
                  className="rounded-xl p-3 flex flex-col gap-1 transition-transform hover:scale-[1.03]"
                  style={{ background: bgColor, border: `1px solid ${borderColor}` }}
                  title={`${m.symbol} — ${sectionTitle}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-xs">{m.symbol}</span>
                    <span className="text-zinc-500 text-[9px]" title={sectionTitle}>{sectionBadge}</span>
                  </div>
                  <div className="font-mono text-[10px] text-zinc-400">{formatCurrency(m.price)}</div>
                  <div className="font-mono font-semibold text-xs" style={{ color: textColor }}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* ── Soft portfolio gain comparison ─────────────────────────────────── */}
      {hasSoft && softCompData.length > 0 && (
        <ChartCard title="Soft Portfolio — Hypothetical Return %" subtitle="If you had bought at your entry price">
          <ResponsiveContainer width="100%" height={Math.max(120, softCompData.length * 38)}>
            <BarChart data={softCompData} layout="vertical" margin={{ left: -10, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
              />
              <YAxis
                dataKey="symbol"
                type="category"
                tick={{ fill: "#e4e4e7", fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ReferenceLine x={0} stroke="#52525b" strokeWidth={1} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val) => { const n = val as number; return [`${n >= 0 ? "+" : ""}${n.toFixed(2)}%`, "Gain %"]; }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="gainPct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {softCompData.map((entry) => (
                  <Cell key={entry.symbol} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
