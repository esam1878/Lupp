import type { Profil } from "@/lib/types";

/** Profilen sparas endast i localStorage – inga konton i MVP. */

const NYCKEL = "lupp-profil";

export const TOM_PROFIL: Profil = { allergener: [], kostvillkor: [] };

export function lasProfil(): Profil {
  if (typeof window === "undefined") return TOM_PROFIL;
  try {
    const raa = window.localStorage.getItem(NYCKEL);
    if (!raa) return TOM_PROFIL;
    const data = JSON.parse(raa) as Partial<Profil>;
    return {
      allergener: Array.isArray(data.allergener) ? data.allergener : [],
      kostvillkor: Array.isArray(data.kostvillkor) ? data.kostvillkor : [],
    };
  } catch {
    return TOM_PROFIL;
  }
}

export function sparaProfil(profil: Profil): void {
  window.localStorage.setItem(NYCKEL, JSON.stringify(profil));
}
