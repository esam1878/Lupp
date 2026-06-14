import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tillåt att dev-servern öppnas från mobilen på samma WiFi.
  // Utan detta blockerar Next 16 de interna dev-resurserna när sidan
  // laddas från en annan adress än localhost — sidan syns men inget
  // blir klickbart. Lägg till datorns LAN-adress (och hela 192.168-
  // nätet som marginal om IP:t byts av routern).
  allowedDevOrigins: ["192.168.1.76", "192.168.1.*"],
};

export default nextConfig;
