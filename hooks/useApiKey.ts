"use client";

import { useState, useEffect } from "react";
import { loadApiKey, saveApiKey } from "@/lib/storage";

async function fetchApiKey(): Promise<{ key: string; source: string }> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch config");
  const data = await res.json();
  return { key: data.finnhubKey ?? "", source: data.source };
}

async function saveApiKeyToServer(key: string): Promise<void> {
  await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finnhubKey: key }),
  });
}

export function useApiKey() {
  // Seed from localStorage so prices start fetching immediately on load
  const [apiKey, setApiKeyState] = useState(() =>
    typeof window !== "undefined" ? loadApiKey() : ""
  );
  const [keySource, setKeySource] = useState<"env" | "file" | "none" | "local">("local");

  useEffect(() => {
    fetchApiKey()
      .then(({ key, source }) => {
        if (key) {
          setApiKeyState(key);
          saveApiKey(key); // mirror to localStorage
          setKeySource(source as "env" | "file" | "none");
        }
      })
      .catch(() => {
        // Server unreachable — keep whatever localStorage had
      });
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    saveApiKey(key); // instant localStorage update
    saveApiKeyToServer(key).catch(console.error); // persist to file
  };

  return { apiKey, setApiKey, keySource };
}
