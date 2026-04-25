import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ChatIA } from "@/components/ChatIA";
import { PrefeitoLayoutShell } from "@/components/prefeito/AppSidebarPrefeito";

export const Route = createFileRoute("/prefeito/ia")({
  head: () => ({
    meta: [{ title: "IA Estratégica — Prefeito — NovaeXis" }],
  }),
  component: IAEstrategicaPage,
});

const SUGESTOES = [
  "O que devo priorizar esta semana?",
  "Qual secretaria precisa de mais atenção?",
  "Quais recursos posso captar agora?",
  "Como está minha gestão comparada a municípios similares?",
  "O que a população está falando de mim?",
];

function IAEstrategicaPage() {
  const { profile } = useAuth();
  const [tenantNome, setTenantNome] = useState<string>("");

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void supabase
      .from("tenants")
      .select("nome")
      .eq("id", profile.tenant_id)
      .single()
      .then(({ data }) => setTenantNome(data?.nome || ""));
  }, [profile?.tenant_id]);

  return (
    <PrefeitoLayoutShell tenantNome={tenantNome} prefeitoNome={profile?.nome ?? undefined}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Assessoria Estratégica IA</h1>
          <p className="text-sm text-muted-foreground">
            Contexto: dados dos últimos 30 dias de {tenantNome || "seu município"}
          </p>
        </div>

        <ChatIA
          endpoint="agente-prefeito"
          titulo="Conversa com o assessor IA"
          subtitulo="Respostas baseadas em KPIs, alertas, insights e reputação atualizados"
          sugestoes={SUGESTOES}
          tipoConversa="prefeito"
          alturaMin="h-[calc(100vh-220px)] min-h-[520px]"
        />
      </div>
    </PrefeitoLayoutShell>
  );
}
