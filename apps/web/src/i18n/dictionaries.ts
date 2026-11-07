import "server-only";

import type { Locale } from "./config";
import type fr from "./dictionaries/fr.json";

export type Dictionary = typeof fr;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  // Typed as Dictionary: a missing key in en.json is a compile error.
  en: () => import("./dictionaries/en.json").then((m) => m.default satisfies Dictionary),
};

export const getDictionary = (locale: Locale): Promise<Dictionary> => dictionaries[locale]();
