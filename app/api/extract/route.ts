import Anthropic from "@anthropic-ai/sdk";
import type { Extraktion } from "@/lib/types";

/**
 * Vision = ögon. Den här routen läser etiketten och returnerar EXAKT vad
 * som står — ingen tolkning, ingen förklaring. All kunskap kommer senare
 * från faktabanken.
 */

const EXTRAKTIONSPROMPT = `Du läser ett foto av en produktetikett (livsmedel eller kosmetika).
Din enda uppgift är EXTRAKTION — skriv av vad som står. Du får inte tolka,
förklara, bedöma eller lägga till någonting som inte står på etiketten.

Returnera ENDAST giltig JSON enligt exakt detta schema, utan markdown och
utan kommentarer:

{
  "ingredienser": ["varje ingrediens exakt som den står, i samma ordning"],
  "allergener_deklarerade": ["endast allergener som etiketten själv framhäver, t.ex. i fetstil, VERSALER eller efter 'Innehåller'/'Kan innehålla spår av'"],
  "naring_per_100g": {
    "energi_kcal": null,
    "fett_g": null,
    "mattat_fett_g": null,
    "kolhydrat_g": null,
    "socker_g": null,
    "protein_g": null,
    "salt_g": null
  }
}

Regler:
- Ingredienser skrivs EXAKT som på etiketten, inklusive parenteser och E-nummer.
- Text som är otydlig eller oläslig ersätts med strängen "oläsligt".
- Näringsvärden anges som tal (per 100 g). Saknas ett värde: null.
- Saknas näringstabell helt: alla värden null.
- Om bilden inte alls visar en etikett med ingredienser: returnera tomma
  listor och alla näringsvärden null.`;

/** Plockar ut första JSON-objektet ur modellens svar, även om det omges av text. */
function parseJsonSvar(text: string): Extraktion {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Modellen returnerade ingen JSON.");
  }
  return JSON.parse(text.slice(start, end + 1)) as Extraktion;
}

const TILLATNA_MEDIATYPER = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { fel: "ANTHROPIC_API_KEY saknas i .env.local." },
      { status: 500 }
    );
  }

  let body: { bild_base64?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ fel: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { bild_base64, media_type } = body;
  if (!bild_base64 || !media_type) {
    return Response.json(
      { fel: "bild_base64 och media_type krävs." },
      { status: 400 }
    );
  }
  if (!TILLATNA_MEDIATYPER.includes(media_type as never)) {
    return Response.json(
      { fel: `Otillåten media_type: ${media_type}` },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    const svar = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: media_type as (typeof TILLATNA_MEDIATYPER)[number],
                data: bild_base64,
              },
            },
            { type: "text", text: EXTRAKTIONSPROMPT },
          ],
        },
      ],
    });

    const text = svar.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    const extraktion = parseJsonSvar(text);
    return Response.json(extraktion);
  } catch (e) {
    const meddelande = e instanceof Error ? e.message : "Okänt fel.";
    return Response.json(
      { fel: `Extraktionen misslyckades: ${meddelande}` },
      { status: 502 }
    );
  }
}
