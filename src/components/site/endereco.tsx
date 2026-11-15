"use client";
// Endereço com CEP (ViaCEP), sugestões (Photon/OpenStreetMap) e pino no mapa. A taxa vem de /api/entrega.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { Campo, estiloCampo } from "@/components/campos";
import { naRegiao, taxaTexto, type EntregaSite, type Ponto } from "@/lib/entrega";
import type { Endereco } from "@/lib/types";
import type { CampoCliente } from "@/lib/site";

const Mapa = dynamic(() => import("./mapa"), {
  ssr: false,
  loading: () => <div className="h-60 animate-pulse rounded-[var(--radius-card)] bg-brasa" aria-label="Carregando o mapa" />,
});

export type Taxa =
  | { estado: "sem-pino" }
  | { estado: "calculando" }
  | { estado: "ok"; taxa: number }
  | { estado: "fora" }
  | { estado: "erro"; msg: string };

const SEM_NET = "Tô sem internet aqui. Confere a conexão e tenta de novo.";

// Taxa do pino, perguntada ao servidor (que é quem decide de novo no envio).
export function useTaxa(local: Ponto | undefined, ativo: boolean): Taxa {
  const [t, setT] = useState<Taxa>({ estado: "sem-pino" });
  const lat = local?.lat;
  const lng = local?.lng;
  useEffect(() => {
    if (!ativo || lat === undefined || lng === undefined) return setT({ estado: "sem-pino" });
    setT({ estado: "calculando" });
    const ctl = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch("/api/entrega", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat, lng }), signal: ctl.signal });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro);
        setT(j.taxa === null ? { estado: "fora" } : { estado: "ok", taxa: j.taxa });
      } catch {
        if (ctl.signal.aborted) return;
        setT({ estado: "erro", msg: navigator.onLine ? "Não consegui calcular a entrega agora. Tenta de novo daqui a pouco." : SEM_NET });
      }
    }, 300);
    return () => {
      clearTimeout(espera);
      ctl.abort();
    };
  }, [ativo, lat, lng]);
  return t;
}

