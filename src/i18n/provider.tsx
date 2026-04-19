"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ca } from "./ca";
import { es } from "./es";

type Lang = "ca" | "es";
type Translations = typeof ca;

const dictionaries: Record<Lang, Translations> = { ca, es };

interface I18nContextValue {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ca");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
    if (stored === "ca" || stored === "es") {
      setLangState(stored);
    } else if (typeof navigator !== "undefined") {
      const nav = navigator.language.toLowerCase();
      if (nav.startsWith("es")) setLangState("es");
      else setLangState("ca");
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", l);
    }
  };

  return (
    <I18nContext.Provider value={{ lang, t: dictionaries[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Helper para reemplazar {placeholders}
export function tpl(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
