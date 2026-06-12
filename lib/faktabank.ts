import bank from "@/data/faktabank.json";
import type { FaktabankPost, Uppslag } from "@/lib/types";

/**
 * Faktabanken = minne. Den här modulen slår upp ingredienser som de står
 * på etiketten mot bankens poster via namn, synonymer och E-nummer.
 * Ingen gissning: hittas inget blir posten null ("ej granskad än").
 */

const poster = (bank as { poster: FaktabankPost[] }).poster;

/**
 * Normalisera etikettext: gemener, ta bort procent, asterisker, extra
 * mellanslag, och vik diakriter (å/ä→a, ö→o) — etiketter och OCR skriver
 * ibland svenska ord utan prickar ("VETEMJOL").
 */
function normalisera(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d+([.,]\d+)?\s*%/g, "")
    .replace(/[*†]/g, "")
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/\s+/g, " ")
    .trim();
}

/** Funktionsbeteckningar som ofta står före själva ämnet på etiketten. */
const FUNKTIONSPREFIX = [
  "konserveringsmedel",
  "antioxidationsmedel",
  "surhetsreglerande medel",
  "sötningsmedel",
  "smakförstärkare",
  "förtjockningsmedel",
  "geleringsmedel",
  "stabiliseringsmedel",
  "emulgeringsmedel",
  "fuktighetsbevarande medel",
  "bakpulver",
  "färgämne",
  "arom",
];

/** Index: normaliserat namn/synonym → post. Byggs en gång vid laddning. */
const index = new Map<string, FaktabankPost>();
for (const post of poster) {
  index.set(normalisera(post.namn), post);
  // Namn utan parentes, t.ex. "Natriumnitrit (E250)" → "natriumnitrit"
  const utanParentes = normalisera(post.namn.replace(/\(.*?\)/g, ""));
  if (utanParentes && !index.has(utanParentes)) index.set(utanParentes, post);
  for (const synonym of post.synonymer) {
    const nyckel = normalisera(synonym);
    if (!index.has(nyckel)) index.set(nyckel, post);
  }
}

/** E-nummer i en text, t.ex. "konserveringsmedel (E250)" → "e250". */
function hittaEnummer(text: string): string[] {
  const traffar = text.match(/\be\s?-?\s?(\d{3,4}[a-z]?)\b/gi) ?? [];
  return traffar.map((t) => "e" + t.replace(/[^0-9a-z]/gi, "").slice(1).toLowerCase());
}

/** Slå upp en ingrediens som den står på etiketten. Returnerar post eller null. */
export function slaUpp(ingrediens: string): FaktabankPost | null {
  const norm = normalisera(ingrediens);
  if (!norm || norm === "olasligt") return null;

  // 1. Direkt träff på namn/synonym
  const direkt = index.get(norm);
  if (direkt) return direkt;

  // 2. E-nummer någonstans i texten ("konserveringsmedel (E250)")
  for (const enr of hittaEnummer(norm)) {
    const post = index.get(enr);
    if (post) return post;
  }

  // 3. Innehåll i parentes ("surhetsreglerande medel (citronsyra)")
  const parentes = norm.match(/\((.*?)\)/);
  if (parentes) {
    const inre = index.get(parentes[1].trim());
    if (inre) return inre;
  }

  // 4. Utan parentes och utan funktionsprefix
  let rensad = norm.replace(/\(.*?\)/g, "").trim();
  for (const prefix of FUNKTIONSPREFIX) {
    if (rensad.startsWith(prefix)) {
      rensad = rensad.slice(prefix.length).replace(/^[:\s-]+/, "").trim();
      break;
    }
  }
  if (rensad && rensad !== norm) {
    const post = index.get(rensad);
    if (post) return post;
  }

  return null;
}

/** Slå upp en hel ingredienslista. Okända poster får post: null. */
export function slaUppAlla(ingredienser: string[]): Uppslag[] {
  return ingredienser.map((ingrediens) => ({
    ingrediens_pa_etiketten: ingrediens,
    post: slaUpp(ingrediens),
  }));
}
