// Ícones de traço, só onde ajudam a navegar.
type P = { className?: string };
const S = ({ className = "size-6", children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const IconHoje = (p: P) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>;
export const IconPedidos = (p: P) => <S {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></S>;
export const IconMais = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconCaixa = (p: P) => <S {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></S>;
export const IconMenu = (p: P) => <S {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></S>;
export const IconFechar = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IconMenos = (p: P) => <S {...p}><path d="M5 12h14" /></S>;
export const IconSeta = (p: P) => <S {...p}><path d="M9 6l6 6-6 6" /></S>;
export const IconOffline = (p: P) => <S {...p}><path d="M2 2l20 20M8.5 16.5a5 5 0 017 0M5 12.9a10 10 0 015.2-2.8M19 12.9a10 10 0 00-2.4-1.7M2 8.8a15 15 0 014.2-2.6M22 8.8A15 15 0 0010.7 5M12 20h.01" /></S>;
