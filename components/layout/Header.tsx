"use client";

import { useState } from "react";
import ShinyText from "@/components/reactbits/ShinyText";

interface HeaderProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  lastUpdated: number | null;
  isLoading: boolean;
}

export function Header({ apiKey, onApiKeyChange, lastUpdated, isLoading }: HeaderProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [draft, setDraft] = useState(apiKey);

  const handleSave = () => {
    onApiKeyChange(draft.trim());
    setShowKeyInput(false);
  };

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <header className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            PT
          </div>
          <div>
            <h1 className="font-semibold leading-none">
              <ShinyText text="Portfolio Tracker" speed={4} color="#a1a1aa" shineColor="#e4e4e7" className="text-sm font-semibold" />
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time via Finnhub</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Fetching prices…
            </div>
          )}
          {!isLoading && formattedTime && (
            <div className="text-xs text-zinc-500">Updated {formattedTime}</div>
          )}

          {!showKeyInput ? (
            <button
              onClick={() => { setDraft(apiKey); setShowKeyInput(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                apiKey
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
              }`}
            >
              {apiKey ? "API Key ✓" : "⚠ Set API Key"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Finnhub API key"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowKeyInput(false); }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-52 transition-colors"
              />
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-white hover:bg-blue-500 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowKeyInput(false)}
                className="px-2 py-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
