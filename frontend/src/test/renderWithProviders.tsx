import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppProviders } from "../AppProviders";
import type { Language } from "../i18n/i18n";

export function renderWithProviders(
  element: ReactElement,
  language: Language = "pl"
) {
  localStorage.setItem("language", language);
  return render(element, { wrapper: AppProviders });
}
