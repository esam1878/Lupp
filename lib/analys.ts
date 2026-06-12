import allergenerMat from "@/data/allergener-mat.json";
import allergenerKosmetika from "@/data/allergener-kosmetika.json";
import kostvillkorData from "@/data/kostvillkor.json";
import naringsgranser from "@/data/naringsgranser.json";
import type { Extraktion, Profil, Uppslag } from "@/lib/types";

/**
 * Deterministisk analys: profilträffar och näringsobservationer beräknas
 * här i kod, aldrig av modellen. Röda varningar får inte bero på en
 * språkmodells formuleringar.
 */

export interface Profiltraff {
  allergen: string;
  /** Vad på etiketten som utlöste träffen. */
  utlost_av: string;
}

export interface Analys {
  profiltraffar: Profiltraff[];
  /** Faktaobservationer om näringen, t.ex. "Hög salthalt (1,8 g/100 g)". */
  observationer: string[];
  /** Generella samband från kostvillkor i profilen. */
  kostvillkor_samband: string[];
}

interface MatAllergen {
  id: string;
  namn: string;
  nyckelord: string[];
}

const matAllergener = (allergenerMat as { allergener: MatAllergen[] })
  .allergener;
const kosmetikaAllergener = (
  allergenerKosmetika as { allergener: { id: string; namn: string }[] }
).allergener;
const kostvillkor = (
  kostvillkorData as {
    villkor: {
      id: string;
      namn: string;
      relevanta_naringsamnen: string[];
      samband: string;
    }[];
  }
).villkor;
const granser = (
  naringsgranser as {
    granser_per_100g: Record<string, { hog: number; lag: number }>;
  }
).granser_per_100g;

/**
 * Normalisering med diakritvikning (å/ä→a, ö→o): etiketter och OCR skriver
 * ibland svenska ord utan prickar ("MJOLK"), och en allergimatchning får
 * inte missa på grund av det.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o");
}

/** Matcha extraktion + uppslag mot profilens allergener. */
export function hittaProfiltraffar(
  extraktion: Extraktion,
  uppslag: Uppslag[],
  profil: Profil
): Profiltraff[] {
  // Obs: både profilens id:n och allt som jämförs mot dem går genom norm().
  const valda = new Set(profil.allergener.map(norm));
  if (valda.size === 0) return [];

  const traffar = new Map<string, Profiltraff>();

  // 1. Bankposter med allergenmarkering (t.ex. vassle → mjölk)
  for (const u of uppslag) {
    if (!u.post?.allergen) continue;
    const allergenId = norm(u.post.allergen);
    // Matallergen: posten pekar på en av de 14. Doftämne: matcha på postens id.
    if (valda.has(allergenId)) {
      traffar.set(allergenId, {
        allergen: allergenId,
        utlost_av: u.ingrediens_pa_etiketten,
      });
    }
    if (allergenId === norm("doftämne") && valda.has(norm(u.post.id))) {
      traffar.set(norm(u.post.id), {
        allergen: norm(u.post.id),
        utlost_av: u.ingrediens_pa_etiketten,
      });
    }
  }

  // 2. Etikettens egna deklarerade allergener, matchade via nyckelord
  for (const deklarerad of extraktion.allergener_deklarerade) {
    const d = norm(deklarerad);
    for (const a of matAllergener) {
      const id = norm(a.id);
      if (!valda.has(id)) continue;
      if (a.nyckelord.some((n) => d.includes(norm(n)))) {
        if (!traffar.has(id)) {
          traffar.set(id, { allergen: id, utlost_av: deklarerad });
        }
      }
    }
  }

  return [...traffar.values()];
}

/** Visningsnamn för ett allergen-id (mat eller doftämne). */
export function allergenNamn(id: string): string {
  const mat = matAllergener.find((a) => norm(a.id) === norm(id));
  if (mat) return mat.namn;
  const kosmetika = kosmetikaAllergener.find((a) => norm(a.id) === norm(id));
  if (kosmetika) return kosmetika.namn;
  return id;
}

/** Deterministiska näringsobservationer utifrån data/naringsgranser.json. */
export function naringsobservationer(
  extraktion: Extraktion,
  uppslag: Uppslag[]
): string[] {
  const obs: string[] = [];
  const n = extraktion.naring_per_100g;
  const etiketter: Record<string, string> = {
    fett_g: "fetthalt",
    mattat_fett_g: "halt av mättat fett",
    socker_g: "sockerhalt",
    salt_g: "salthalt",
  };

  for (const [falt, grans] of Object.entries(granser)) {
    const varde = n[falt as keyof typeof n];
    if (varde === null || varde === undefined) continue;
    const namn = etiketter[falt] ?? falt;
    const vardeStr = String(varde).replace(".", ",");
    if (varde >= grans.hog) {
      obs.push(`Hög ${namn} (${vardeStr} g/100 g).`);
    } else if (varde <= grans.lag) {
      obs.push(`Låg ${namn} (${vardeStr} g/100 g).`);
    }
  }

  // Sockerfritt men sötat: 0 g socker + intensivt sötningsmedel i listan.
  const harSotningsmedel = uppslag.some((u) =>
    u.post?.typ.includes("sötningsmedel (intensivt)")
  );
  if (n.socker_g === 0 && harSotningsmedel) {
    obs.push(
      "0 g socker, men produkten innehåller sötningsmedel – sockret är utbytt, inte borttaget utan ersättning."
    );
  }

  return obs;
}

/** Generella samband för kostvillkor i profilen (aldrig en dom). */
export function kostvillkorSamband(profil: Profil): string[] {
  return kostvillkor
    .filter((v) => profil.kostvillkor.includes(v.id))
    .map((v) => v.samband);
}

export function analysera(
  extraktion: Extraktion,
  uppslag: Uppslag[],
  profil: Profil
): Analys {
  return {
    profiltraffar: hittaProfiltraffar(extraktion, uppslag, profil),
    observationer: naringsobservationer(extraktion, uppslag),
    kostvillkor_samband: kostvillkorSamband(profil),
  };
}
