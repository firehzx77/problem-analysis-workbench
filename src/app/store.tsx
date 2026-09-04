import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CaseRecord } from "@/domain/case";
import { resolveSettings, type ModelSettings } from "@/domain/settings";
import {
  deleteCase as removeStored,
  getCase,
  listCases,
  loadSettings,
  saveCase as persistCase,
  saveSettings as persistSettings,
} from "@/storage/db";

interface Store {
  cases: CaseRecord[];
  settings: ModelSettings;
  refresh: () => void;
  upsert: (record: CaseRecord) => CaseRecord;
  patchCase: (id: string, recipe: (prev: CaseRecord) => CaseRecord) => CaseRecord | null;
  remove: (id: string) => void;
  writeSettings: (settings: ModelSettings) => void;
  find: (id: string) => CaseRecord | null;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<CaseRecord[]>(() => listCases());
  const [settings, setSettings] = useState<ModelSettings>(() => loadSettings());

  const refresh = useCallback(() => {
    setCases(listCases());
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === "sansheng.settings.v1" || event.key === "sansheng.cases.v1") refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const upsert = useCallback((record: CaseRecord) => {
    const saved = persistCase(record);
    setCases(listCases());
    return saved;
  }, []);

  const patchCase = useCallback((id: string, recipe: (prev: CaseRecord) => CaseRecord) => {
    const prev = getCase(id);
    if (!prev) return null;
    const saved = persistCase(recipe(prev));
    setCases(listCases());
    return saved;
  }, []);

  const remove = useCallback((id: string) => {
    removeStored(id);
    setCases(listCases());
  }, []);

  const writeSettings = useCallback((next: ModelSettings) => {
    const resolved = resolveSettings(next);
    persistSettings(resolved);
    setSettings(resolved);
  }, []);

  const find = useCallback((id: string) => getCase(id), [cases]);

  const value = useMemo(
    () => ({ cases, settings, refresh, upsert, patchCase, remove, writeSettings, find }),
    [cases, settings, refresh, upsert, patchCase, remove, writeSettings, find],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
