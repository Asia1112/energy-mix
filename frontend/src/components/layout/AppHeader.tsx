import { useLanguage } from "../../hooks/useLanguage";
import type { Theme } from "../../lib/theme";

interface Props {
  theme: Theme;
  onThemeToggle: () => void;
}

export function AppHeader({ theme, onThemeToggle }: Props) {
  const { t, toggleLanguage } = useLanguage();
  return (
    <div className="app-header">
      <h1>Energy Mix UK</h1>

      <div className="app-actions">
        <button
          className="theme-toggle"
          type="button"
          onClick={onThemeToggle}
          aria-label={`${t.themeToggleLabel} ${
            theme === "dark" ? t.themeLight : t.themeDark
          }`}
        >
          {theme === "dark" ? t.themeLightButton : t.themeDarkButton}
        </button>

        <button
          className="language-toggle"
          type="button"
          onClick={toggleLanguage}
          aria-label={t.languageToggleLabel}
        >
          {t.languageToggleText}
        </button>
      </div>
    </div>
  );
}
