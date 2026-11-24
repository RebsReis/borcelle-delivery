import Image from "next/image";

/** Marca em linha (hambúrguer estilizado) + logotipo tipográfico. Troque por /images/logo.svg quando houver o arquivo oficial. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-s2 text-primary" aria-label="Borcelle Hamburgueria">
      <svg width={compact ? 30 : 36} height={compact ? 24 : 28} viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M4 12c0-6 6-9 14-9s14 3 14 9H4Z" />
        <path d="M3 16h30" />
        <path d="M4 20c3 0 3 2 6 2s3-2 6-2 3 2 6 2 3-2 6-2 3 2 4 2" />
        <path d="M5 25h26" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-body font-extrabold tracking-tight" style={{ fontSize: compact ? 18 : 22 }}>BORCELLE</span>
        <span className="font-body font-semibold" style={{ fontSize: compact ? 9 : 11, letterSpacing: "0.18em" }}>HAMBURGUERIA</span>
      </span>
    </span>
  );
}

/** Ilustração vetorial usada enquanto as fotos reais não são cadastradas. */
export function BurgerArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 320" className={className} role="img" aria-label="Ilustração de hambúrguer">
      <ellipse cx="200" cy="300" rx="170" ry="14" fill="var(--color-text-primary)" opacity=".18" />
      <path d="M40 140c0-70 70-110 160-110s160 40 160 110H40Z" fill="#E7A24E" />
      <path d="M70 110c0-40 50-62 130-62" stroke="#F6C98A" strokeWidth="10" strokeLinecap="round" fill="none" opacity=".7" />
      {[[120, 80], [170, 64], [230, 70], [270, 92], [150, 104], [210, 98]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#FFF3DC" transform={`rotate(${i * 25} ${x} ${y})`} />
      ))}
      <path d="M30 150h340c0 10-12 16-22 16H52c-10 0-22-6-22-16Z" fill="var(--color-primary)" />
      <path d="M36 160c20 0 26 26 52 26s28-22 56-22 30 30 58 30 30-26 58-26 28 22 52 22 24-20 42-20v-6H36Z" fill="var(--color-accent)" />
      <rect x="44" y="180" width="312" height="34" rx="17" fill="#5A2615" />
      <path d="M44 208c24 0 30 22 58 22s30-20 58-20 30 26 58 26 30-24 58-24 30 18 50 18" stroke="var(--color-accent)" strokeWidth="12" fill="none" strokeLinecap="round" />
      <rect x="40" y="226" width="320" height="34" rx="17" fill="#4A1E10" />
      <path d="M44 262h312c0 20-30 34-70 34H114c-40 0-70-14-70-34Z" fill="#D98E3E" />
    </svg>
  );
}

export function ProductImage({ src, alt, className = "", priority = false, sizes = "(max-width: 768px) 50vw, 25vw" }: {
  src: string | null; alt: string; className?: string; priority?: boolean; sizes?: string;
}) {
  if (!src) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden bg-secondary/40 ${className}`}>
        <BurgerArt className="w-3/4" />
        <span className="sr-only">{alt} (foto em breve)</span>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
