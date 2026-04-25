/**
 * Gera protocolo no formato AAAA-COD-SEQ
 * Ex: 2025-STN-A8K2
 */
export function gerarProtocolo(tenantSlug?: string): string {
  const ano = new Date().getFullYear();
  const cod = (tenantSlug ?? "MUN").substring(0, 3).toUpperCase();
  const seq = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${ano}-${cod}-${seq}`;
}

export function traduzirStatus(status: string): string {
  const map: Record<string, string> = {
    aberta: "Aberta",
    em_analise: "Em análise",
    em_andamento: "Em andamento",
    concluida: "Concluída",
    rejeitada: "Rejeitada",
  };
  return map[status] ?? status;
}
