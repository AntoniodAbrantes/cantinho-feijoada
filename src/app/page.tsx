import type { Metadata } from "next";
import Image from "next/image";
import { Selo } from "@/components/ui";
import { BotaoAbertura, Cardapio, PedirDeNovo, PedidoProvider, StatusLoja, UltimoPedido } from "@/components/site/pedido";
import { FOTOS } from "@/data/fotos";
import { EMAIL, INSTAGRAM, SITE, WHATSAPP, WHATSAPP_TEXTO, linkInstagram, linkWhatsapp } from "@/lib/contato";
import { resumoFaixas } from "@/lib/entrega";
import { brl } from "@/lib/format";
import { DIAS_LOJA, NOME_DIA } from "@/lib/loja";
import type { DadosSite } from "@/lib/site";
import type { DiaLoja } from "@/lib/types";
import { carregarSite } from "@/lib/servidor/cardapio";

// Preço, esgotado e loja aberta vêm do sistema; a página se refaz a cada 30 s.
export const revalidate = 30;

// Canonical só aqui: no layout, as páginas filhas (sistema, pedido, 404) herdariam o da raiz.
export const metadata: Metadata = { alternates: { canonical: "/" } };

const CARNES = ["Costela", "Orelha", "Pé", "Rabo", "Charque", "Calabresa", "Linguiça", "Paio"];
const secao = "mx-auto w-full max-w-xl px-4";
const rotulo = "text-sm font-semibold uppercase tracking-[0.18em]";

const DIA_SCHEMA: Record<DiaLoja, string> = { sexta: "Friday", sabado: "Saturday", domingo: "Sunday" };

