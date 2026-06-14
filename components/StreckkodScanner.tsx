"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/**
 * Live streckkodsskanning med kameran. Läser EAN/UPC via zxing och
 * returnerar koden via onResultat.
 *
 * Obs: getUserMedia kräver en SÄKER KONTEXT (localhost eller HTTPS). Över
 * vanlig http på en LAN-adress finns kameran inte tillgänglig — då visas
 * ett tydligt besked och användaren får mata in EAN manuellt i stället.
 */

// Begränsa till de format som faktiskt sitter på matvaror – snabbare och
// färre felläsningar än att låta zxing prova alla symbologier.
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]);

export default function StreckkodScanner({
  onResultat,
  onAvbryt,
}: {
  onResultat: (ean: string) => void;
  onAvbryt: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    let avbruten = false;

    // @zxing/browser kan kasta oskadliga asynkrona rejections vid
    // kamerastart/-stopp ("setPhotoOptions failed", "play() interrupted",
    // "Track is in an invalid state"). Inget stoppar avkodningen, men
    // obehandlat skulle de kunna slå upp dev-felöverlägget. Svälj just dem.
    const sväljKäntKamerafel = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string } | string | undefined;
      const m = typeof reason === "string" ? reason : reason?.message ?? "";
      if (
        m.includes("setPhotoOptions") ||
        m.includes("play()") ||
        m.includes("invalid state")
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", sväljKäntKamerafel);

    // Säker kontext krävs för kameran.
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      (typeof window !== "undefined" && !window.isSecureContext)
    ) {
      window.removeEventListener("unhandledrejection", sväljKäntKamerafel);
      setFel(
        "Kameran kräver en säker anslutning (https eller localhost). På mobilen över http funkar inte direktskanning — mata in EAN-koden manuellt nedan i stället."
      );
      return;
    }

    // Liten fördröjning innan kameran startar. I React Strict Mode (dev)
    // körs effekt → cleanup → effekt snabbt efter varandra; genom att vänta
    // hinner den första (kasserade) monteringens cleanup avbryta INNAN
    // getUserMedia anropas, så bara EN kameraström skapas. Det eliminerar
    // racet som annars ger "play() interrupted" / "Track in invalid state".
    const start = setTimeout(() => {
      const reader = new BrowserMultiFormatReader(hints);
      reader
        .decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (result, _err, controls) => {
            if (avbruten) return;
            if (result) {
              controls.stop();
              onResultat(result.getText());
            }
          }
        )
        .then((controls) => {
          if (avbruten) {
            controls.stop();
            return;
          }
          controlsRef.current = controls;
        })
        .catch((e: unknown) => {
          if (avbruten) return;
          const namn = e instanceof DOMException ? e.name : "";
          if (namn === "NotAllowedError") {
            setFel(
              "Behörighet till kameran nekades. Tillåt kameran i webbläsaren och försök igen, eller mata in EAN manuellt."
            );
          } else if (namn === "NotFoundError") {
            setFel("Ingen kamera hittades på enheten. Mata in EAN manuellt.");
          } else {
            setFel(
              "Kunde inte starta kameran. Mata in EAN manuellt, eller försök igen."
            );
          }
        });
    }, 250);

    return () => {
      avbruten = true;
      clearTimeout(start);
      controlsRef.current?.stop();
      window.removeEventListener("unhandledrejection", sväljKäntKamerafel);
    };
  }, [onResultat]);

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.6rem",
        }}
      >
        <h2 style={{ fontSize: "1.05rem" }}>📷 Skanna streckkoden</h2>
        <button className="btn btn-sekundar" onClick={onAvbryt}>
          Avbryt
        </button>
      </div>

      {fel ? (
        <p className="diskret">{fel}</p>
      ) : (
        <>
          <div
            style={{
              position: "relative",
              borderRadius: "10px",
              overflow: "hidden",
              background: "var(--grafit)",
              aspectRatio: "4 / 3",
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Siktlinje som hjälper att rikta mot streckkoden */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "8%",
                right: "8%",
                top: "50%",
                height: "2px",
                background: "var(--teal-ljus)",
                opacity: 0.9,
              }}
            />
          </div>
          <p className="diskret" style={{ marginTop: "0.6rem" }}>
            Rikta kameran mot streckkoden och håll stilla. Den läses av
            automatiskt.
          </p>
        </>
      )}
    </div>
  );
}
