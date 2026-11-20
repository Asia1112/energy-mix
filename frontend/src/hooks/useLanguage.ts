import { createContext, useContext } from "react";
import type { Language, Translations } from "../i18n/i18n";

export const LanguageContext = createContext<{
  language: Language;
  t: Translations;
  toggleLanguage: () => void;
} | null>(null);

export function useLanguage() {
  const language = useContext(LanguageContext);
  if (!language) throw new Error("LanguageProvider is required.");
  return language;
}
