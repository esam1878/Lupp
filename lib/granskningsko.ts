import { promises as fs } from "fs";
import path from "path";

/**
 * Granskningskö: okända ingredienser loggas hit så att banken kan fyllas
 * på manuellt. De läggs ALDRIG automatiskt in i faktabanken.
 */

const KO_FIL = path.join(process.cwd(), "data", "review-queue.json");

interface KoPost {
  ingrediens: string;
  forsta_gang: string;
  antal: number;
}

interface KoFil {
  _kommentar: string;
  ko: KoPost[];
}

export async function loggaOkanda(ingredienser: string[]): Promise<void> {
  if (ingredienser.length === 0) return;
  try {
    const innehall = JSON.parse(await fs.readFile(KO_FIL, "utf8")) as KoFil;
    const nu = new Date().toISOString();
    for (const ingrediens of ingredienser) {
      const nyckel = ingrediens.toLowerCase().trim();
      if (!nyckel || nyckel === "oläsligt") continue;
      const befintlig = innehall.ko.find(
        (p) => p.ingrediens.toLowerCase() === nyckel
      );
      if (befintlig) {
        befintlig.antal += 1;
      } else {
        innehall.ko.push({ ingrediens, forsta_gang: nu, antal: 1 });
      }
    }
    await fs.writeFile(KO_FIL, JSON.stringify(innehall, null, 2) + "\n");
  } catch (e) {
    // Loggning får aldrig fälla själva förklaringsflödet.
    console.error("Kunde inte uppdatera granskningskön:", e);
  }
}
