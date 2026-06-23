# HT ECDIS — demo workstation (Hatteland Technology)

A modern, iPad-style ECDIS **demonstrator** for Norwegian west-coast waters
(Stavanger ↔ Bergen), built as a single streaming Design Component:
`ht-ecdis.html`. Open it directly in a browser.

> ⚠️ **DEMO — NOT FOR NAVIGATION.** This is a faithful simulator of ECDIS look &
> behaviour (IHO S-100 / S-52 presentation principles). It is **not** a
> type-approved ECDIS (IEC 61174) and must never be used for real navigation.

## Real data sources (live, no licence required)
All chart data is fetched live from public services — nothing is faked:

| Layer | Source | Notes |
|------|--------|-------|
| **Base — Sjøkart** | Kartverket WMTS `sjokartraster` | Official Norwegian raster sea chart |
| **Base — Topo** | Kartverket WMTS `topo` | Norgeskart topographic |
| **Base — Mørkt** | CARTO `dark_all` | Dark basemap for night bridge use |
| **Base — Flyfoto** | Esri World Imagery | Satellite / aerial photo |
| **Seamarks** | OpenSeaMap `seamark` | Buoys, lights, light sectors, contours |
| **Bathymetry** | EMODnet Bathymetry WMS `mean_multicolour` | Toggleable depth-surface layer |

Tiles are Web-Mercator (EPSG:3857) z/x/y; EMODnet is requested per-tile via WMS.

## What works in the demo
- **Live view** — own ship + 6 AIS targets move in real time (1× / 8× / 30×).
- **Click-to-plot routing** — tap *Plan route*, then tap the chart to drop
  waypoints; live leg bearing/distance, XTD channel, next-waypoint logic.
- **Anti-grounding** — look-ahead sector scans the depth model ahead of the ship
  and raises a prioritised alarm on crossing the safety contour.
- **CPA/TCPA** — dangerous-target detection and alarms.
- **Safety depths** — shallow / safety / deep contours with optional S-52 shading.
- **Day / Dusk / Night** palettes; North / Course / Head-up; pan / zoom / rotate.
- **Pick report**, **MOB** marker, alarm panel with acknowledgement.
- **S-111 surface current** — animated particle flow field overlay.
- Branding (logo + product name + accent colour) is configurable via the
  component props (`productName`, `accentColor`, `defaultPalette`).

## Honest data provenance (verified in-browser)
- **Real, live APIs:** all chart imagery — Kartverket sjøkart & topo, Esri aerial, OpenSeaMap seamarks, EMODnet bathymetry. Each basemap card shows a real tile thumbnail.
- **Live weather & ocean (MET Norway / YR):** wind, gusts, air pressure, air & sea temperature, wave height, **real sea-surface current**, and sunrise/sunset — fetched live at own-ship position (api.met.no, no key). The S-111 current layer is driven by a real MET current field sampled across the area.
- **Live AIS (aisstream.io):** paste a free aisstream.io API key in Chart › Live sources and the app opens a WebSocket and shows **real vessels** in the area (MMSI, name, type, SOG/COG/heading). Without a key, AIS is simulated.
- **Own-ship position (device GPS):** toggle “Own-ship GPS” to drive own ship from this device's geolocation — making it usable as a live (non-type-approved) navigation display.
- **Simulated only when no feed:** own-ship voyage simulator (when GPS off), and the S-124 nav-warning / S-104 tide-station demo features (no open browser API). BarentsWatch AIS and Kartverket tide APIs are CORS-blocked for keyless browsers (would need a server proxy).


- **Full / real:** chart imagery (Kartverket sjøkart, OpenSeaMap seamarks,
  EMODnet bathymetry), Mercator chart engine, route XTD, anti-grounding,
  CPA/TCPA, alarm prioritisation, palettes.
- **Simplified:** numeric depth for UKC / anti-grounding uses a coast-aware
  bathymetric **model** (the displayed charts are the real depth source). A
  production build would drive depth from decoded S-102/S-57 SENC cells.
- **Not implemented here** (needs a real backend + licence): S-63 decryption,
  S-57/S-101 SENC conversion, HDF5 (S-102/104) parsing, S-129 UKCM service.

## Adding real PRIMAR / Kartverket ENC cells (production path)
1. Obtain a PRIMAR account + cell/user permits (S-63).
2. Decrypt the exchange set and convert cells to a SENC.
3. Feed the SENC to the portrayal layer (S-52 / S-100 Portrayal Catalogue).
The demo auto-loads the free Kartverket sjøkart fallback when no permits exist.
