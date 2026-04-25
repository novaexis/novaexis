import { ChatIA } from "@/components/ChatIA";

interface TabAssessoriaIAProps {
  secretariaSlug: string;
  nomeSecretaria: string;
}

const SUGESTOES_POR_SECRETARIA: Record<string, string[]> = {
  saude: [
    "Como melhorar a cobertura de atenção básica?",
    "Qual UBS tem maior demanda reprimida?",
    "Como aumentar a taxa de comparecimento?",
  ],
  educacao: [
    "Como reduzir a evasão escolar?",
    "Quais escolas estão com frequência abaixo da meta?",
    "Como otimizar a distribuição de vagas?",
  ],
  financas: [
    "Estamos dentro dos limites da LRF?",
    "Qual a previsão de execução orçamentária?",
    "Quais repasses estão pendentes?",
  ],
  infraestrutura: [
    "Quais contratos correm risco de vencer sem conclusão?",
    "Quais bairros têm mais demandas abertas?",
    "Como priorizar as ordens de serviço?",
  ],
  seguranca: [
    "Quais bairros têm mais ocorrências este mês?",
    "Há padrão nas demandas urgentes do app?",
    "Como distribuir melhor o efetivo?",
  ],
  assistencia: [
    "Quais famílias precisam de visita urgente?",
    "Como aumentar a cobertura do CadÚnico?",
    "Há famílias com vulnerabilidade múltipla?",
  ],
  assistencia_social: [
    "Quais famílias precisam de visita urgente?",
    "Como aumentar a cobertura do CadÚnico?",
    "Há famílias com vulnerabilidade múltipla?",
  ],
};

export function TabAssessoriaIA({ secretariaSlug, nomeSecretaria }: TabAssessoriaIAProps) {
  const sugestoes = SUGESTOES_POR_SECRETARIA[secretariaSlug] || [
    "Quais são meus principais riscos hoje?",
    "Onde posso melhorar a execução?",
    "Quais demandas devo priorizar?",
  ];
  return (
    <ChatIA
      endpoint="agente-secretario"
      titulo={`Assessoria IA — ${nomeSecretaria}`}
      subtitulo="Respostas com base nos KPIs e demandas da sua secretaria"
      sugestoes={sugestoes}
      secretariaSlug={secretariaSlug}
      tipoConversa="secretario"
      alturaMin="h-[600px]"
    />
  );
}
