"use client";

import { useState } from "react";
import { money } from "@/lib/format";

export type CardData = { last_four: string; installments: number; brand: string };

const brandOf = (n: string) =>
  /^4/.test(n) ? "Visa" : /^(5[1-5]|2[2-7])/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "Amex" : /^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(n) ? "Elo" : "Cartão";

const luhn = (n: string) => {
  let s = 0;
  for (let i = 0; i < n.length; i++) {
    let d = parseInt(n[n.length - 1 - i], 10);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    s += d;
  }
  return s % 10 === 0;
};

/**
 * Formulário de cartão SIMULADO (protótipo). Nada é enviado nem guardado:
 * só os 4 últimos dígitos seguem para o pedido de demonstração.
 * Em produção, este bloco é substituído pelo formulário seguro do gateway.
 */
export function DemoCard({ type, amountCents, maxInstallments, minInstallmentCents, onReady }: {
  type: "credit" | "debit"; amountCents: number; maxInstallments: number; minInstallmentCents: number; onReady: (d: CardData) => void;
}) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [inst, setInst] = useState(1);
  const [tried, setTried] = useState(false);

  const digits = number.replace(/\D/g, "");
  const [mm, yy] = exp.split("/");
  const expOk = /^\d{2}\/\d{2}$/.test(exp) && +mm >= 1 && +mm <= 12 && new Date(2000 + +yy, +mm) > new Date();
  const errors = {
    number: digits.length < 13 || !luhn(digits) ? "Número de cartão inválido" : "",
    name: name.trim().length < 3 ? "Nome como está no cartão" : "",
    exp: expOk ? "" : "Validade inválida",
    cvv: /^\d{3,4}$/.test(cvv) ? "" : "CVV inválido",
  };
  const options = Array.from({ length: maxInstallments }, (_, i) => i + 1).filter((n) => n === 1 || amountCents / n >= minInstallmentCents);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    onReady({ last_four: digits.slice(-4), installments: type === "credit" ? inst : 1, brand: brandOf(digits) });
  };

  const err = (k: keyof typeof errors) => tried && errors[k] ? <p className="field-error">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-s3 rounded-md bg-surface p-s4">
      <p className="rounded-sm bg-accent px-s3 py-s2 text-xs font-bold text-ink">
        PROTÓTIPO — nenhum dado é enviado. Teste com 4111 1111 1111 1111 (aprovado) ou 4000 0000 0000 0002 (recusado).
      </p>
      <div className="field">
        <label htmlFor="cc-number">Número do cartão</label>
        <input id="cc-number" className="input" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
          value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "))}
          aria-invalid={tried && !!errors.number} />
        {digits.length >= 6 && <span className="text-xs font-semibold text-ink-muted">{brandOf(digits)}</span>}
        {err("number")}
      </div>
      <div className="field">
        <label htmlFor="cc-name">Nome impresso no cartão</label>
        <input id="cc-name" className="input uppercase" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !!errors.name} />
        {err("name")}
      </div>
      <div className="grid grid-cols-2 gap-s3">
        <div className="field">
          <label htmlFor="cc-exp">Validade</label>
          <input id="cc-exp" className="input" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={exp}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }}
            aria-invalid={tried && !!errors.exp} />
          {err("exp")}
        </div>
        <div className="field">
          <label htmlFor="cc-cvv">CVV</label>
          <input id="cc-cvv" className="input" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))} aria-invalid={tried && !!errors.cvv} />
          {err("cvv")}
        </div>
      </div>
      {type === "credit" && (
        <div className="field">
          <label htmlFor="cc-inst">Parcelas</label>
          <select id="cc-inst" className="input" value={inst} onChange={(e) => setInst(+e.target.value)}>
            {options.map((n) => <option key={n} value={n}>{n}x de {money(Math.round(amountCents / n))} sem juros</option>)}
          </select>
        </div>
      )}
      <button className="btn btn-primary">Usar este cartão</button>
    </form>
  );
}
