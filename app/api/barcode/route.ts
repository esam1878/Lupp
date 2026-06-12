import allergenerMat from "@/data/allergener-mat.json";
import type { Extraktion } from "@/lib/types";

/**
 * Streckkodsuppslag mot Open Food Facts (öppet API, ingen nyckel).
 * Vid träff med ingredienslista byggs en Extraktion så att vision-steget
 * kan hoppas över; resten av flödet (bank, profil, röst) är identiskt.
 */

const matAllergener = (
  allergenerMat as { allergener: { id: string; namn: string; off_tag?: string }[] }
).allergener;

interface OffProdukt {
  product_name?: string;
  ingredients_text_sv?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  nutriments?: Record<string, number | string>;
}

/** Dela ingredienstext på kommatecken/semikolon utanför parenteser. */
function delaIngredienser(text: string): string[] {
  const delar: string[] = [];
  let djup = 0;
  let aktuell = "";
  for (const tecken of text) {
    if (tecken === "(" || tecken === "[") djup++;
    if (tecken === ")" || tecken === "]") djup--;
    if ((tecken === "," || tecken === ";") && djup <= 0) {
      delar.push(aktuell);
      aktuell = "";
      continue;
    }
    aktuell += tecken;
  }
  delar.push(aktuell);
  return delar
    .map((d) => d.replace(/^ingrediens(er)?\s*:/i, "").replace(/\.$/, "").trim())
    .filter(Boolean);
}

function tal(n: Record<string, number | string>, nyckel: string): number | null {
  const v = n[nyckel];
  return typeof v === "number" ? v : null;
}

export async function GET(req: Request) {
  const ean = new URL(req.url).searchParams.get("ean")?.replace(/\D/g, "");
  if (!ean || ean.length < 8 || ean.length > 14) {
    return Response.json({ fel: "Ange en giltig EAN-kod (8–14 siffror)." }, { status: 400 });
  }

  let data: { status?: number; product?: OffProdukt };
  try {
    const svar = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,ingredients_text_sv,ingredients_text,allergens_tags,nutriments`,
      {
        headers: { "User-Agent": "Lupp-MVP/0.1 (https://github.com/esam1878/Lupp)" },
        signal: AbortSignal.timeout(10000),
      }
    );
    data = await svar.json();
  } catch {
    return Response.json(
      { traff: false, orsak: "Open Food Facts gick inte att nå just nu." },
      { status: 200 }
    );
  }

  const produkt = data.product;
  const ingrediensText =
    produkt?.ingredients_text_sv || produkt?.ingredients_text || "";
  if (!produkt || !ingrediensText.trim()) {
    return Response.json({
      traff: false,
      orsak: "Produkten hittades inte i Open Food Facts, eller saknar ingredienslista. Fota etiketten i stället.",
    });
  }

  const taggar = new Set(produkt.allergens_tags ?? []);
  const allergenerDeklarerade = matAllergener
    .filter((a) => a.off_tag && taggar.has(a.off_tag))
    .map((a) => a.namn);

  const n = produkt.nutriments ?? {};
  const extraktion: Extraktion = {
    ingredienser: delaIngredienser(ingrediensText),
    allergener_deklarerade: allergenerDeklarerade,
    naring_per_100g: {
      energi_kcal: tal(n, "energy-kcal_100g"),
      fett_g: tal(n, "fat_100g"),
      mattat_fett_g: tal(n, "saturated-fat_100g"),
      kolhydrat_g: tal(n, "carbohydrates_100g"),
      socker_g: tal(n, "sugars_100g"),
      protein_g: tal(n, "proteins_100g"),
      salt_g: tal(n, "salt_100g"),
    },
  };

  return Response.json({
    traff: true,
    produktnamn: produkt.product_name ?? null,
    extraktion,
  });
}
