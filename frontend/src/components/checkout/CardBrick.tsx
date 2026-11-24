"use client";

import { useEffect, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { Spinner } from "../ui";

export type CardData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments: number;
  identification_type?: string | null;
  identification_number?: string | null;
  last_four?: string;
};

let initialized = "";

/**
 * Formulário seguro do Mercado Pago (Card Payment Brick). Os dados do cartão
 * são digitados num iframe do Mercado Pago e convertidos em token: número e CVV
 * nunca passam pelo nosso servidor.
 */
export function CardBrick({ publicKey, amountCents, type, maxInstallments, email, onReady }: {
  publicKey: string; amountCents: number; type: "credit" | "debit"; maxInstallments: number; email: string;
  onReady: (data: CardData) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialized !== publicKey) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      initialized = publicKey;
    }
  }, [publicKey]);

  return (
    <div className="rounded-md bg-surface p-s2">
      {loading && <div className="flex items-center justify-center gap-s2 p-s5 text-sm text-ink-muted"><Spinner /> Carregando pagamento seguro…</div>}
      {error && <p className="field-error p-s3">{error}</p>}
      <CardPayment
        key={`${type}-${amountCents}`}
        initialization={{ amount: amountCents / 100, payer: { email } }}
        customization={{
          paymentMethods: type === "credit"
            ? { maxInstallments, types: { included: ["credit_card"] } }
            : { maxInstallments: 1, types: { included: ["debit_card", "prepaid_card"] } },
          visual: {
            style: {
              theme: "default",
              customVariables: {
                baseColor: "#D4261B",
                textPrimaryColor: "#321B13",
                inputBackgroundColor: "#FFF8EF",
                formBackgroundColor: "#FFF8EF",
                borderRadiusMedium: "8px",
                fontWeightSemiBold: "700",
              },
            },
            texts: { formSubmit: "Usar este cartão" },
          },
        }}
        onReady={() => setLoading(false)}
        onError={() => { setLoading(false); setError("Não foi possível carregar o formulário de cartão. Tente outra forma de pagamento."); }}
        onSubmit={async (formData) => {
          const f = formData as unknown as {
            token: string; payment_method_id: string; issuer_id?: string; installments: number;
            payer?: { identification?: { type?: string; number?: string } };
          };
          onReady({
            token: f.token,
            payment_method_id: f.payment_method_id,
            issuer_id: f.issuer_id ?? null,
            installments: Number(f.installments) || 1,
            identification_type: f.payer?.identification?.type ?? null,
            identification_number: f.payer?.identification?.number ?? null,
          });
        }}
      />
    </div>
  );
}
