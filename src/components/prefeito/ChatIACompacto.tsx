import { Link } from "@tanstack/react-router";
import { ChatIA } from "@/components/ChatIA";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const SUGESTOES_HOME = [
  "Resumo da semana em 3 pontos",
  "Maior risco da minha gestão agora",
  "Próximas decisões prioritárias",
];

export function ChatIACompacto() {
  return (
    <div className="space-y-2">
      <ChatIA
        endpoint="agente-prefeito"
        titulo="Assessoria IA"
        subtitulo="Pergunte algo rápido — respostas usam dados ao vivo"
        sugestoes={SUGESTOES_HOME}
        tipoConversa="prefeito"
        alturaMin="h-[420px]"
      />
      <div className="flex justify-end">
        <Link to="/prefeito/ia">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver conversa completa <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
