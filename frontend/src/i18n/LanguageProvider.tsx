import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LanguageContext } from "../hooks/useLanguage";
import { isLanguage, translations } from "./i18n";
import type { Language } from "./i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    return isLanguage(saved) ? saved : "pl";
  });

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("language", language);
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === "pl" ? "en" : "pl"));
  }, []);
  const value = useMemo(
    () => ({ language, t: translations[language], toggleLanguage }),
    [language, toggleLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
