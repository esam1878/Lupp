"use client";

import { useState } from "react";
import { bildTillBase64 } from "@/lib/bild";

/** Testsida: ladda upp en etikettbild och se extraktionens råa JSON. */
export default function ExtraktTest() {
  const [laddar, setLaddar] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  async function hantera(fil: File) {
    setLaddar(true);
    setResultat(null);
    try {
      const { base64, mediaType } = await bildTillBase64(fil);
      const svar = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bild_base64: base64, media_type: mediaType }),
      });
      const data = await svar.json();
      setResultat(JSON.stringify(data, null, 2));
    } catch (e) {
      setResultat(`Fel: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaddar(false);
    }
  }

  return (
    <section>
      <h1>Extraktionstest</h1>
      <p className="diskret" style={{ margin: "0.5rem 0 1rem" }}>
        Ladda upp ett etikettfoto och se den råa JSON som vision-steget
        returnerar. Enbart extraktion — ingen tolkning.
      </p>
      <div className="card">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const fil = e.target.files?.[0];
            if (fil) hantera(fil);
          }}
        />
      </div>
      {laddar && <p>Läser etiketten …</p>}
      {resultat && (
        <pre
          className="card card-sand"
          style={{ overflowX: "auto", fontSize: "0.82rem" }}
        >
          {resultat}
        </pre>
      )}
    </section>
  );
}
