/**
 * Jarvis-themed logo for Mission Control.
 * Stylised "J" monogram inside a hexagonal badge with accent glow.
 */
export function JarvisLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Jarvis — Mission Control"
    >
      {/* Outer hexagon ring */}
      <polygon
        points="32,2 58,17 58,47 32,62 6,47 6,17"
        fill="none"
        stroke="var(--mc-accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.6"
      />

      {/* Inner hexagon fill */}
      <polygon
        points="32,8 52,20 52,44 32,56 12,44 12,20"
        fill="var(--mc-surface-elevated)"
        stroke="var(--mc-accent)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.35"
      />

      {/* Accent glow — subtle radial behind the letter */}
      <circle cx="32" cy="32" r="14" fill="var(--mc-accent)" opacity="0.08" />

      {/* Stylised "J" letterform */}
      <path
        d="M28 18 H38 V19 H34 V42 C34 46 32 48 28 48 C24 48 22 46 22 43 V41 H26 V43 C26 44.5 27 45.5 28 45.5 C29 45.5 30 44.5 30 43 V18 Z"
        fill="var(--mc-accent)"
        opacity="0.9"
      />

      {/* Small crosshair tick marks — operational feel */}
      <line x1="32" y1="0" x2="32" y2="4" stroke="var(--mc-accent-cyan)" strokeWidth="1" opacity="0.4" />
      <line x1="32" y1="60" x2="32" y2="64" stroke="var(--mc-accent-cyan)" strokeWidth="1" opacity="0.4" />
      <line x1="0" y1="32" x2="4" y2="32" stroke="var(--mc-accent-cyan)" strokeWidth="1" opacity="0.4" />
      <line x1="60" y1="32" x2="64" y2="32" stroke="var(--mc-accent-cyan)" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}
