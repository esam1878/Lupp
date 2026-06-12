import Anthropic from "@anthropic-ai/sdk";
import { slaUppAlla } from "@/lib/faktabank";
import { analysera, allergenNamn } from "@/lib/analys";
import { loggaOkanda } from "@/lib/granskningsko";
import type { Extraktion, Profil, Uppslag } from "@/lib/types";

/**
 * Modellen = röst. Den formulerar resultatet ENDAST utifrån bankens data
 * och de deterministiska observationerna. Profilträffar och uppslag
 * beräknas i kod (lib/analys.ts, lib/faktabank.ts) – aldrig av modellen.
 */

export interface ExplainSvar {
  sakerhet: {
    deklarerade: string[];
    /** Färdiga varningstexter för profilträffar – byggda i kod, inte av modellen. */
    profiltraffar: string[];
  };
  /** Ingrediensuppslag rakt från banken – renderas av UI:t med källa. */
  innehall: Uppslag[];
  /** Modellens prosa, strikt från underlaget. */
  naring_text: string;
  sammanfattning: string;
  /** Ingredienser utan bankpost – loggade till granskningskön. */
  okanda: string[];
}

function byggUnderlag(
  extraktion: Extraktion,
  uppslag: Uppslag[],
  observationer: string[],
  kostvillkorSamband: string[],
  profiltraffNamn: string[]
): string {
  const kanda = uppslag.filter((u) => u.post);
  const okanda = uppslag.filter((u) => !u.post);

  const delar: string[] = [];

  delar.push("## Ingredienser med faktabanksdata");
  if (kanda.length === 0) delar.push("(inga)");
  for (const u of kanda) {
    const p = u.post!;
    delar.push(
      `- ${u.ingrediens_pa_etiketten} → ${p.namn} [${p.typ}]: ${p.forklaring_klarsprak} Nyans: ${p.nyans}`
    );
  }

  delar.push("\n## Ingredienser som saknas i faktabanken (ej granskade än)");
  delar.push(
    okanda.length === 0
      ? "(inga)"
      : okanda.map((u) => `- ${u.ingrediens_pa_etiketten}`).join("\n")
  );

  delar.push("\n## Deklarerade allergener på etiketten");
  delar.push(
    extraktion.allergener_deklarerade.length === 0
      ? "(inga)"
      : extraktion.allergener_deklarerade.map((a) => `- ${a}`).join("\n")
  );

  if (profiltraffNamn.length > 0) {
    delar.push("\n## Träffar mot användarens profil (redan varnade i rött)");
    delar.push(profiltraffNamn.map((n) => `- ${n}`).join("\n"));
  }

  delar.push("\n## Näring per 100 g (från etiketten)");
  delar.push(JSON.stringify(extraktion.naring_per_100g));

  delar.push("\n## Deterministiska näringsobservationer");
  delar.push(
    observationer.length === 0
      ? "(inga)"
      : observationer.map((o) => `- ${o}`).join("\n")
  );

  if (kostvillkorSamband.length > 0) {
    delar.push("\n## Generella samband för användarens kostvillkor");
    delar.push(kostvillkorSamband.map((s) => `- ${s}`).join("\n"));
  }

  return delar.join("\n");
}

const SYSTEMPROMPT = `Du är rösten i Lupp, ett verktyg som förklarar innehållet i livsmedel
och kosmetika i lugnt, ärligt klarspråk på svenska.

ABSOLUTA REGLER:
- Använd ENDAST informationen i underlaget nedan. Lägg ALDRIG till egna fakta,
  siffror, hälsopåståenden eller kunskap du har sedan tidigare.
- Ingredienser som saknas i faktabanken beskrivs som "ej granskad än" – gissa
  aldrig vad de är eller gör.
- Tala om produkten och sambanden, aldrig en dom över personen.
  Rätt: "Hög salthalt (1,8 g/100 g). Högt saltintag kopplas till högt blodtryck."
  Fel: "Den här passar inte dig."
- Lugn, balanserad, vuxen ton. Inga utrop, ingen skrämsel, ingen säljton.

Svara med ENDAST giltig JSON enligt:
{
  "naring_text": "2–4 meningar som sätter näringsvärdena i sammanhang utifrån observationerna. Finns inga näringsvärden: säg det kort.",
  "sammanfattning": "2–4 meningar lugn helhetsbild av produkten utifrån underlaget, inklusive hur många ingredienser som är granskade respektive ej granskade än."
}`;

function parseJson(text: string): { naring_text: string; sammanfattning: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Ingen JSON i modellsvaret.");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { fel: "ANTHROPIC_API_KEY saknas i .env.local." },
      { status: 500 }
    );
  }

  let body: { extraktion?: Extraktion; profil?: Profil };
  try {
    body = await req.json();
  } catch {
    return Response.json({ fel: "Ogiltig förfrågan." }, { status: 400 });
  }

  const extraktion = body.extraktion;
  if (!extraktion || !Array.isArray(extraktion.ingredienser)) {
    return Response.json({ fel: "extraktion krävs." }, { status: 400 });
  }
  const profil: Profil = {
    allergener: body.profil?.allergener ?? [],
    kostvillkor: body.profil?.kostvillkor ?? [],
  };

  // 1. Uppslag i faktabanken (minne)
  const uppslag = slaUppAlla(extraktion.ingredienser);
  const okanda = uppslag
    .filter((u) => !u.post)
    .map((u) => u.ingrediens_pa_etiketten);

  // 2. Okända loggas till granskningskön – aldrig till banken
  await loggaOkanda(okanda);

  // 3. Deterministisk analys (profilträffar, observationer)
  const analys = analysera(extraktion, uppslag, profil);
  const profiltraffTexter = analys.profiltraffar.map(
    (t) =>
      `⚠ Innehåller ${allergenNamn(t.allergen).toLowerCase()}, som du markerat (${t.utlost_av}).`
  );

  // 4. Modellen formulerar prosa – strikt från underlaget
  const underlag = byggUnderlag(
    extraktion,
    uppslag,
    analys.observationer,
    analys.kostvillkor_samband,
    profiltraffTexter
  );

  const client = new Anthropic();
  let prosa: { naring_text: string; sammanfattning: string };
  try {
    const svar = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: SYSTEMPROMPT,
      messages: [{ role: "user", content: underlag }],
    });
    const text = svar.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    prosa = parseJson(text);
  } catch (e) {
    const meddelande = e instanceof Error ? e.message : "Okänt fel.";
    return Response.json(
      { fel: `Förklaringen misslyckades: ${meddelande}` },
      { status: 502 }
    );
  }

  const resultat: ExplainSvar = {
    sakerhet: {
      deklarerade: extraktion.allergener_deklarerade,
      profiltraffar: profiltraffTexter,
    },
    innehall: uppslag,
    naring_text: prosa.naring_text,
    sammanfattning: prosa.sammanfattning,
    okanda,
  };

  return Response.json(resultat);
}
