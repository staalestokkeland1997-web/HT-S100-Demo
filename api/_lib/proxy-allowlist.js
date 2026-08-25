"use strict";

// Allowlist for /proxy — CORS-broen mot ECDIS-demoens dataleverandorer.
//
// Verdien er enten true (hele verten er tillatt) eller en stiprefiks.
// Prefiksen finnes fordi raw.githubusercontent.com serverer vilkaarlig
// innhold fra et hvilket som helst offentlig repo: aapen tilgang gjorde
// proxyen til et generelt relay. Demoen trenger EN fil derfra - kystlinjen -
// og faar bare den.
const PROXY_HOSTS = new Map([
  ["api.met.no", true],
  ["vannstand.kartverket.no", true],
  // Sjokartflisene: radaren maler landekkoene fra de SAMME flisene ECDIS
  // tegner, og maa lese pikslene. Naar nettleseren ikke faar CORS direkte
  // hentes flisen herfra i stedet - da er den samme opphav og lesbar.
  ["cache.kartverket.no", true],
  ["ows.emodnet-bathymetry.eu", true],
  ["d2ad6b4ur7yvpq.cloudfront.net", "/naturalearth-3.3.0/"],
  ["raw.githubusercontent.com", "/nvkelso/natural-earth-vector/"]
]);

function proxyAllows(target) {
  if (!target || target.protocol !== "https:") return false;
  const rule = PROXY_HOSTS.get(target.hostname);
  if (rule === true) return true;
  return typeof rule === "string" && target.pathname.startsWith(rule);
}

module.exports = { PROXY_HOSTS, proxyAllows };
