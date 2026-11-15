"use client";
import { IconEstrela } from "@/components/icons";
import { cx } from "@/components/ui";
import { linkWhatsappCliente } from "@/lib/contato";
import { kmTexto, taxaTexto } from "@/lib/entrega";
import { brl } from "@/lib/format";
import { NOME_PAGAMENTO, mascaraTelefone } from "@/lib/site";
import type { Pedido } from "@/lib/types";

const pagamento = NOME_PAGAMENTO as Record<string, string>;
const rota = "inline-flex min-h-11 items-center rounded-[var(--radius-ctl)] border border-linha px-3 font-semibold text-milho active:bg-tisna";

// Mensagem pronta pro WhatsApp do cliente do site, com o link de acompanhamento (abre em qualquer aparelho).
export const msgCliente = (p: Pedido, resto = "") =>
  `Oi, ${p.cliente.split(" ")[0]}! Aqui é do Cantinho da Feijoada. Muito obrigado pelo seu pedido nº ${p.numero}, ficamos felizes com a sua escolha!${resto && ` ${resto}`}` +
  (p.rastreio ? `\n\nVocê pode acompanhar seu pedido por aqui: ${globalThis.location?.origin ?? ""}/pedido/${p.rastreio}` : "") +
  "\n\nQualquer coisa, é só chamar a gente por aqui.";
export const zapCliente = (p: Pedido, resto = "") => linkWhatsappCliente(p.telefone ?? "", msgCliente(p, resto));

// Quem, onde e como paga: o que precisa pra entregar um pedido do site.
export function Entrega({ p }: { p: Pedido }) {
  const e = p.endereco;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-semibold">
        {p.cliente}
        {p.telefone && <span className="num font-normal text-creme-2"> · {mascaraTelefone(p.telefone)}</span>}
      </p>
      {e && (
        <p>
          {e.rua}, {e.numero} · {e.bairro}
          {e.complemento && ` · ${e.complemento}`}
          {e.cidade && ` · ${e.cidade}`}
          {e.cep && <span className="num text-creme-2"> · CEP {e.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>}
        </p>
      )}
      {e?.referencia && <p className="text-creme-2">Referência: {e.referencia}</p>}
      {p.local && (
        <>
          {p.distanciaKm !== undefined && <p className="num">{kmTexto(p.distanciaKm)} da cozinha · entrega {taxaTexto(p.taxaEntrega)}</p>}
          {/* Rota pro entregador, direto no pino que o cliente marcou. */}
          <p className="flex flex-wrap gap-2">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.local.lat},${p.local.lng}&travelmode=driving`} target="_blank" rel="noopener" className={rota}>
              Rota no Google Maps
            </a>
            <a href={`https://waze.com/ul?ll=${p.local.lat},${p.local.lng}&navigate=yes`} target="_blank" rel="noopener" className={rota}>
              Rota no Waze
            </a>
          </p>
        </>
      )}
      {p.avaliacao && (
        <p>
          <span className="inline-flex align-[-2px]" role="img" aria-label={`Nota ${p.avaliacao.nota} de 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <IconEstrela key={n} className={cx("size-4", n <= p.avaliacao!.nota ? "text-milho" : "text-linha")} />
            ))}
          </span>
          {p.avaliacao.comentario && <span className="text-creme-2"> · “{p.avaliacao.comentario}”</span>}
        </p>
      )}
      <p className="text-creme-2">
        {pagamento[p.pagamento]} na entrega{p.trocoPara ? ` · troco pra ${brl(p.trocoPara)}` : ""}
      </p>
      {p.motivoRecusa && p.status === "cancelado" && <p className="text-prejuizo">Recusado: {p.motivoRecusa}</p>}
    </div>
  );
}

export function BotaoZap({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-ctl)] bg-zap/15 px-5 text-lg font-semibold uppercase tracking-wide text-zap transition-[transform,background-color] duration-150 active:scale-[0.97] active:bg-zap/25"
    >
      {children}
    </a>
  );
}
