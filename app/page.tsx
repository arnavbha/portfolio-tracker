"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { ActualPortfolio } from "@/components/actual/ActualPortfolio";
import { SoftPortfolio } from "@/components/soft/SoftPortfolio";
import { Shortlist } from "@/components/shortlist/Shortlist";
import { PortfolioCharts } from "@/components/charts/PortfolioCharts";
import { usePortfolioStore } from "@/hooks/usePortfolioStore";
import { useStockPrices } from "@/hooks/useStockPrices";
import { useApiKey } from "@/hooks/useApiKey";

type Tab = "portfolio" | "soft" | "shortlist" | "charts";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "portfolio", label: "Portfolio", icon: "📈" },
  { id: "soft", label: "Soft Portfolio", icon: "🧪" },
  { id: "shortlist", label: "Shortlist", icon: "👀" },
  { id: "charts", label: "Charts", icon: "📊" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("portfolio");
  const { apiKey, setApiKey } = useApiKey();

  const {
    loaded,
    actualHoldings,
    softHoldings,
    watchlist,
    addActualHolding,
    removeActualHolding,
    addSoftHolding,
    removeSoftHolding,
    addToWatchlist,
    removeFromWatchlist,
  } = usePortfolioStore();

  const allSymbols = useMemo(() => {
    const s = new Set<string>();
    actualHoldings.forEach((h) => s.add(h.symbol));
    softHoldings.forEach((h) => s.add(h.symbol));
    watchlist.forEach((w) => s.add(w.symbol));
    return Array.from(s);
  }, [actualHoldings, softHoldings, watchlist]);

  const { data: quotes = {}, isFetching, dataUpdatedAt } = useStockPrices(allSymbols, apiKey);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        lastUpdated={dataUpdatedAt || null}
        isLoading={isFetching}
      />

      {!apiKey && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
          <p className="text-sm text-amber-400 text-center max-w-7xl mx-auto">
            Set your free{" "}
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-300"
            >
              Finnhub API key
            </a>{" "}
            to enable real-time prices. Click <strong>&quot;⚠ Set API Key&quot;</strong> in the top right.
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full flex-1 px-6 py-6">
        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === "portfolio" && actualHoldings.length > 0 && (
                <span className="bg-zinc-600 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">
                  {actualHoldings.length}
                </span>
              )}
              {tab.id === "soft" && softHoldings.length > 0 && (
                <span className="bg-zinc-600 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">
                  {softHoldings.length}
                </span>
              )}
              {tab.id === "shortlist" && watchlist.length > 0 && (
                <span className="bg-zinc-600 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">
                  {watchlist.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          {activeTab === "portfolio" && (
            <ActualPortfolio
              holdings={actualHoldings}
              quotes={quotes}
              apiKey={apiKey}
              onAdd={addActualHolding}
              onRemove={removeActualHolding}
            />
          )}
          {activeTab === "soft" && (
            <SoftPortfolio
              holdings={softHoldings}
              quotes={quotes}
              apiKey={apiKey}
              onAdd={addSoftHolding}
              onRemove={removeSoftHolding}
            />
          )}
          {activeTab === "shortlist" && (
            <Shortlist
              items={watchlist}
              quotes={quotes}
              loading={isFetching}
              apiKey={apiKey}
              onAdd={addToWatchlist}
              onRemove={removeFromWatchlist}
            />
          )}
          {activeTab === "charts" && (
            <PortfolioCharts
              actualHoldings={actualHoldings}
              softHoldings={softHoldings}
              watchlist={watchlist}
              quotes={quotes}
            />
          )}
        </div>
      </div>
    </div>
  );
}
