"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ActualHolding, SoftHolding, WatchlistItem, PortfolioStore } from "@/types";
import { loadStore, saveStore } from "@/lib/storage";

const EMPTY: PortfolioStore = { actualHoldings: [], softHoldings: [], watchlist: [] };

async function fetchStore(): Promise<PortfolioStore> {
  const res = await fetch("/api/portfolio");
  if (!res.ok) throw new Error("Failed to load portfolio");
  return res.json();
}

async function persistStore(store: PortfolioStore): Promise<void> {
  await fetch("/api/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(store),
  });
}

export function usePortfolioStore() {
  // Seed from localStorage immediately so the UI never flashes blank
  const [store, setStore] = useState<PortfolioStore>(() => {
    if (typeof window === "undefined") return EMPTY;
    return loadStore();
  });
  const [loaded, setLoaded] = useState(false);

  // Debounce server writes — don't hammer the API on rapid changes
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDebounced = useCallback((next: PortfolioStore) => {
    // Keep localStorage in sync as instant fallback
    saveStore(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistStore(next).catch(console.error);
    }, 400);
  }, []);

  // On mount: fetch the authoritative copy from the server file
  useEffect(() => {
    fetchStore()
      .then((serverStore) => {
        setStore(serverStore);
        // Mirror to localStorage so next cold-start is instant
        saveStore(serverStore);
      })
      .catch(() => {
        // Server unreachable — fall back to whatever localStorage had
      })
      .finally(() => setLoaded(true));
  }, []);

  const updateStore = useCallback(
    (updater: (prev: PortfolioStore) => PortfolioStore) => {
      setStore((prev) => {
        const next = updater(prev);
        persistDebounced(next);
        return next;
      });
    },
    [persistDebounced]
  );

  // ── Actual Holdings ──────────────────────────────────────────────────────
  const addActualHolding = useCallback(
    (holding: Omit<ActualHolding, "id" | "addedAt">) => {
      updateStore((prev) => ({
        ...prev,
        actualHoldings: [
          ...prev.actualHoldings,
          { ...holding, id: crypto.randomUUID(), addedAt: Date.now() },
        ],
      }));
    },
    [updateStore]
  );

  const removeActualHolding = useCallback(
    (id: string) => {
      updateStore((prev) => ({
        ...prev,
        actualHoldings: prev.actualHoldings.filter((h) => h.id !== id),
      }));
    },
    [updateStore]
  );

  const updateActualHolding = useCallback(
    (id: string, updates: Partial<Pick<ActualHolding, "shares" | "costBasis">>) => {
      updateStore((prev) => ({
        ...prev,
        actualHoldings: prev.actualHoldings.map((h) =>
          h.id === id ? { ...h, ...updates } : h
        ),
      }));
    },
    [updateStore]
  );

  // ── Soft Holdings ────────────────────────────────────────────────────────
  const addSoftHolding = useCallback(
    (holding: Omit<SoftHolding, "id" | "addedAt">) => {
      updateStore((prev) => ({
        ...prev,
        softHoldings: [
          ...prev.softHoldings,
          { ...holding, id: crypto.randomUUID(), addedAt: Date.now() },
        ],
      }));
    },
    [updateStore]
  );

  const removeSoftHolding = useCallback(
    (id: string) => {
      updateStore((prev) => ({
        ...prev,
        softHoldings: prev.softHoldings.filter((h) => h.id !== id),
      }));
    },
    [updateStore]
  );

  // ── Watchlist ────────────────────────────────────────────────────────────
  const addToWatchlist = useCallback(
    (symbol: string) => {
      updateStore((prev) => {
        if (prev.watchlist.some((w) => w.symbol === symbol)) return prev;
        return {
          ...prev,
          watchlist: [
            ...prev.watchlist,
            { id: crypto.randomUUID(), symbol, addedAt: Date.now() },
          ],
        };
      });
    },
    [updateStore]
  );

  const removeFromWatchlist = useCallback(
    (id: string) => {
      updateStore((prev) => ({
        ...prev,
        watchlist: prev.watchlist.filter((w) => w.id !== id),
      }));
    },
    [updateStore]
  );

  return {
    loaded,
    actualHoldings: store.actualHoldings,
    softHoldings: store.softHoldings,
    watchlist: store.watchlist,
    addActualHolding,
    removeActualHolding,
    updateActualHolding,
    addSoftHolding,
    removeSoftHolding,
    addToWatchlist,
    removeFromWatchlist,
  };
}
