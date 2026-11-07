/**
 * Countries offered at sign-up (Europe + Africa first) and their default currency.
 * Country names are localized at runtime with Intl.DisplayNames — no translation tables.
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  // Central Africa (CEMAC, XAF)
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF", GQ: "XAF",
  // West Africa (UEMOA, XOF)
  SN: "XOF", CI: "XOF", BJ: "XOF", BF: "XOF", ML: "XOF", NE: "XOF", TG: "XOF", GW: "XOF",
  // Other African markets
  NG: "NGN", GH: "GHS", KE: "KES", RW: "RWF", CD: "CDF", MA: "MAD", TN: "TND", DZ: "DZD",
  EG: "EGP", ZA: "ZAR", MG: "MGA", MU: "MUR", ET: "ETB", TZ: "TZS", UG: "UGX", GN: "GNF",
  // Europe
  FR: "EUR", BE: "EUR", LU: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
  IE: "EUR", AT: "EUR", CH: "CHF", GB: "GBP",
  // Other
  CA: "CAD", US: "USD",
};

export const CURRENCIES = [...new Set([...Object.values(COUNTRY_CURRENCY), "USD"])].sort();

export function countryOptions(locale: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return Object.keys(COUNTRY_CURRENCY)
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
