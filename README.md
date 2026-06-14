# Lupp

Lupp läser livsmedels- och kosmetikaetiketter via foto eller streckkod och
förklarar ingredienserna i lugnt, ärligt klarspråk — vad de är, vad de gör
(positivt och negativt, källbelagt), och vad som är värt att veta för just
användaren.

> Lupp är ett informationsverktyg, inte medicinsk rådgivning. Kontrollera
> alltid själva förpackningen, särskilt vid allergi — innehåll kan ändras och
> fel kan förekomma. Vid osäkerhet, rådfråga vården.

## Arkitekturen: ögon, minne, röst

Hela poängen med Lupp är att tre roller hålls strikt isär:

1. **Vision = ögon** (`/api/extract`). Claude vision läser etiketten och
   returnerar EXAKT vad som står som ren JSON — ingredienser i ordning,
   deklarerade allergener, näring per 100 g. Otydlig text blir `"oläsligt"`.
   Ingen tolkning, ingen förklaring.
2. **Faktabank = minne** (`data/faktabank.json` + `lib/faktabank.ts`).
   Granskade förklaringar med källor — enda sanningskällan. Uppslag sker via
   namn, synonymer och E-nummer. Ingrediens som saknas i banken visas som
   "ej granskad än" och loggas till granskningskön — aldrig en gissning.
3. **Modellen = röst** (`/api/explain`). Formulerar resultatet ENDAST utifrån
   bankens data, etikettens siffror och deterministiska observationer.
   Systemprompten förbjuder explicit egna fakta.

Två säkerhetsbeslut utöver spec, i samma anda:

- **Profilträffar (de röda varningarna) beräknas i kod, aldrig av modellen**
  (`lib/analys.ts`). En allergivarning får inte bero på hur en språkmodell
  råkar formulera sig.
- **Ingredienslistan i resultatet renderas rakt från banken** (förklaring,
  nyans, källa) utan att passera modellen. Modellen skriver bara den
  sammanbindande prosan (näring i sammanhang + sammanfattning).

## Resultatets fasta mall

1. **⚠ Säkerhet & allergi** — deklarerade allergener visas alltid, för alla.
   Profilträff lyfts i rött överst ("⚠ Innehåller mjölk, som du markerat").
   Detta är det enda stället rött används i appen.
2. **🔍 Vad produkten innehåller** — varje ingrediens i klarspråk från banken
   med källa, både positivt och negativt. Overifierade poster märks
   "preliminär — under granskning"; okända märks "ej granskad än".
