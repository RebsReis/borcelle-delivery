import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <article className="container-app max-w-3xl py-s6 pb-s8 [&_h2]:mt-s5 [&_h2]:text-h4 [&_p]:mt-s2 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-s4">
      <h1 className="text-h2">Política de privacidade</h1>
      <p className="text-sm text-ink-muted">Modelo inicial. Revise com o responsável jurídico antes de publicar (LGPD — Lei 13.709/2018).</p>
      <h2>Quais dados coletamos</h2>
      <ul><li>Nome, telefone e e-mail, para identificar e falar sobre seu pedido.</li><li>Endereço de entrega, para entregar e calcular a taxa.</li><li>Itens, valores e forma de pagamento do pedido.</li></ul>
      <h2>Pagamentos</h2>
      <p>Pagamentos online são processados pelo Mercado Pago. Os dados do cartão são digitados em ambiente seguro do Mercado Pago e não passam nem ficam guardados em nossos servidores.</p>
      <h2>Cookies e medição</h2>
      <p>Com seu consentimento usamos Google Analytics/Tag Manager e Meta Pixel para medir visitas e conversões. Você pode retirar o consentimento a qualquer momento em Minha conta.</p>
      <h2>Notificações</h2>
      <p>Se você autorizar no checkout, enviamos atualizações do pedido pelo WhatsApp.</p>
      <h2>Seus direitos</h2>
      <p>Você pode pedir acesso, correção ou exclusão dos seus dados pelos nossos canais de atendimento. Dados salvos no seu aparelho podem ser apagados em Minha conta.</p>
      <h2>Retenção</h2>
      <p>Guardamos os dados de pedidos pelo prazo exigido pela legislação fiscal e de defesa do consumidor.</p>
    </article>
  );
}