// Dados estruturados (schema.org) pro Google: só o que está no site e no sistema, sem endereço de rua (é só delivery).
function dadosEstruturados(dados: DadosSite | null) {
  const horarios = dados && dados.loja.modo !== "fechada" ? DIAS_LOJA.filter((d) => dados.loja.horarios[d]) : [];
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE}/#site`, url: `${SITE}/`, name: "Cantinho da Feijoada", inLanguage: "pt-BR" },
      {
        "@type": "Restaurant",
        "@id": `${SITE}/#restaurante`,
        name: "Cantinho da Feijoada",
        url: `${SITE}/`,
        logo: `${SITE}/marca/icone-512.png`,
        image: `${SITE}/marca/icone-512.png`,
        description: "Feijoada completa com oito carnes no delivery em João Pessoa, sexta, sábado e domingo, no almoço.",
        servesCuisine: "Brasileira",
        foundingDate: "2012",
        telephone: `+${WHATSAPP}`,
        email: EMAIL,
        sameAs: [linkInstagram],
        address: { "@type": "PostalAddress", addressLocality: "João Pessoa", addressRegion: "PB", addressCountry: "BR" },
        areaServed: { "@type": "City", name: "João Pessoa" },
        paymentAccepted: "Pix, dinheiro, cartão de débito, cartão de crédito",
        currenciesAccepted: "BRL",
        ...(horarios.length && {
          openingHoursSpecification: horarios.map((d) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${DIA_SCHEMA[d]}`,
            opens: dados!.loja.horarios[d]!.inicio,
            closes: dados!.loja.horarios[d]!.fim,
          })),
        }),
        ...(dados?.itens.length && {
          hasMenu: {
            "@type": "Menu",
            hasMenuItem: dados.itens.map((i) => ({
              "@type": "MenuItem",
              name: i.nome,
              offers: { "@type": "Offer", price: (i.preco / 100).toFixed(2), priceCurrency: "BRL" },
            })),
          },
        }),
      },
    ],
  };
}

function Foto({ src, alt, legenda }: { src: string | null; alt: string; legenda?: string }) {
  if (!src) return null;
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]">
        <Image src={src} alt={alt} fill sizes="(max-width: 640px) 100vw, 576px" className="object-cover" />
      </div>
      {legenda && <figcaption className="text-creme-3">{legenda}</figcaption>}
    </figure>
  );
}

export default async function Site() {
  const dados = await carregarSite().catch((e) => {
    console.error("site: cardápio não carregou", e);
    return null;
  });
  const horarios = dados ? DIAS_LOJA.filter((d) => dados.loja.horarios[d]).map((d) => `${NOME_DIA[d]}, das ${dados.loja.horarios[d]!.inicio} às ${dados.loja.horarios[d]!.fim}`) : [];

  return (
    <PedidoProvider dados={dados}>
      <script
        type="application/ld+json"
        // "<" escapado: nome de produto vem do cadastro e não pode fechar a tag <script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados(dados)).replace(/</g, "\\u003c") }}
      />
      <main className="flex flex-col pb-28">
        {/* Abertura */}
        <section className={`${secao} flex min-h-[85svh] flex-col justify-between gap-10 pb-10 pt-[max(20px,env(safe-area-inset-top))]`}>
          <div className="flex items-center justify-between">
            <Selo tamanho={64} completo />
            <span className={`${rotulo} text-creme-3`}>João Pessoa · PB</span>
          </div>
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-[clamp(60px,17.5vw,112px)] uppercase leading-[1.16] tracking-[-0.01em]">
              Dessa vez, o Cantinho <span className="text-milho">vai até você.</span>
            </h1>
            <p className="max-w-md text-[22px] leading-snug text-creme-2">
              Feijoada completa no delivery em João Pessoa. Sexta, sábado e domingo, no almoço.
            </p>
            <StatusLoja />
            <UltimoPedido />
            <PedirDeNovo />
          </div>
          <div className="flex flex-col gap-6">
            <Foto src={FOTOS.feijoada} alt="Feijoada do Cantinho" />
            <BotaoAbertura />
          </div>
        </section>

        {/* Cardápio */}
        <section id="cardapio" className={`${secao} scroll-mt-4 py-14`}>
          <p className={`${rotulo} mb-2 text-milho`}>Cardápio</p>
          <h2 className="mb-3 font-display text-[52px] uppercase leading-[0.9]">Escolhe a sua</h2>
          <p className="mb-8 text-xl text-creme-2">A completa vai com arroz, couve e farofa. A simples vem sem arroz e sem farofa.</p>
          <Cardapio />
        </section>

        {/* A história */}
        <section className="bg-creme py-16 text-carvao">
          <div className={`${secao} flex flex-col gap-6`}>
            <p className={`${rotulo} text-carvao/60`}>2012 · 2026</p>
            <h2 className="font-display text-[clamp(44px,12.5vw,76px)] uppercase leading-[0.95]">Há 14 anos, o Cantinho era parada certa.</h2>
            <p className="text-[22px] leading-snug">
              Muita gente em João Pessoa lembra da feijoada do Cantinho. Agora a família voltou pra cozinha, só que no delivery.
            </p>
            <Foto src={FOTOS.cantinho2012} alt="O Cantinho da Feijoada em 2012" legenda="O Cantinho em 2012." />
          </div>
        </section>

        {/* O que vai na feijoada */}
        <section className={`${secao} flex flex-col gap-6 py-16`}>
          <p className={`${rotulo} text-milho`}>O que vai na feijoada</p>
          <h2 className="font-display text-[52px] uppercase leading-[0.9]">Oito carnes</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-display text-[clamp(34px,10vw,52px)] uppercase leading-[1.05]">
            {CARNES.map((c, i) => (
              <li key={c} className={i % 2 ? "text-creme-2" : "text-creme"}>
                {c}
                {i < CARNES.length - 1 && <span className="ml-3 text-milho" aria-hidden>·</span>}
              </li>
            ))}
          </ul>
          <p className="text-[22px] text-creme-2">E bacon no tempero.</p>
          <div className="border-t border-linha pt-6">
            <p className={`${rotulo} mb-2 text-creme-3`}>Acompanha</p>
            <p className="font-display text-[34px] uppercase leading-none">Arroz, couve e farofa</p>
          </div>
        </section>

        {/* Como funciona */}
        <section className="bg-brasa py-16">
          <div className={`${secao} flex flex-col gap-8`}>
            <h2 className="font-display text-[52px] uppercase leading-[0.9]">Como funciona</h2>
            <ol className="flex flex-col gap-8">
              <Passo n={1} titulo="Quando">
                Sexta, sábado e domingo, no almoço.
                {horarios.length > 0 && <span className="mt-1 block text-creme-3">{horarios.join(" · ")}.</span>}
              </Passo>
              <Passo n={2} titulo="Entrega">
                {dados?.entrega.ativo
                  ? `${resumoFaixas(dados.entrega.faixas)}, em João Pessoa e região. A taxa sai certinha pelo seu endereço, no mapa.`
                  : `${dados ? `${dados.taxaEntrega ? brl(dados.taxaEntrega) : "Grátis"} até 4 km` : "Até 4 km"}, em João Pessoa. Mais longe, a gente confirma o valor pelo WhatsApp antes de sair.`}
              </Passo>
              <Passo n={3} titulo="Pagamento">
                Pix na hora, com QR code, ou na entrega: Pix, dinheiro, débito ou crédito.
              </Passo>
            </ol>
            <Foto src={FOTOS.potes} alt="Potes da feijoada prontos para entrega" />
          </div>
        </section>

        {/* Rodapé */}
        <footer className={`${secao} flex flex-col gap-6 py-14`}>
          <Selo tamanho={96} completo />
          <div className="flex flex-col gap-3 text-xl">
            <a href={linkWhatsapp("Oi! Vim pelo site.")} className="font-semibold underline-offset-4 active:underline">
              WhatsApp {WHATSAPP_TEXTO}
            </a>
            <a href={linkInstagram} className="font-semibold underline-offset-4 active:underline">
              Instagram @{INSTAGRAM}
            </a>
            <a href={`mailto:${EMAIL}`} className="break-all font-semibold underline-offset-4 active:underline">
              {EMAIL}
            </a>
          </div>
          <p className="text-creme-3">Delivery em João Pessoa · sexta, sábado e domingo, no almoço.</p>
        </footer>
      </main>
    </PedidoProvider>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[48px_1fr] gap-x-3">
      <span className="font-display text-[40px] leading-none text-milho">{n}</span>
      <span>
        <span className="block font-display text-[28px] uppercase leading-none">{titulo}</span>
        <span className="mt-2 block text-xl leading-snug text-creme-2">{children}</span>
      </span>
    </li>
  );
}
