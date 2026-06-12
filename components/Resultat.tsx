import type { Uppslag } from "@/lib/types";
import Disclaimer from "@/components/Disclaimer";

export interface ExplainSvar {
  sakerhet: { deklarerade: string[]; profiltraffar: string[] };
  innehall: Uppslag[];
  naring_text: string;
  sammanfattning: string;
  okanda: string[];
}

/**
 * Resultat enligt fast mall:
 * 1) Säkerhet & allergi  2) Vad produkten innehåller
 * 3) Näring i sammanhang 4) Sammanfattning
 * Profilträffarna är det enda röda i hela appen.
 */
export default function Resultat({ svar }: { svar: ExplainSvar }) {
  return (
    <div>
      <section aria-labelledby="rubrik-sakerhet">
        <h2 id="rubrik-sakerhet" style={{ margin: "1rem 0 0.5rem" }}>
          ⚠ Säkerhet &amp; allergi
        </h2>
        {svar.sakerhet.profiltraffar.map((text) => (
          <p key={text} className="varning-profil" role="alert">
            {text}
          </p>
        ))}
        <div className="card">
          {svar.sakerhet.deklarerade.length > 0 ? (
            <>
              <p style={{ fontWeight: 600 }}>Deklarerat på etiketten:</p>
              <ul style={{ paddingLeft: "1.25rem", marginTop: "0.35rem" }}>
                {svar.sakerhet.deklarerade.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Inga allergener är särskilt deklarerade på etiketten.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="rubrik-innehall">
        <h2 id="rubrik-innehall" style={{ margin: "1.5rem 0 0.5rem" }}>
          🔍 Vad produkten innehåller
        </h2>
        {svar.innehall.map((u) => (
          <div className="card" key={u.ingrediens_pa_etiketten}>
            <p style={{ fontWeight: 650 }}>
              {u.ingrediens_pa_etiketten}
              {u.post && !u.post.verified && (
                <>
                  {" "}
                  <span className="tagg tagg-preliminar">
                    preliminär — under granskning
                  </span>
                </>
              )}
            </p>
            {u.post ? (
              <>
                <p style={{ marginTop: "0.35rem" }}>
                  {u.post.forklaring_klarsprak}
                </p>
                <p style={{ marginTop: "0.35rem" }}>{u.post.nyans}</p>
                <p className="diskret" style={{ marginTop: "0.45rem" }}>
                  Källa: {u.post.kalla}
                  {u.post.kalla_url !== "TODO" && (
                    <>
                      {" · "}
                      <a href={u.post.kalla_url}>länk</a>
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="diskret" style={{ marginTop: "0.35rem" }}>
                Ej granskad än — den här ingrediensen finns inte i Lupps
                faktabank ännu, så vi säger ingenting om den i stället för att
                gissa.
              </p>
            )}
          </div>
        ))}
      </section>

      <section aria-labelledby="rubrik-naring">
        <h2 id="rubrik-naring" style={{ margin: "1.5rem 0 0.5rem" }}>
          📊 Näring i sammanhang
        </h2>
        <div className="card">
          <p>{svar.naring_text}</p>
        </div>
      </section>

      <section aria-labelledby="rubrik-sammanfattning">
        <h2 id="rubrik-sammanfattning" style={{ margin: "1.5rem 0 0.5rem" }}>
          Sammanfattning
        </h2>
        <div className="card card-sand">
          <p>{svar.sammanfattning}</p>
        </div>
      </section>

      <div className="diskret" style={{ marginTop: "1.25rem" }}>
        <Disclaimer />
      </div>
    </div>
  );
}
