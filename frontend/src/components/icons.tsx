import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconBag = (p: P) => <Icon {...p}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>;
export const IconUser = (p: P) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Icon>;
export const IconPin = (p: P) => <Icon {...p}><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></Icon>;
export const IconClock = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const IconPlus = (p: P) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const IconMinus = (p: P) => <Icon {...p}><path d="M5 12h14" /></Icon>;
export const IconX = (p: P) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const IconSearch = (p: P) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
export const IconPhone = (p: P) => <Icon {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Icon>;
export const IconChat = (p: P) => <Icon {...p}><path d="M4 20l1.5-4A8 8 0 1 1 8 18.5L4 20Z" /></Icon>;
export const IconCheck = (p: P) => <Icon {...p}><path d="m5 12 5 5L20 7" /></Icon>;
export const IconChevron = (p: P) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const IconBack = (p: P) => <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>;
export const IconHome = (p: P) => <Icon {...p}><path d="M4 11 12 4l8 7v9H4v-9Z" /><path d="M10 20v-6h4v6" /></Icon>;
export const IconMenu = (p: P) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h10" /></Icon>;
export const IconReceipt = (p: P) => <Icon {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></Icon>;
export const IconTrash = (p: P) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Icon>;
export const IconEdit = (p: P) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></Icon>;
export const IconCopy = (p: P) => <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Icon>;
export const IconBike = (p: P) => <Icon {...p}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17 9 9h5l4 8M14 9l-2-3h-2" /></Icon>;
export const IconStore = (p: P) => <Icon {...p}><path d="M4 9 5 4h14l1 5M4 9h16v11H4V9Z" /><path d="M10 20v-5h4v5" /></Icon>;
export const IconArrow = (p: P) => <Icon {...p}><path d="M5 12h14m-5-5 5 5-5 5" /></Icon>;
export const IconTag = (p: P) => <Icon {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.5" /></Icon>;
export const IconAlert = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></Icon>;
export const IconCard = (p: P) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></Icon>;
export const IconCash = (p: P) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></Icon>;
export const IconPix = (p: P) => <Icon {...p}><path d="m12 3 4 4-4 4-4-4 4-4Zm0 10 4 4-4 4-4-4 4-4ZM3 12l4-4 4 4-4 4-4-4Zm10 0 4-4 4 4-4 4-4-4Z" /></Icon>;
export const IconWallet = (p: P) => <Icon {...p}><path d="M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1V7Zm0 0 12-3v3" /><circle cx="16" cy="13" r="1.2" /></Icon>;
