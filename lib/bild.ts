/**
 * Klienthjälp: skala ner ett etikettfoto innan det skickas till API:t.
 * Claude vision klarar max ~1568 px på längsta sidan utan kvalitetsvinst,
 * och mindre bilder ger snabbare svar.
 */
const MAX_SIDA = 1568;

export async function bildTillBase64(
  fil: File
): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lasare = new FileReader();
    lasare.onload = () => resolve(lasare.result as string);
    lasare.onerror = () => reject(new Error("Kunde inte läsa filen."));
    lasare.readAsDataURL(fil);
  });

  const bild = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Kunde inte tolka bilden."));
    img.src = dataUrl;
  });

  const skala = Math.min(1, MAX_SIDA / Math.max(bild.width, bild.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bild.width * skala);
  canvas.height = Math.round(bild.height * skala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas stöds inte i den här webbläsaren.");
  ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);

  const utDataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return {
    base64: utDataUrl.split(",")[1],
    mediaType: "image/jpeg",
  };
}
