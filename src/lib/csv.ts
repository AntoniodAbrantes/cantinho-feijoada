// CSV no padrão do Excel brasileiro: ponto e vírgula, vírgula decimal, BOM para acentos.
export function paraCsv(linhas: Record<string, string | number>[]) {
  if (!linhas.length) return "";
  const cab = Object.keys(linhas[0]);
  const cel = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cab.join(";"), ...linhas.map((l) => cab.map((k) => cel(l[k] ?? "")).join(";"))].join("\r\n");
}

export function baixarCsv(nome: string, linhas: Record<string, string | number>[]) {
  const url = URL.createObjectURL(new Blob([paraCsv(linhas)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}