3. **📊 Näring i sammanhang** — siffrorna förklarade (t.ex. "0 g socker, men
   produkten innehåller sötningsmedel").
4. **Sammanfattning** — lugn helhetsbild.

Formuleringsprincip: **produkten och sambandet, aldrig en dom över personen.**
Rätt: "Hög salthalt (1,8 g/100 g). Högt saltintag kopplas till högt blodtryck."
Fel: "Den här passar inte dig."

## Köra lokalt

```bash
npm install
cp .env.example .env.local   # fyll i din ANTHROPIC_API_KEY
npm run dev
```

Öppna http://localhost:3000 (eller porten Next väljer). Sidor:

- `/` — huvudflödet: foto **eller** EAN-streckkod → resultat.
- `/profil` — allergener och kostvillkor, sparas i localStorage.
- `/extrakt-test` — testsida som visar vision-extraktionens råa JSON.

Modell: `claude-haiku-4-5` via Anthropic API. Nyckeln läses ur `.env.local`
och hårdkodas aldrig.

### Testa på mobilen (samma WiFi)

`npm run dev` lyssnar även på datorns nätverksadress (visas som **Network:**
i terminalen, t.ex. `http://192.168.1.76:3000`). Öppna den adressen i
mobilens webbläsare — telefonen måste vara på samma WiFi.

> **Viktigt:** Next 16 blockerar dev-lägets interna resurser när sidan öppnas
> från en annan adress än `localhost`. Symptomet är att sidan *syns* på
> mobilen men inget händer när man laddar upp bild eller trycker på en knapp
> (React hydreras aldrig). Lös det genom att lista datorns LAN-adress i
> `allowedDevOrigins` i [`next.config.ts`](next.config.ts). Byter routern ut
> datorns IP får adressen uppdateras där. (Detta gäller bara `next dev` — en
> riktig deploy/`next start` har inte begränsningen.)

## Faktabanken: fylla på och verifiera

- Schema per post: `{ id, namn, synonymer[], typ, forklaring_klarsprak,
  nyans, allergen, kalla, kalla_url, verified }`.
- **Allt seed-innehåll har `verified: false` och `kalla_url: "TODO"`.**
  Verifiera varje post manuellt mot EFSA/Livsmedelsverket (kosmetika:
  SCCS/CIR), fyll i `kalla_url` och flippa `verified` till `true`. Tills dess
  visar appen "preliminär — under granskning".
- Okända ingredienser hamnar i `data/review-queue.json` med datum och
  räknare. Granska kön, skriv en post i `data/faktabank.json`, töm kön.
  Kön läggs **aldrig** automatiskt in i banken.
- Synonymlogik: "vassleprotein" → mjölk; "mjölksyra" → INTE mjölk
  (skillnaden förklaras i posten); E-nummer ↔ namn; funktionsprefix som
  "konserveringsmedel (E250)" slås upp på E-numret.

## Datafiler som behöver manuell verifiering

| Fil | Status |
|---|---|
| `data/faktabank.json` | Alla ~40 poster `verified: false`, källänkar TODO |
| `data/allergener-kosmetika.json` | Märkt "BEHÖVER VERIFIERING" — komplettera mot (EU) 2023/1545; antalet är medvetet inte hårdkodat |
| `data/naringsgranser.json` | Referensgränser (FSA-trafikljus) — verifiera mot Livsmedelsverket |
| `data/allergener-mat.json` | EU:s 14 enligt 1169/2011 — kontrollera nyckelord och OFF-taggar |

## Beslut som togs under bygget

- **Röd varningsfärg** (`#9c3325`, dämpad tegelröd) ligger utanför
  grundpaletten eftersom specen kräver röd profilträff men paletten saknar
  röd. Den används ingen annanstans.
- **Streckkod**: manuell EAN-inmatning (kameraskanning var stretch och
  utelämnades medvetet). Uppslag mot Open Food Facts sker serverside med
  User-Agent och timeout; OFF:s allergentaggar mappas datadrivet via
  `off_tag` i `data/allergener-mat.json`.
- **Näringsobservationer** ("hög salthalt") beräknas deterministiskt mot
  gränsvärdena i `data/naringsgranser.json` — modellen hittar aldrig på
  egna gränser.
- **Bilder skalas ner klientside** till max 1568 px och skickas som JPEG —
  snabbare svar, ingen kvalitetsförlust för vision.
- Granskningskön skrivs med `fs` till repots `data/`-katalog — fungerar
  lokalt (MVP körs lokalt). På serverless-hosting (t.ex. Vercel) krävs
  annan lagring; se Hinder.

## Hinder och kända begränsningar

- **Faktabanken är ogranskad**: inga poster är verifierade ännu — det är
  nästa manuella steg (se ovan).
- **Granskningskön på serverless**: filskrivning till `data/` fungerar inte
  på skrivskyddade/efemära filsystem. Byt till KV-lagring eller databas vid
  deploy.
- **Vision läser bara det som syns**: suddiga foton ger `"oläsligt"` — appen
  gissar aldrig, men resultatet blir då tunnare.
- **Open Food Facts är crowdsourcat**: data kan vara ofullständig eller fel;
  ingredienstexten är ibland på annat språk än svenska. Etikettfoto är
  alltid facit.
- **Kosmetikaflödet** delar pipeline med livsmedel; INCI-täckningen i banken
  är än så länge tunn (tensider + doftämnen).

## Vad som återstår (utanför MVP)

- Verifiera faktabanksposter och flippa `verified`.
- Komplettera doftämneslistan mot (EU) 2023/1545.
- Kameraskanning av streckkod (`@zxing/library`).
- Fler bankposter utifrån granskningskön när riktiga etiketter testats.
