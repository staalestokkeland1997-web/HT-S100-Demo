# Hatteland Technology Messekonkurranse — Vercel-utgave

Dette er den samme kiosk-appen som
[Test-HT-EXPO](https://github.com/staalestokkeland1997-web/Test-HT-EXPO)
(sju touchspill, adminsider og HT ECDIS/radar-demoen), men bygget for aa kjore
**paa Vercel i stedet for lokalt**. Ingen lokal server, ingen startskript,
ingen USB-leveranse: frontend serveres som statiske filer, og hele backend-
API-et kjorer som en serverless-funksjon (`api/[[...path]].js`).

## Innhold

Sju touchspill med maritimt preg, alle med egen highscoreliste:

| Spill | Type | URL |
| --- | --- | --- |
| Container Stacker | Presisjon, 1 spiller | `/container-stacker-standalone.html` |
| Fjord Runner | Endless runner, 1 spiller | `/fjord-runner-standalone.html` |
| Deep Dive | One-touch, 1 spiller | `/deep-dive-standalone.html` |
| Harbor Rush | Refleks, 1 spiller | `/harbor-rush-standalone.html` |
| Bridge Duel | 1 mot 1 | `/bridge-duel-standalone.html` |
| HT Air Hockey | 1 mot 1 | `/air-hockey-standalone.html` |
| Sonar Sequence | Hukommelse, 1 spiller | `/sonar-sequence-standalone.html` |
| HT ECDIS | Sjokart-demo (ikke spill) | `/ecdis/index.html?kiosk=1` |
| HT Radar | Radarkonsoll-demo (ikke spill) | `/ecdis/radar.html?kiosk=1` |

I tillegg:

- Forsiden `/` er **fullskjerm-skallet** (`app.html`): spillvelgeren og alt
  annet kjorer i en iframe, mens skallet selv aldri navigerer. Forste trykk
  paa skjermen setter ekte fullskjerm (nettlesere krever en brukerhandling
  for det), og deretter kan den ikke falle ut naar man gaar mellom sider.
  Esc avslutter som vanlig; neste trykk tar fullskjermen inn igjen.
- Spillvelgeren direkte (uten skall): `/select.html`. Alle sider har ogsaa
  `fullscreen.js` som gir fullskjerm ved forste trykk om de aapnes direkte,
  men bare skallet garanterer at den aldri slipper mellom sidebytter.
- Admin hub: `/admin.html`.
- Spillinnstillinger og highscore per spill: `/admin-games.html`.
- Harbor Rush detaljadmin: `/admin-rush.html`.
- Bridge Duel detaljadmin: `/admin-duel.html`.
- Driftsstatus: `/status.html`.
- CSV-eksport per spill eller samlet (fra adminsidene).

HT ECDIS er en innebygd sjokart-demonstrator: ekte norske sjokart, vaer og
ruteplanlegging. `/proxy`-endepunktet (streng allowlist) fungerer ogsaa paa
Vercel, saa MET/yr-vaer og Kartverket tidevann virker som for.

ECDIS-dokken (Main kiosk- og Radar-knappene nede til venstre og havnesoket
oppe ved merkevare-pillen) er stylet med appens egne palettvariabler og
folger day/dusk/night automatisk. Havnesoket har innebygd norsk havneliste
(virker uten API-nokkel; ArcGIS-sok legges oppaa naar nokkel finnes) og et
eget touch-tastatur med AE/O/AA i samme glass-stil. Velg et treff for aa faa
et destinasjonskort med "Set route to destination": appens dybdetrygge
autoroute planlegger ruten og seilasen startes automatisk. Havner utenfor
demo-kartomraadet vises som "view only".

HT Radar er et fullverdig radarkonsoll (demo) med roterende sveip og
etterglod, datablokker i hjornene, peilering med kurs- og nordmerke,
TX/STBY, pulslengde SP/MP/LP, range 0,25-48 nm, ringer av/paa,
N-UP/H-UP/C-UP, RM/TM (med TM-reset), off-center, trails 30 s-6 min,
relative/sanne vektorer 3/6/12 min, cursoravlesning, EBL/VRM, ARPA-
maalfolging (ACQ TT) med CPA/TCPA, faremaal-alarm med grenser, guard zone,
maalliste, alarmliste med ACK, gain/sea/rain + AUTO, interferens-
undertrykking (IR), echo stretch, gronn/amber fosfor og landekko fra
kystlinjen. Radaren folger samme seilas som ECDIS (delt lagret tilstand +
BroadcastChannel), og knapper kobler ECDIS <-> Radar <-> kiosk.
**DEMO — ikke for navigasjon.**

## Deploy paa Vercel

Repoet er klart for Vercel uten videre:

1. Importer GitHub-repoet i [Vercel](https://vercel.com/new) (Framework:
   «Other» — alt plukkes opp automatisk fra `vercel.json`).
2. Hver push til `main` gir en ny produksjonsdeploy; andre brancher faar
   preview-deploys.

Det finnes ingen lokal kjoremodus lenger — appen er bygget for aa leve paa
Vercel-URL-en.

## Varig lagring (viktig for messe)

Serverless-funksjoner har ikke varig filsystem, saa deltakere, highscore,
admin-innstillinger og ECDIS-tilstand lagres i en Redis-database naar en slik
er koblet til. **Uten database fungerer alt, men data er midlertidige** (de
overlever bare saa lenge samme funksjonsinstans er varm) — greit for testing,
ikke for en ekte konkurranse.

Slik kobler du til (engangsjobb, ~2 minutter):

1. Aapne Vercel-prosjektet → **Storage**-fanen → **Create Database** →
   velg **Upstash for Redis** (gratis-niveaaet holder lenge).
2. Koble databasen til prosjektet. Vercel legger da inn miljovariablene
   (`KV_REST_API_URL`/`KV_REST_API_TOKEN` eller
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) automatisk.
3. Redeploy. `/status.html` (og `/api/admin/status`) viser om varig lagring
   er aktiv.

Innsendte deltakere lagres atomisk (Redis-liste), saa to samtidige
innsendinger kan aldri overskrive hverandre. Ved nullstilling fra admin tas
det forst en sikkerhetskopi (de 10 siste ligger i databasen), akkurat som de
lokale `data/backups/`-kopiene gjorde.

## Miljovariabler (valgfritt)

| Variabel | Effekt |
| --- | --- |
| `ADMIN_PASSWORD` | Overstyrer adminpassordet fra `config/contest-config.json`. **Anbefales** — standardpassordet ligger i et offentlig repo. |
| `AISSTREAM_API_KEY` | Overstyrer `apiKeys.aisstream` (live AIS i ECDIS). |
| `ARCGIS_API_KEY` | Overstyrer `apiKeys.arcgis` (flyfoto/Ocean-basemap + stedssok i ECDIS). |

Settes under Vercel-prosjektet → **Settings → Environment Variables**.

## Konfigurasjon

Spill, poeng, branding, premie, personvern og adminpassord styres av
`config/contest-config.json` — samme format og felter som for. Filen er
**standardverdiene**: endringer gjort fra adminsidene lagres i databasen og
legges over disse (de overlever altsaa baade redeploys og nye pushes).

Viktige seksjoner:

- `game`: Harbor Rush settings.
- `duelGame`: Bridge Duel 1v1 settings.
- `airHockeyGame`, `stackerGame`, `runnerGame`, `diveGame`, `sonarGame`:
  settings for de ovrige spillene.
- `brand`: navn, logo, premie og lenker.
- `admin.password`: standardpassord for adminsidene (overstyr med
  `ADMIN_PASSWORD` i Vercel).
- `apiKeys`: API-nokler for innebygde demoer. `apiKeys.aisstream` brukes av
  HT ECDIS som standardnokkel for live AIS — appen kobler til automatisk.
  `apiKeys.arcgis` laaser opp Flyfoto/Ocean-basemaps og legger ArcGIS-treff
  oppaa havnesoket (den innebygde norske havnelisten virker uten nokkel).
- HT ECDIS husker seg selv mellom okter: skipets posisjon, kurs, rute,
  kartlag og palett lagres hvert 5. sekund (localStorage + `/api/ecdis-state`
  i databasen). Ved neste besok dodregnes skipet frem langs ruten etter
  veggklokken, saa demoen ser ut som den har seilt hele tiden.

`config/kiosk-config.json` bestemmer fortsatt standardruten for `/`
(spillvelgeren) og brukes av statusendepunktet. Server-/nettleserfeltene i
filen er uten funksjon paa Vercel.

## API

Samme API som den lokale serveren, naa under Vercel-domenet:

```text
GET  /api/config
GET  /api/leaderboard?game=<id>
GET  /api/games
POST /api/standalone-entry
GET/POST /api/ecdis-state
GET  /proxy?url=<https-url>          (allowlist: MET/yr, Kartverket m.fl.)
GET  /api/admin/entries              (header: x-admin-password)
GET/POST /api/admin/settings
GET/POST /api/admin/duel-settings
GET/POST /api/admin/game-settings
GET  /api/admin/export[?game=<id>]   (CSV)
GET  /api/admin/status
POST /api/admin/reset
```

## Prosjektstruktur

```text
api/
  [[...path]].js         (hele backend-API-et som en serverless-funksjon)
  _lib/
    contest.js           (spillogikk/normalisering — portert fra server.js)
    store.js             (Redis-lagring med /tmp-fallback)
config/
  contest-config.json    (standardverdier for spill/branding/admin)
  kiosk-config.json      (standardrute for forsiden)
public/                  (alt som serveres statisk)
  app.html               (fullskjerm-skall — `/` gaar hit; app i iframe)
  fullscreen.js          (fullskjerm-keeper, lastes paa alle kiosksider)
  select.html            (spillvelgeren)
  *-standalone.html      (spillene)
  admin*.html/js, status.html/js
  ecdis/                 (HT ECDIS + HT Radar med vendored React/fonter)
vercel.json              (rewrites, cache-headere, output-katalog)
```

## Personvern

Deltakere lagres med navn, e-post og telefon kun for konkurransen og
premievarsling (se `privacy`-teksten i config). Husk at en offentlig
Vercel-URL er tilgjengelig for alle: sett `ADMIN_PASSWORD`, og nullstill
databasen etter messen (admin → Reset, eller slett Redis-databasen).
