// Simple black-and-white line icons (inherit the text color).
const base = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

export const HotelIcon = () => (
  <svg {...base}>
    <path d="M3 21V7l9-4 9 4v14" />
    <path d="M3 21h18" />
    <path d="M8 10h2M14 10h2M8 14h2M14 14h2" />
    <path d="M10.5 21v-3h3v3" />
  </svg>
);

export const RestaurantIcon = () => (
  <svg {...base}>
    <path d="M6 3v7a2 2 0 0 0 4 0V3" />
    <path d="M8 3v18" />
    <path d="M17 21V3c-1.7 1-3 3.2-3 6v4h3" />
  </svg>
);

export const CustomIcon = () => (
  <svg {...base}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);
