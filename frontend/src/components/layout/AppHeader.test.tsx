import { fireEvent, screen } from "@testing-library/react";
import { translations } from "../../i18n/i18n";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders theme and language controls with labels", () => {
    renderWithProviders(
      <AppHeader theme="light" onThemeToggle={vi.fn()} />,
      "en"
    );

    expect(
      screen.getByRole("button", { name: "Turn on dark mode" })
    ).toHaveTextContent("Dark mode");
    expect(
      screen.getByRole("button", { name: translations.en.languageToggleLabel })
    ).toHaveTextContent(translations.en.languageToggleText);
  });

  it("toggles theme via the callback and language via context", () => {
    const onThemeToggle = vi.fn();

    renderWithProviders(
      <AppHeader theme="dark" onThemeToggle={onThemeToggle} />,
      "en"
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn on light mode" }));
    fireEvent.click(
      screen.getByRole("button", { name: translations.en.languageToggleLabel })
    );

    expect(onThemeToggle).toHaveBeenCalled();
    expect(document.documentElement.lang).toBe("pl");
  });
});
