"use client";

import { useState } from "react";
import { bildTillBase64 } from "@/lib/bild";
import { lasProfil } from "@/lib/profil";
import type { Extraktion } from "@/lib/types";
import Resultat, { type ExplainSvar } from "@/components/Resultat";

type Status =
  | { steg: "start" }
  | { steg: "extraherar" }
  | { steg: "forklarar" }
  | { steg: "klar"; svar: ExplainSvar }
  | { steg: "fel"; meddelande: string };

export default function Home() {
  const [status, setStatus] = useState<Status>({ steg: "start" });

  async function forklara(extraktion: Extraktion) {
    setStatus({ steg: "forklarar" });
    const svar = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraktion, profil: lasProfil() }),
    });
    const data = await svar.json();
    if (!svar.ok) throw new Error(data.fel ?? "Förklaringen misslyckades.");
    setStatus({ steg: "klar", svar: data as ExplainSvar });
  }

  async function hanteraFoto(fil: File) {
    try {
      setStatus({ steg: "extraherar" });
      const { base64, mediaType } = await bildTillBase64(fil);
      const svar = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bild_base64: base64, media_type: mediaType }),
      });
      const data = await svar.json();
      if (!svar.ok) throw new Error(data.fel ?? "Extraktionen misslyckades.");
      await forklara(data as Extraktion);
    } catch (e) {
      setStatus({
        steg: "fel",
        meddelande: e instanceof Error ? e.message : "Något gick fel.",
      });
    }
  }

  if (status.steg === "klar") {
    return (
      <section>
        <button
          className="btn btn-sekundar"
          onClick={() => setStatus({ steg: "start" })}
        >
          ← Skanna en ny produkt
        </button>
        <Resultat svar={status.svar} />
      </section>
    );
  }

  return (
    <section>
      <h1>Vad innehåller den egentligen?</h1>
      <p className="diskret" style={{ margin: "0.5rem 0 1.25rem" }}>
        Fota etikettens ingredienslista så förklarar Lupp innehållet i lugnt
        klarspråk — utifrån en granskad faktabank, aldrig gissningar.
      </p>

      <div className="card">
        <h2 style={{ fontSize: "1.05rem" }}>📷 Fota eller ladda upp etiketten</h2>
        <p className="diskret" style={{ margin: "0.35rem 0 0.75rem" }}>
          Ta ett tydligt foto av ingredienslistan och näringstabellen.
        </p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={status.steg === "extraherar" || status.steg === "forklarar"}
          onChange={(e) => {
            const fil = e.target.files?.[0];
            if (fil) hanteraFoto(fil);
            e.target.value = "";
          }}
        />
      </div>

      {status.steg === "extraherar" && (
        <p className="card card-sand">Läser etiketten …</p>
      )}
      {status.steg === "forklarar" && (
        <p className="card card-sand">
          Slår upp ingredienserna i faktabanken och formulerar resultatet …
        </p>
      )}
      {status.steg === "fel" && (
        <div className="card">
          <p style={{ fontWeight: 600 }}>Det gick inte den här gången.</p>
          <p className="diskret" style={{ margin: "0.35rem 0 0.75rem" }}>
            {status.meddelande}
          </p>
          <button className="btn" onClick={() => setStatus({ steg: "start" })}>
            Försök igen
          </button>
        </div>
      )}
    </section>
  );
}