// Sugestões: Photon (o Nominatim não permite autocomplete). Ponto no mapa: Nominatim, mais rápido e certeiro.
// Cada serviço: no máximo 1 consulta por segundo, com cache.
interface Lugar {
  rotulo: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  ponto: Ponto;
}
// Serviço gratuito às vezes trava: desiste em 5 s (e junta com o cancelamento de quem chamou).
const comLimite = (s?: AbortSignal) => (s && AbortSignal.any ? AbortSignal.any([s, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000));
const cache = new Map<string, Lugar[]>();
const ultima = { photon: 0, nominatim: 0 };
async function vez(servico: keyof typeof ultima) {
  const falta = ultima[servico] + 1000 - Date.now();
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  ultima[servico] = Date.now();
}
async function buscar(q: string, e: EntregaSite, signal?: AbortSignal): Promise<Lugar[]> {
  const chave = q.trim().toLowerCase();
  const salvo = cache.get(chave);
  if (salvo) return salvo;
  await vez("photon");
  if (signal?.aborted) return [];
  const r = e.regiao;
  const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lat=${e.centro.lat}&lon=${e.centro.lng}&bbox=${r.oeste},${r.sul},${r.leste},${r.norte}`;
  const j = (await (await fetch(u, { signal: comLimite(signal) })).json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
  const vistos = new Set<string>();
  const lista = j.features
    .map(({ geometry: { coordinates: [lng, lat] }, properties: p }) => {
      const rua = p.street ?? p.name ?? "";
      const bairro = p.district ?? p.locality ?? "";
      const cidade = p.city ?? p.county ?? "";
      const numero = p.housenumber ?? "";
      const nome = p.name && p.name !== rua ? `${p.name} · ` : "";
      return { rua, numero, bairro, cidade, cep: (p.postcode ?? "").replace(/\D/g, ""), ponto: { lat, lng }, rotulo: `${nome}${rua}${numero ? `, ${numero}` : ""}${bairro ? ` · ${bairro}` : ""} · ${cidade}` };
    })
    .filter((l) => l.rua && naRegiao(l.ponto, r) && !vistos.has(l.rotulo) && vistos.add(l.rotulo));
  cache.set(chave, lista);
  return lista;
}

// Ponto do endereço, do mais preciso ao menos: rua com número, rua, rua sem "Rua/Avenida", centro do bairro.
// Muita rua pequena de João Pessoa não está no OpenStreetMap; o bairro quase sempre está.
const pontos = new Map<string, Ponto | null>();
type Achado = { ponto: Ponto; so: "rua" | "bairro" };
async function geocodificar(end: Endereco, e: EntregaSite, signal: AbortSignal): Promise<Achado | null> {
  const r = e.regiao;
  const cidade = end.cidade || e.cidades[0];
  const base = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&bounded=1&viewbox=${r.oeste},${r.norte},${r.leste},${r.sul}`;
  const q = (v: string) => `&q=${encodeURIComponent(v)}`;
  const tentativas: [string, Achado["so"]][] = [
    [`&street=${encodeURIComponent(`${end.numero} ${end.rua}`.trim())}&city=${encodeURIComponent(cidade)}&state=Para%C3%ADba`, "rua"],
    [q(`${end.rua}, ${end.bairro}, ${cidade}, Paraíba`), "rua"],
    [q(`${end.rua.replace(/^(rua|avenida|av\.?|travessa|tv\.?|praça|alameda|rodovia)\s+/i, "")}, ${cidade}, Paraíba`), "rua"],
    ...(end.bairro.trim() ? [[q(`${end.bairro}, ${cidade}, Paraíba`), "bairro"] as [string, Achado["so"]]] : []),
  ];
  for (const [t, so] of tentativas) {
    if (!pontos.has(t)) {
      await vez("nominatim");
      if (signal.aborted) return null;
      const [l] = (await (await fetch(base + t, { signal: comLimite(signal) })).json()) as { lat: string; lon: string }[];
      pontos.set(t, l ? { lat: Number(l.lat), lng: Number(l.lon) } : null);
    }
    const p = pontos.get(t);
    if (p && naRegiao(p, r)) return { ponto: p, so };
  }
  return null;
}

export function EnderecoEntrega({
  e, end, local, setLocal, preencher, erros, taxa, linkFora, aviso,
}: {
  e: EntregaSite;
  end: Endereco;
  local?: Ponto;
  setLocal: (p: Ponto | undefined) => void;
  preencher: (campos: Partial<Endereco>, local?: Ponto) => void;
  erros: Partial<Record<CampoCliente, string>>;
  taxa: Taxa;
  linkFora: string;
  aviso?: string; // erro de entrega depois de tentar seguir
}) {
  const [cepMsg, setCepMsg] = useState("");
  const [sugestoes, setSugestoes] = useState<Lugar[]>([]);
  const [busca, setBusca] = useState(""); // texto digitado na rua que ainda não virou endereço
  const [achou, setAchou] = useState<"" | "procurando" | "nao" | "bairro">("");
  const manual = useRef(false); // arrastou o pino: não move mais sozinho
  const geocodificado = useRef(local ? chave(end) : "");

  // CEP completo: ViaCEP preenche rua, bairro e cidade.
  const mudarCep = async (v: string) => {
    const cep = v.replace(/\D/g, "").slice(0, 8);
    preencher({ cep });
    setCepMsg("");
    if (cep.length !== 8) return;
    setCepMsg("Buscando o CEP…");
    try {
      const j = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: comLimite() })).json();
      if (j.erro) return setCepMsg("Não achei esse CEP. Confere os números ou digita a rua.");
      const cidade = e.cidades.find((c) => c.toLowerCase() === String(j.localidade).toLowerCase());
      if (j.uf !== "PB" || !cidade) return setCepMsg(`Esse CEP é de ${j.localidade}/${j.uf}. A gente entrega em ${e.cidades.join(", ")}.`);
      manual.current = false;
      preencher({ cep, rua: j.logradouro || end.rua, bairro: j.bairro || end.bairro, cidade });
      setCepMsg("");
    } catch {
      setCepMsg(navigator.onLine ? "O serviço de CEP não respondeu. Digita a rua mesmo." : SEM_NET);
    }
  };

  // Sugestões enquanto digita a rua (400 ms depois da última tecla).
  useEffect(() => {
    if (busca.trim().length < 4) return setSugestoes([]);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      buscar(`${busca}, ${end.cidade || e.cidades[0]}`, e, ctl.signal).then(setSugestoes, () => setSugestoes([]));
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [busca, end.cidade, e]);

  const escolher = (l: Lugar) => {
    manual.current = false;
    const campos = { rua: l.rua, bairro: l.bairro || end.bairro, cidade: e.cidades.find((c) => c === l.cidade) ?? end.cidade, ...(l.numero && { numero: l.numero }), ...(l.cep && { cep: l.cep }) };
    geocodificado.current = chave({ ...end, ...campos });
    preencher(campos, l.ponto);
    setBusca("");
    setSugestoes([]);
    setAchou("");
  };

  // Endereço mudou (CEP, número, bairro): acha o ponto sozinho, a não ser que o cliente tenha arrastado o pino.
  useEffect(() => {
    const k = chave(end);
    if (manual.current || !end.rua.trim() || k === geocodificado.current || busca) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setAchou("procurando");
      try {
        const a = await geocodificar(end, e, ctl.signal);
        if (ctl.signal.aborted) return;
        geocodificado.current = k;
        setLocal(a?.ponto); // não achou: tira o pino velho, pra não cobrar a entrega de outro lugar
        setAchou(!a ? "nao" : a.so === "bairro" ? "bairro" : "");
      } catch {
        if (!ctl.signal.aborted) setAchou("nao");
      }
    }, 1000);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [end, busca, e, setLocal]);

  const campo = (k: keyof Endereco, rotulo: string, p: React.InputHTMLAttributes<HTMLInputElement> & { opcional?: boolean } = {}) => {
    const { opcional, ...resto } = p;
    const erro = erros[k as CampoCliente];
    return (
      <Campo rotulo={opcional ? `${rotulo} (opcional)` : rotulo}>
        {(id) => (
          <>
            <input id={id} value={end[k] ?? ""} onChange={(ev) => preencher({ [k]: ev.target.value })} aria-invalid={!!erro} className={cx(estiloCampo, erro && "border-prejuizo")} {...resto} />
            {erro && <span className="font-semibold text-prejuizo">{erro}</span>}
          </>
        )}
      </Campo>
    );
  };

  return (
    <>
      <Campo rotulo="CEP (se souber)">
        {(id) => (
          <>
            <input id={id} value={formatarCep(end.cep ?? "")} onChange={(ev) => mudarCep(ev.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="58000-000" className={cx(estiloCampo, "num")} />
            {cepMsg && <span className={cepMsg.endsWith("…") ? "text-creme-3" : "font-semibold text-prejuizo"}>{cepMsg}</span>}
          </>
        )}
      </Campo>

      <div className="relative">
        <Campo rotulo="Rua">
          {(id) => (
            <>
              <input
                id={id}
                value={busca || end.rua}
                onChange={(ev) => {
                  setBusca(ev.target.value);
                  preencher({ rua: ev.target.value });
                }}
                onBlur={() => setTimeout(() => setBusca(""), 200)}
                role="combobox"
                aria-expanded={sugestoes.length > 0}
                aria-controls={`${id}-lista`}
                aria-autocomplete="list"
                aria-invalid={!!erros.rua}
                autoComplete="off"
                placeholder="Começa a digitar a rua"
                maxLength={100}
                className={cx(estiloCampo, erros.rua && "border-prejuizo")}
              />
              {erros.rua && <span className="font-semibold text-prejuizo">{erros.rua}</span>}
              {sugestoes.length > 0 && (
                <ul id={`${id}-lista`} role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[var(--radius-ctl)] border border-linha bg-tisna shadow-xl">
                  {sugestoes.map((l) => (
                    <li key={l.rotulo} role="option" aria-selected={false}>
                      <button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => escolher(l)} className="block min-h-12 w-full px-3 py-2 text-left text-lg leading-snug active:bg-linha">
                        {l.rotulo}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Campo>
      </div>

      <div className="grid grid-cols-[96px_1fr] gap-3">
        {campo("numero", "Número", { maxLength: 10, inputMode: "text" })}
        {campo("bairro", "Bairro", { maxLength: 60, autoComplete: "address-level3" })}
      </div>
      <Campo rotulo="Cidade">
        {(id) => (
          <select id={id} value={end.cidade || e.cidades[0]} onChange={(ev) => preencher({ cidade: ev.target.value })} className={estiloCampo}>
            {e.cidades.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </Campo>
      {campo("complemento", "Complemento", { opcional: true, placeholder: "Apto, bloco, casa", maxLength: 60, autoComplete: "address-line2" })}
      {campo("referencia", "Ponto de referência", { opcional: true, maxLength: 100 })}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-creme-3">Confere no mapa</span>
        <Mapa
          centro={e.centro}
          regiao={e.regiao}
          pino={local ?? null}
          onMover={(p) => {
            manual.current = true;
            setAchou("");
            setLocal(p);
          }}
        />
        {local ? (
          achou === "bairro" ? (
            <p className="font-semibold text-milho">Achei o bairro, mas não a rua. Toca na sua casa no mapa pra taxa sair certa.</p>
          ) : (
            <p className="text-creme-3">Pino fora do lugar? Toca na sua casa no mapa ou arrasta ele.</p>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <p className={achou === "nao" ? "font-semibold text-prejuizo" : "text-creme-3"}>
              {achou === "procurando" ? "Procurando o endereço no mapa…" : achou === "nao" ? "Não achei esse endereço no mapa. Confere a rua ou marca no mapa." : "Digita o CEP ou a rua que o pino aparece aqui."}
            </p>
            {achou === "nao" && (
              <button
                type="button"
                onClick={() => {
                  manual.current = true;
                  setLocal(e.centro);
                }}
                className="min-h-12 self-start rounded-[var(--radius-ctl)] border border-milho px-4 font-semibold text-milho active:bg-tisna"
              >
                Marcar no mapa
              </button>
            )}
          </div>
        )}
        <StatusTaxa taxa={taxa} linkFora={linkFora} />
        {aviso && <p role="alert" className="font-semibold text-prejuizo">{aviso}</p>}
      </div>
    </>
  );
}

function StatusTaxa({ taxa, linkFora }: { taxa: Taxa; linkFora: string }) {
  if (taxa.estado === "sem-pino") return null;
  if (taxa.estado === "calculando") return <p className="text-creme-2" aria-live="polite">Calculando a entrega…</p>;
  if (taxa.estado === "erro") return <p role="alert" className="font-semibold text-prejuizo">{taxa.msg}</p>;
  if (taxa.estado === "ok")
    return (
      <p className="flex items-baseline justify-between rounded-[var(--radius-ctl)] bg-brasa px-4 py-3 text-lg" aria-live="polite">
        <span>Entrega</span>
        <span className="num font-semibold text-milho">{taxaTexto(taxa.taxa)}</span>
      </p>
    );
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-milho p-4">
      <p className="text-lg">
        Esse endereço fica fora da nossa área de entrega. Chama a gente que a gente combina.
      </p>
      <a href={linkFora} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-ctl)] bg-zap px-4 font-semibold uppercase tracking-wide text-carvao active:opacity-80">
        Combinar entrega pelo WhatsApp
      </a>
    </div>
  );
}

const chave = (e: Endereco) => [e.rua, e.numero, e.bairro, e.cidade].map((s) => (s ?? "").trim().toLowerCase()).join("|");
const formatarCep = (c: string) => (c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);
