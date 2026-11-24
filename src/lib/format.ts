const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const money = (cents: number) => brl.format(cents / 100);

export const time = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const tz = "America/Sao_Paulo";
  const key = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: tz });
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  if (key(d) === key(today)) return "Hoje";
  if (key(d) === key(tomorrow)) return "Amanhã";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: tz });
};

export const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const parseMoney = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? parseInt(d, 10) : 0;
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
