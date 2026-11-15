"use client";
// Mapa do endereço de entrega. Carregado só no passo do endereço (next/dynamic), pra não pesar a página.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Ponto, Regiao } from "@/lib/entrega";

const CARTO = process.env.NEXT_PUBLIC_CARTO_KEY;

const PINO = L.divIcon({
  className: "",
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  html: `<svg width="36" height="46" viewBox="0 0 36 46" aria-hidden="true" style="filter:drop-shadow(0 3px 4px rgb(0 0 0 / .55))">
    <path d="M18 2C9.2 2 2 9 2 17.6 2 29.3 18 44 18 44s16-14.7 16-26.4C34 9 26.8 2 18 2z" fill="#EBA91F" stroke="#15110F" stroke-width="2"/>
    <circle cx="18" cy="17.5" r="6" fill="#15110F"/></svg>`,
});

export default function Mapa({ centro, regiao, pino, onMover }: { centro: Ponto; regiao: Regiao; pino: Ponto | null; onMover: (p: Ponto) => void }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marca = useRef<L.Marker | null>(null);
  const mover = useRef(onMover);
  mover.current = onMover;

  useEffect(() => {
    // No celular, um dedo rola a página, não o mapa (dois dedos dão zoom). O pino continua arrastável.
    const toque = window.matchMedia("(pointer: coarse)").matches;
    const m = L.map(div.current!, {
      center: [centro.lat, centro.lng],
      zoom: 12,
      minZoom: 11,
      maxZoom: 18,
      scrollWheelZoom: false,
      dragging: !toque,
      maxBounds: [[regiao.sul - 0.05, regiao.oeste - 0.05], [regiao.norte + 0.05, regiao.leste + 0.05]],
      attributionControl: false,
    });
    L.control
      .attribution({ prefix: false })
      .addAttribution(`© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>${CARTO ? ' © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' : ""}`)
      .addTo(m);
    // CARTO Dark Matter: mapa limpo, só ruas e nomes (chave grátis, até 1 milhão de pedaços por mês).
    // Sem a chave, o OpenStreetMap escurecido: nunca aparece o aviso de chave em cima do mapa.
    L.tileLayer(CARTO ? `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO}` : "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: CARTO ? "mapa-carto" : "mapa-osm",
    }).addTo(m);
    m.on("click", (ev) => mover.current({ lat: ev.latlng.lat, lng: ev.latlng.lng })); // toque no mapa leva o pino pra lá
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = marca.current = null;
    };
  }, [centro.lat, centro.lng, regiao]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!pino) {
      marca.current?.remove();
      marca.current = null;
      return;
    }
    if (!marca.current) {
      marca.current = L.marker([pino.lat, pino.lng], { icon: PINO, draggable: true, keyboard: false, title: "Seu endereço" }).addTo(m);
      marca.current.on("dragend", () => {
        const p = marca.current!.getLatLng();
        mover.current({ lat: p.lat, lng: p.lng });
      });
    } else marca.current.setLatLng([pino.lat, pino.lng]);
    if (!m.getBounds().pad(-0.2).contains([pino.lat, pino.lng]) || m.getZoom() < 15) m.setView([pino.lat, pino.lng], Math.max(m.getZoom(), 16));
  }, [pino]);

  return <div ref={div} className="h-60 overflow-hidden rounded-[var(--radius-card)] border border-linha" role="img" aria-label="Mapa com o local da entrega. Toca no mapa ou arrasta o pino amarelo pra corrigir." />;
}
