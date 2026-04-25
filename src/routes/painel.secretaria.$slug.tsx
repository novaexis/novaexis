import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Building2 } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSecretaria } from "@/hooks/useSecretaria";
import { useAuth } from "@/lib/auth-context";
import { getSecretariaMeta } from "@/lib/secretarias-municipais";
import { SecretariaShell } from "@/components/secretaria/SecretariaShell";
import { TabDemandas } from "@/components/secretaria/TabDemandas";
import { TabIndicadores } from "@/components/secretaria/TabIndicadores";
import { TabRelatorios } from "@/components/secretaria/TabRelatorios";
import { TabIntegracoes } from "@/components/secretaria/TabIntegracoes";
import { VisaoGeralPlaceholder } from "@/components/secretaria/VisaoGeralPlaceholder";
import { VisaoGeralSaude } from "@/components/secretaria/saude/VisaoGeralSaude";
import { VisaoGeralEducacao } from "@/components/secretaria/educacao/VisaoGeralEducacao";
import { VisaoGeralInfraestrutura } from "@/components/secretaria/infraestrutura/VisaoGeralInfraestrutura";
import { VisaoGeralSeguranca } from "@/components/secretaria/seguranca/VisaoGeralSeguranca";
import { VisaoGeralFinancas } from "@/components/secretaria/financas/VisaoGeralFinancas";
import { VisaoGeralAssistencia } from "@/components/secretaria/assistencia/VisaoGeralAssistencia";

export const Route = createFileRoute("/painel/secretaria/$slug")({
  head: ({ params }) => {
    const meta = getSecretariaMeta(params.slug);
    const nome = meta?.nome ?? params.slug;
    return {
      meta: [
        { title: `${nome} — Painel Municipal — NovaeXis` },
        {
          name: "description",
          content: `Indicadores, demandas e relatórios da Secretaria de ${nome}.`,
        },
      ],
    };
  },
  component: SecretariaMunicipalPage,
});

function SecretariaMunicipalPage() {
  const { slug } = Route.useParams();
  const meta = getSecretariaMeta(slug);

  if (!meta) {
    return (
      <RoleGuard
        allowed={["prefeito", "secretario", "superadmin"]}
        title="Secretaria não encontrada"
      >
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card className="p-8 text-center">
            <h1 className="text-xl font-semibold">Secretaria não reconhecida</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O slug "{slug}" não corresponde a nenhuma secretaria municipal cadastrada.
            </p>
            <Link to="/prefeito" className="mt-4 inline-block">
              <Button variant="outline">Voltar ao painel</Button>
            </Link>
          </Card>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard
      allowed={["prefeito", "secretario", "superadmin"]}
      title={meta.nomeCompleto}
      subtitle="Painel setorial municipal"
    >
      <SecretariaContent slug={slug} />
    </RoleGuard>
  );
}

function SecretariaContent({ slug }: { slug: string }) {
  const meta = getSecretariaMeta(slug)!;
  const { profile, roles, primaryRole } = useAuth();
  const navigate = useNavigate();
  const { secretaria, kpis, demandas, loading, error, reload, canEdit } =
    useSecretaria(slug);
  const tenantId = profile?.tenant_id ?? null;

  // Guarda extra: se for secretário de outra pasta, redireciona
  const secretarioRole = roles.find((r) => r.role === "secretario");
  const acessoNegado =
    primaryRole === "secretario" && secretarioRole?.secretaria_slug !== slug;

  useEffect(() => {
    if (acessoNegado) {
      void navigate({ to: "/secretaria" });
    }
  }, [acessoNegado, navigate]);

  if (acessoNegado) return null;

  const ultimaAtualizacao =
    demandas[0]?.updated_at ?? kpis[0]?.referencia_data ?? null;

  return (
    <SecretariaShell
      icon={meta.icon}
      nome={meta.nomeCompleto}
      secretarioNome={secretaria?.secretario_nome}
      ultimaAtualizacao={ultimaAtualizacao}
      loading={loading}
      error={error}
      onRetry={reload}
      visaoGeral={
        slug === "saude" ? (
          <VisaoGeralSaude kpis={kpis} />
        ) : slug === "educacao" ? (
          <VisaoGeralEducacao kpis={kpis} />
        ) : slug === "infraestrutura" ? (
          <VisaoGeralInfraestrutura kpis={kpis} />
        ) : slug === "seguranca" ? (
          <VisaoGeralSeguranca kpis={kpis} />
        ) : slug === "financas" ? (
          <VisaoGeralFinancas kpis={kpis} />
        ) : slug === "assistencia" ? (
          <VisaoGeralAssistencia kpis={kpis} />
        ) : (
          <VisaoGeralPlaceholder kpis={kpis} nome={meta.nome} />
        )
      }
      demandas={
        <TabDemandas demandas={demandas} canEdit={canEdit} onChanged={reload} />
      }
      indicadores={<TabIndicadores kpis={kpis} />}
      relatorios={
        <TabRelatorios slug={slug} nomeSecretaria={meta.nome} canEdit={canEdit} />
      }
      integracoes={
        tenantId ? (
          <TabIntegracoes tenantId={tenantId} secretariaSlug={slug} />
        ) : undefined
      }
      assessoriaIA={
        <TabAssessoriaIA secretariaSlug={slug} nomeSecretaria={meta.nome} />
      }
    />
  );
}
