/**
 * Lupp-märket: en lins ritad som ett öga – tre koncentriska cirklar
 * (ytterlins, iris i teal, pupill) med handtag i 45°.
 */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Lupp"
    >
      {/* Handtag i 45° från linsens nedre högra kant */}
      <line
        x1="68"
        y1="68"
        x2="92"
        y2="92"
        stroke="#f3f1ea"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Ytterlins */}
      <circle cx="42" cy="42" r="32" fill="#f3f1ea" />
      {/* Iris */}
      <circle cx="42" cy="42" r="20" fill="#2f6d6a" />
      {/* Pupill */}
      <circle cx="42" cy="42" r="8" fill="#1c2b33" />
    </svg>
  );
}
