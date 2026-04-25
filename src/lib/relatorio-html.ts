// Gera HTML estilizado pronto para impressão (PDF via "Salvar como PDF" do navegador)
interface Kpi {
  secretaria_slug: string;
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: string;
  referencia_data: string;
}

interface Alerta {
  titulo: string;
  status: string;
  prazo: string | null;
  valor_estimado: number | null;
  tipo: string;
}

interface ScoreSocial {
  data: string;
  score: number;
  total_mencoes: number;
}

interface BriefingResumo {
  resumo: string;
  destaques: Array<{ titulo: string; descricao: string }>;
  alertas: Array<{ titulo: string; descricao: string; severidade: string }>;
  recomendacoes: Array<{ titulo: string; descricao: string; prioridade: string }>;
}

export interface RelatorioInput {
  municipio: string;
  periodoInicio: string;
  periodoFim: string;
  populacao: number | null;
  kpis: Kpi[];
  alertas: Alerta[];
  scores: ScoreSocial[];
  briefing?: BriefingResumo | null;
}

const SECRETARIA_LABEL: Record<string, string> = {
  saude: "Saúde",
  educacao: "Educação",
  financas: "Finanças",
  infraestrutura: "Infraestrutura",
  seguranca: "Segurança",
  assistencia_social: "Assistência Social",
};

function fmt(v: number | null | undefined, unidade?: string | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unidade ?? ""}`;
}

function statusColor(s: string): string {
  switch (s) {
    case "ok":
      return "#16a34a";
    case "atencao":
      return "#f59e0b";
    case "critico":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function variacaoBadge(v: number | null | undefined): string {
  if (v == null) return '<span style="color:#6b7280">—</span>';
  const cor = v >= 0 ? "#16a34a" : "#dc2626";
  const sinal = v > 0 ? "+" : "";
  return `<span style="color:${cor}; font-weight:600">${sinal}${v.toFixed(1)}%</span>`;
}

export function gerarRelatorioHTML(input: RelatorioInput): string {
  const { municipio, periodoInicio, periodoFim, populacao, kpis, alertas, scores, briefing } = input;

  const ultimoScore = scores.at(0)?.score;
  const dt = new Date().toLocaleDateString("pt-BR");

  // Agrupa KPI mais recente por (secretaria, indicador)
  const kpiMap = new Map<string, Kpi>();
  for (const k of kpis) {
    const key = `${k.secretaria_slug}::${k.indicador}`;
    if (!kpiMap.has(key)) kpiMap.set(key, k);
  }
  const kpisFinais = Array.from(kpiMap.values());

  const kpisRows = kpisFinais
    .map(
      (k) => `
      <tr>
        <td>${SECRETARIA_LABEL[k.secretaria_slug] ?? k.secretaria_slug}</td>
        <td>${k.indicador}</td>
        <td style="text-align:right; font-variant-numeric:tabular-nums">${fmt(k.valor, k.unidade)}</td>
        <td style="text-align:right">${variacaoBadge(k.variacao_pct)}</td>
        <td><span style="display:inline-block; padding:2px 8px; border-radius:999px; background:${statusColor(k.status)}20; color:${statusColor(k.status)}; font-size:11px; font-weight:600; text-transform:uppercase">${k.status}</span></td>
      </tr>`,
    )
    .join("");

  const alertasRows = alertas
    .map(
      (a) => `
      <tr>
        <td>${a.titulo}</td>
        <td>${a.tipo.replace(/_/g, " ")}</td>
        <td style="text-align:right; font-variant-numeric:tabular-nums">${a.valor_estimado ? "R$ " + a.valor_estimado.toLocaleString("pt-BR") : "—"}</td>
        <td>${a.prazo ? new Date(a.prazo).toLocaleDateString("pt-BR") : "—"}</td>
        <td>${a.status.replace(/_/g, " ")}</td>
      </tr>`,
    )
    .join("");

  const briefingHTML = briefing
    ? `
    <section class="section">
      <h2>Análise IA — Briefing executivo</h2>
      <p class="resumo">${briefing.resumo}</p>
      ${
        briefing.destaques.length
          ? `<h3>Destaques</h3><ul>${briefing.destaques.map((d) => `<li><strong>${d.titulo}</strong> — ${d.descricao}</li>`).join("")}</ul>`
          : ""
      }
      ${
        briefing.alertas.length
          ? `<h3>Pontos de atenção</h3><ul>${briefing.alertas.map((a) => `<li><strong>[${a.severidade}] ${a.titulo}</strong> — ${a.descricao}</li>`).join("")}</ul>`
          : ""
      }
      ${
        briefing.recomendacoes.length
          ? `<h3>Recomendações</h3><ul>${briefing.recomendacoes.map((r) => `<li><strong>[${r.prioridade}] ${r.titulo}</strong> — ${r.descricao}</li>`).join("")}</ul>`
          : ""
      }
    </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório Executivo — ${municipio}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111827;
    margin: 0;
    padding: 32px;
    background: #ffffff;
    line-height: 1.5;
  }
  header.cover {
    border-bottom: 3px solid #2563eb;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  header.cover .label { color: #2563eb; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  header.cover h1 { margin: 4px 0 4px; font-size: 28px; }
  header.cover p.sub { color: #6b7280; margin: 0; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .stat .k { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .v { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .section { margin-top: 28px; page-break-inside: avoid; }
  .section h2 { font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; color: #1f2937; }
  .section h3 { font-size: 13px; margin-top: 14px; margin-bottom: 4px; color: #374151; }
  .resumo { background: #f9fafb; padding: 12px 14px; border-radius: 6px; border-left: 3px solid #2563eb; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f9fafb; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #6b7280; }
  td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: 0; }
  ul { padding-left: 20px; font-size: 13px; margin: 6px 0 0; }
  li { margin-bottom: 4px; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <header class="cover">
    <p class="label">Relatório Executivo</p>
    <h1>${municipio}</h1>
    <p class="sub">Período: ${new Date(periodoInicio).toLocaleDateString("pt-BR")} a ${new Date(periodoFim).toLocaleDateString("pt-BR")} · Emitido em ${dt}</p>
  </header>

  <div class="grid">
    <div class="stat"><div class="k">População</div><div class="v">${populacao ? populacao.toLocaleString("pt-BR") : "—"}</div></div>
    <div class="stat"><div class="k">Indicadores monitorados</div><div class="v">${kpisFinais.length}</div></div>
    <div class="stat"><div class="k">Score de aprovação</div><div class="v">${ultimoScore != null ? ultimoScore.toFixed(1) + "%" : "—"}</div></div>
  </div>

  ${briefingHTML}

  <section class="section">
    <h2>Indicadores por secretaria</h2>
    ${
      kpisFinais.length
        ? `<table>
            <thead><tr><th>Secretaria</th><th>Indicador</th><th style="text-align:right">Valor</th><th style="text-align:right">Variação</th><th>Status</th></tr></thead>
            <tbody>${kpisRows}</tbody>
          </table>`
        : "<p>Sem KPIs no período.</p>"
    }
  </section>

  <section class="section">
    <h2>Captação de recursos e prazos</h2>
    ${
      alertas.length
        ? `<table>
            <thead><tr><th>Oportunidade</th><th>Tipo</th><th style="text-align:right">Valor</th><th>Prazo</th><th>Status</th></tr></thead>
            <tbody>${alertasRows}</tbody>
          </table>`
        : "<p>Sem oportunidades em aberto.</p>"
    }
  </section>

  <footer>
    Gerado por NovaeXis — Plataforma de gestão pública municipal
  </footer>
</body>
</html>`;
}
