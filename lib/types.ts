/** Delade typer för Lupp. */

/** Näringsvärden per 100 g. null = saknas/oläsligt på etiketten. */
export interface NaringPer100g {
  energi_kcal: number | null;
  fett_g: number | null;
  mattat_fett_g: number | null;
  kolhydrat_g: number | null;
  socker_g: number | null;
  protein_g: number | null;
  salt_g: number | null;
}

/** Resultatet av vision-extraktionen – exakt vad som står på etiketten. */
export interface Extraktion {
  ingredienser: string[];
  allergener_deklarerade: string[];
  naring_per_100g: NaringPer100g;
}

/** En post i faktabanken – enda sanningskällan för förklaringar. */
export interface FaktabankPost {
  id: string;
  namn: string;
  synonymer: string[];
  typ: string;
  forklaring_klarsprak: string;
  /** Nyans: både det positiva och det negativa, balanserat. */
  nyans: string;
  /** EU-allergen (en av de 14) eller doftämnesallergen, annars null. */
  allergen: string | null;
  kalla: string;
  kalla_url: string;
  verified: boolean;
}

/** Användarprofil – sparas endast i localStorage. */
export interface Profil {
  allergener: string[];
  kostvillkor: string[];
}

/** En uppslagen ingrediens: antingen en bankpost eller "ej granskad än". */
export interface Uppslag {
  ingrediens_pa_etiketten: string;
  post: FaktabankPost | null;
}
