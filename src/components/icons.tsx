import type { SVGProps } from "react";

/**
 * Iconos de sección (SVG inline, fondo transparente). Son vectores, así que el
 * "hueco para transparentes" queda resuelto de forma nativa (sin depender del
 * alfa de un PNG generado). El logo raster se genera aparte y vive en assets.
 */
type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const DynastyIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h16" />
    <path d="M6 20V11l6-5 6 5v9" />
    <path d="M10 20v-4h4v4" />
    <path d="M12 3v3" />
  </svg>
);

export const MapIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </svg>
);

export const NewsIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9h6M7 13h10M15 9h2" />
  </svg>
);

export const NexusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H8l-4 3V5Z" />
    <path d="M8 9h8M8 12h5" />
  </svg>
);

export const KingdomIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8l3 3 5-6 5 6 3-3v9H4V8Z" />
    <path d="M4 20h16" />
  </svg>
);

export const WalletIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const ArmyIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 4v5c0 4-3 6.5-7 9-4-2.5-7-5-7-9V7l7-4Z" />
    <path d="M12 8v6M9 11h6" />
  </svg>
);

export const AgricultureIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21v-7" />
    <path d="M12 14c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
    <path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5Z" />
    <path d="M5 21h14" />
  </svg>
);

export const ProductionIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 20h18" />
    <path d="M4 20v-6h5v6" />
    <path d="M9 14V8l5 3v3" />
    <path d="M14 20v-9h6v9" />
    <path d="M6 11V8M17 8V6" />
  </svg>
);

export const LivestockIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 9c0-2 1.5-3.5 3.5-3.5S12 7 12 9" />
    <path d="M4 14c0 2 1.5 3 3.5 3H10v3" />
    <path d="M10 12h5l2 2v3h-2" />
    <path d="M10 12V9" />
    <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CoinIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8M9.5 10h5M9.5 14h5" />
  </svg>
);

export const BellIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const SectionIcons = {
  dynasty: DynastyIcon,
  map: MapIcon,
  news: NewsIcon,
  kingdom: KingdomIcon,
  wallet: WalletIcon,
  army: ArmyIcon,
  coin: CoinIcon,
} as const;
