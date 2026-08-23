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

Vaerlagene folger yr sitt uttrykk: en jevn, sammenhengende fargeflate paa yr
sin m/s-skala med hvite stromlinjer oppaa, og en staaende tegnforklaring med
tallmerker nede til venstre. I tillegg ligger symbolspraaket fra ekte bro- og
vaerkart over: meteorologiske vindfjaer (halv fjaer 5 kt, hel 10, vimpel 50)
med farten i m/s, stromspiler med fart i knop, og doenning som boelgekam med
retning og signifikant boelgehoyde. Bare ETT lag males som farget flate om
gangen (nedbor > temperatur > strom > vind) — resten vises som symboler, saa
kartet ikke drukner naar flere lag staar paa. Feltene bygges i lav opplosning
og slores for de skaleres opp, saa overgangene er myke i stedet for
firkantete, og partikkelsporene tegnes som kurver med fart maalt i piksler —
da er streken like lang uansett zoom.

ECDIS-dokken (Main kiosk- og Radar-knappene nede til venstre og havnesoket
oppe ved merkevare-pillen) er stylet med appens egne palettvariabler og
folger day/dusk/night automatisk. Havnesoket har innebygd norsk havneliste
(virker uten API-nokkel; ArcGIS-sok legges oppaa naar nokkel finnes) og et
eget touch-tastatur med AE/O/AA i samme glass-stil. Velg et treff for aa faa
et destinasjonskort med "Set route to destination": appens dybdetrygge
autoroute planlegger ruten og seilasen startes automatisk. Havner utenfor
demo-kartomraadet vises som "view only". Soket finner ogsaa **fartoy**: det
soker i de live AIS-maalene (navn eller MMSI) — samme sannhet som skopet
viser, ingen egen kilde — og fartoykortet folger maalet live (posisjon, fart,
kurs, destinasjon), kan sentrere kartet paa fartoyet og sette kurs mot det med
samme dybdetrygge autoroute ("Set route to vessel"; ruta gaar til fartoyets
posisjon i trykkoyeblikket, og forsvinner signalet viser kortet "AIS signal
lost" paa siste kjente posisjon). Er AIS-kilden nede, gir fartoysoket ingen
treff — et aerlig tomt svar, som resten av AIS-laget. Ruteplanleggingen
kjorer tidsskivet i bakgrunnen, saa kartet kan panoreres/zoomes og alle
knapper virker mens ruten beregnes. AIS-laget er **kun ekte trafikk**: det finnes ingen simulert
flaate og ingen varmstart fra en gammel cache. Er stroemmen nede eller tom,
staar skopet tomt og kildepanelet sier hvorfor — et tomt AIS-bilde er sant,
en oppdiktet flaate er det ikke.

Rutefinneren er bygget om for fart og sikkerhet: hver sjokartflis dekodes EN
gang til en bitpakket landmaske (8-16 KB i stedet for 256 KB raa piksler), saa
store korridorer ikke lenger kaster ut hverandres fliser midt i planleggingen;
A*-soeket bruker lukket sett og vektet heuristikk (hoyst en ekspansjon per
celle — foer kunne et soek brenne hele ekspansjonstaket paa aa gjenaapne noder
og "feile" en passasje som var aapen); klaringsnivaaer som blokkerer identisk
deler ett soek; og validering som strander paa ulastede fliser avbryter runden
i stedet for aa brenne hele kaskaden mot manglende data. Ruter over ~12 nm
planlegges i to trinn: en grov korridor finner skjelettet, deretter planlegges
hvert ~7 nm-segment paa fullt finmasket rutenett (~0,02 nm celler, samme
skjaergaardsopploesning som korte ruter — foer vokste cellene med avstanden og
smaa holmer kunne falle mellom dem) og soemmes sammen. Flis-preloaden gaar naa
som en prioritert stroem langs ruten i stedet for 400 samtidige kall, og den
autonome omrutingen underveis kjorer ogsaa tidsskivet (hoyst ett soek per
bilde) i stedet for aa fryse simulasjonen. Hver kandidatrute valideres fortsatt
kontinuerlig (hver 0,02 nm) mot selve kartrasteret foer den settes — en rute
kan aldri godkjennes paa data som ikke er lastet.

HT Radar er et fullverdig radarkonsoll (demo) med roterende sveip og
etterglod, datablokker i hjornene, peilering med kurs- og nordmerke,
TX/STBY, pulslengde SP/MP/LP, range 0,25-48 nm, ringer av/paa,
N-UP/H-UP/C-UP, RM/TM (med TM-reset), off-center, trails 30 s-6 min,
relative/sanne vektorer 3/6/12 min, cursoravlesning, EBL/VRM, ARPA-
maalfolging (ACQ TT) med CPA/TCPA, faremaal-alarm med grenser, guard zone,
maalliste, alarmliste med ACK, gain/sea/rain + AUTO, interferens-
undertrykking (IR), echo stretch, gronn/amber fosfor og landekko fra
kystlinjen. Paa brede skjermer (som kioskens 16:9) viser venstresiden i
tillegg en live datakolonne: neste veipunkt med BRG/DST/XTE/ETA/TTG, fart
gjennom vann (STW), svinghastighet (ROT), tripplogg og vind/strom/dybde med
UTC-klokke (sim). Radaren speiler ECDIS' seilas: ECDIS lagrer skip og rute
hvert 5. sekund (localStorage + `/api/ecdis-state`), og radaren adopterer
nyere snapshots (server-poll hvert 5. sekund + storage-hendelser) og dodregner
mellom dem — saa begge skjermene viser samme seilas ogsaa naar kiosken bytter
side eller de kjorer paa hver sin maskin. Er ECDIS aapen samtidig i samme
nettleser overtar direktesendingen (BroadcastChannel), og SRC-feltet viser
ECDIS LIVE / ECDIS SYNC / GYRO OK. AIS-maalene deles derimot **ikke** mellom
sidene: radaren henter dem selv fra `/ais/targets` med et utsnitt rundt eget
skip, samme ekte stroem som ECDIS bruker. Broen holder EN TCP-oppkobling og
deler den ut, saa begge sidene kan staa aapne samtidig — og radaren viser ekte
trafikk ogsaa naar ECDIS er lukket. AIS-feltet i datablokken viser
LIVE · N TGT, WAIT eller NO FEED.
Knapper kobler ECDIS <-> Radar <-> kiosk.
**DEMO — ikke for navigasjon.**

Hele appen er paa engelsk (kiosken staar paa internasjonal messe); README-ene
er paa norsk for drift.

ECDIS-kartet tilpasser normalt canvas-opploesningen etter GPU-en (svake
maskiner faar lavere opploesning for aa holde bildefrekvensen — det kan se
mykt ut paa en 4K-skjerm). Overstyr med URL-parameter: `&res=sharp` laaser
full opploesning OG henter kartfliser ett zoomniva hoyere (skarpe fliser og
AIS-navn paa 4K), `&res=low` laaser 1x for svake maskiner, `&res=auto` gaar
tilbake til adaptiv. Valget huskes per nettleser, saa kiosk-URL-en trenger
det bare een gang: `/ecdis/index.html?kiosk=1&res=sharp`.

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
admin-innstillinger og ECDIS-tilstand lagres i en database naar en slik er
koblet til — **Redis** (Upstash/Vercel KV) eller **Supabase**. Er begge satt,
brukes Redis. **Uten database fungerer alt, men data er midlertidige** (de
overlever bare saa lenge samme funksjonsinstans er varm) — greit for testing,
ikke for en ekte konkurranse.

Alternativ A — Upstash Redis (engangsjobb, ~2 minutter):

1. Aapne Vercel-prosjektet → **Storage**-fanen → **Create Database** →
   velg **Upstash for Redis** (gratis-niveaaet holder lenge).
2. Koble databasen til prosjektet. Vercel legger da inn miljovariablene
   (`KV_REST_API_URL`/`KV_REST_API_TOKEN` eller
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) automatisk.
3. Redeploy. `/status.html` (og `/api/admin/status`) viser om varig lagring
   er aktiv.

Alternativ B — Supabase (engangsjobb, ~3 minutter):

1. Kjor SQL-en i `supabase/migrations/20260818_htkiosk_storage.sql` een gang
   i Supabase-prosjektets **SQL Editor** (lager `htkiosk_kv` +
   `htkiosk_entries` med RLS paa, saa bare serveren naar dem).
2. Sett miljovariablene `SUPABASE_URL` (Project Settings → API → Project URL)
   og `SUPABASE_SERVICE_ROLE_KEY` (samme side, service_role-nokkelen) i
   Vercel → **Settings → Environment Variables**. Service-nokkelen er
   hemmelig og brukes bare server-side — aldri i klientkode.
3. Redeploy. `/status.html` skal vise `mode: supabase` og varig lagring.

Innsendte deltakere lagres atomisk (Redis-liste / Postgres-INSERT), saa to
samtidige innsendinger kan aldri overskrive hverandre. Ved nullstilling fra
admin tas det forst en sikkerhetskopi (de 10 siste ligger i databasen),
akkurat som de lokale `data/backups/`-kopiene gjorde.

## Miljovariabler (valgfritt)

| Variabel | Effekt |
| --- | --- |
| `ADMIN_PASSWORD` | Overstyrer adminpassordet fra `config/contest-config.json`. **Anbefales** — standardpassordet ligger i et offentlig repo. |
| `AISSTREAM_API_KEY` | Overstyrer `apiKeys.aisstream` (live AIS i ECDIS). |
| `AIS_KYSTVERKET_ENABLED` | `0` skrur Kystverket-kilden helt av (samme som `ais.enabled: false`). |
| `AIS_KYSTVERKET_HOST` / `AIS_KYSTVERKET_PORT` | Overstyrer Kystverkets stroem (standard `153.44.253.27:5631`). |
| `ARCGIS_API_KEY` | Overstyrer `apiKeys.arcgis` (flyfoto/Ocean-basemap + stedssok i ECDIS). |
| `SUPABASE_URL` | Supabase-prosjektets URL — varig lagring via Supabase (alternativ til Redis). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role-nokkel (hemmelig, kun server-side). |

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
- `ais`: AIS-kilde for HT ECDIS og HT Radar. Begge valgene i "Live
  sources"-panelet er EKTE AIS — det finnes ingen simulert flaate:

  | Kilde | Nokkel | Flere faner samtidig | Dekning |
  | --- | --- | --- | --- |
  | Kystverket | nei | ja | norskekysten, 40-60 nm ut |
  | aisstream.io | ja | **nei** (kun EN paa gratisnokkel) | global, men tynn i norske fjorder |

  `ais.source` styrer hva som velges ved oppstart: `auto` (standard) prover
  Kystverket forst og faller tilbake til aisstream hvis stroemmen ikke svarer
  innen noen sekunder. `kystverket` eller `aisstream` laaser valget.
  `ais.host`/`ais.port` peker paa Kystverkets aapne stroem
  (153.44.253.27:5631) og `ais.enabled: false` skrur kilden helt av.

  Kystverket kringkaster raa NMEA (AIVDM) over TCP, som en nettleser ikke kan
  snakke med. Serverless-funksjonen bor derfor oppkoblingen, dekoder
  meldingene og deler dem ut paa `/ais/targets` og `/ais/status` — det er
  grunnen til at ECDIS og radar kan staa aapne samtidig, i motsetning til
  aisstream. Dataene er gratis under NLOD; den aapne stroemmen utelater
  fiskefartoy under 15 m og fritidsbaater under 45 m.

  **Vercel-forskjellen mot den lokale kiosk-serveren:** en funksjon fryses
  mellom kall, saa TCP-stroemmen kan ikke pusses av et intervall i bakgrunnen.
  Vedlikeholdet kjorer derfor naar en klient faktisk spor, og forste kall etter
  en kaldstart venter i inntil 2,5 s paa at stroemmen leverer i stedet for aa
  svare tomt.
  Sockelen overlever mellom kall saa lenge instansen holdes varm, og klienten
  poller hvert 3. sekund, saa den gjor den normalt. Er kilden nede, svarer
  endepunktet umiddelbart i stedet for aa holde funksjonen opptatt.

  Klientene spor med et utsnitt (`bbox`) rundt eget skip, ikke hele kysten:
  broen kapper svaret paa de 900 ferskeste maalene, og med hele norskekysten i
  boksen kunne fartoy rett ved skipet bli kappet vekk.

  Merk at utgaaende TCP mot port 5631 maa vaere aapent fra Vercels
  kjoremiljo. Bruk "Test connection" i kildepanelet for aa sjekke det, eller
  `GET /ais/status` — `connected: true` og `targets > 0` betyr at broen har
  kontakt. Er den stengt, vises ingen AIS-maal i det hele tatt (ingen
  demoflaate tar over) — velg aisstream.io i kildepanelet i stedet.

- `apiKeys`: API-nokler for innebygde demoer. `apiKeys.aisstream` brukes av
  HT ECDIS naar aisstream er valgt som AIS-kilde.
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
GET  /api/health                     (lagringsmodus + oppetid, uten passord)
GET  /api/config
GET  /api/leaderboard?game=<id>
GET  /api/games
POST /api/standalone-entry
GET/POST /api/ecdis-state
GET  /ais/status                     (Kystverket-broens tilstand)
GET  /ais/targets?bbox=<lat,lon,lat,lon>[&atons=1]
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
