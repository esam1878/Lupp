"use client";

import { useEffect, useState } from "react";
import allergenerMat from "@/data/allergener-mat.json";
import allergenerKosmetika from "@/data/allergener-kosmetika.json";
import kostvillkorData from "@/data/kostvillkor.json";
import { lasProfil, sparaProfil, TOM_PROFIL } from "@/lib/profil";
import type { Profil } from "@/lib/types";

const mat = (
  allergenerMat as {
    allergener: { id: string; namn: string; beskrivning: string }[];
  }
).allergener;
const kosmetika = (
  allergenerKosmetika as {
    allergener: { id: string; namn: string; beskrivning: string }[];
  }
).allergener;
const villkor = (
  kostvillkorData as {
    villkor: { id: string; namn: string; samband: string }[];
  }
).villkor;

function Kryssruta({
  vald,
  namn,
  beskrivning,
  onToggle,
}: {
  vald: boolean;
  namn: string;
  beskrivning: string;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: "0.6rem",
        alignItems: "flex-start",
        padding: "0.45rem 0",
        borderBottom: "1px solid var(--linje)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={vald}
        onChange={onToggle}
        style={{ marginTop: "0.3rem", accentColor: "var(--teal)" }}
      />
      <span>
        <span style={{ fontWeight: 600 }}>{namn}</span>
        <br />
        <span className="diskret">{beskrivning}</span>
      </span>
    </label>
  );
}

export default function ProfilSida() {
  const [profil, setProfil] = useState<Profil>(TOM_PROFIL);
  const [sparad, setSparad] = useState(false);

  useEffect(() => {
    setProfil(lasProfil());
  }, []);

  function vaxla(lista: "allergener" | "kostvillkor", id: string) {
    setSparad(false);
    setProfil((p) => {
      const finns = p[lista].includes(id);
      return {
        ...p,
        [lista]: finns ? p[lista].filter((x) => x !== id) : [...p[lista], id],
      };
    });
  }

  return (
    <section>
      <h1>Din profil</h1>
      <p className="diskret" style={{ margin: "0.5rem 0 1.25rem" }}>
        Sparas bara i din webbläsare — inga konton, ingenting skickas vidare.
        Markerade allergener lyfts i rött när de hittas i en produkt.
        Kostvillkor gör att relevant fakta lyfts fram, aldrig en dom.
      </p>

      <div className="card">
        <h2 style={{ fontSize: "1.05rem" }}>Allergener — livsmedel</h2>
        <p className="diskret" style={{ margin: "0.25rem 0 0.5rem" }}>
          EU:s 14 deklarationspliktiga allergener.
        </p>
        {mat.map((a) => (
          <Kryssruta
            key={a.id}
            vald={profil.allergener.includes(a.id)}
            namn={a.namn}
            beskrivning={a.beskrivning}
            onToggle={() => vaxla("allergener", a.id)}
          />
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.05rem" }}>Doftämnen — kosmetika</h2>
        <p className="diskret" style={{ margin: "0.25rem 0 0.5rem" }}>
          Deklarationspliktiga doftämnesallergener (listan kompletteras
          löpande).
        </p>
        {kosmetika.map((a) => (
          <Kryssruta
            key={a.id}
            vald={profil.allergener.includes(a.id)}
            namn={a.namn}
            beskrivning={a.beskrivning}
            onToggle={() => vaxla("allergener", a.id)}
          />
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.05rem" }}>Kostvillkor</h2>
        <p className="diskret" style={{ margin: "0.25rem 0 0.5rem" }}>
          Lupp lyfter fram relevant fakta och förklarar generella samband.
        </p>
        {villkor.map((v) => (
          <Kryssruta
            key={v.id}
            vald={profil.kostvillkor.includes(v.id)}
            namn={v.namn}
            beskrivning={v.samband}
            onToggle={() => vaxla("kostvillkor", v.id)}
          />
        ))}
      </div>

      <button
        className="btn"
        onClick={() => {
          sparaProfil(profil);
          setSparad(true);
        }}
      >
        Spara profil
      </button>
      {sparad && (
        <span style={{ marginLeft: "0.75rem", color: "var(--teal)" }}>
          Sparad.
        </span>
      )}
    </section>
  );
}
