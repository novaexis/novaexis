import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Database, Users, Building2, FileBarChart, CreditCard, Activity, Handshake, Sliders, Briefcase, Plug } from "lucide-react";
import { MunicipiosManager } from "@/components/admin/MunicipiosManager";
import { UsuariosManager } from "@/components/admin/UsuariosManager";
import { BillingManager } from "@/components/admin/BillingManager";
import { AuditLogsManager } from "@/components/admin/AuditLogsManager";
import { ResellersManager } from "@/components/admin/ResellersManager";
import { ConfigGlobaisManager } from "@/components/admin/ConfigGlobaisManager";
import { CRMLeadsManager } from "@/components/admin/CRMLeadsManager";
import { IntegracoesManager } from "@/components/admin/IntegracoesManager";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — NovaeXis" }] }),
  component: () => (
    <RoleGuard
      allowed={["superadmin"]}
      title="SaaS Admin"
      subtitle="Gestão da plataforma NovaeXis"
    >
      <AdminPanel />
    </RoleGuard>
  ),
});

function AdminPanel() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">SaaS Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle global da plataforma NovaeXis
        </p>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <FileBarChart className="h-4 w-4" /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="municipios" className="gap-2">
            <Building2 className="h-4 w-4" /> Municípios
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" /> Billing
          </TabsTrigger>
          <TabsTrigger value="resellers" className="gap-2">
            <Handshake className="h-4 w-4" /> Resellers
          </TabsTrigger>
          <TabsTrigger value="crm" className="gap-2">
            <Briefcase className="h-4 w-4" /> CRM
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2">
            <Activity className="h-4 w-4" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-2">
            <Plug className="h-4 w-4" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Sliders className="h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="municipios" className="mt-5">
          <MunicipiosManager />
        </TabsContent>

        <TabsContent value="usuarios" className="mt-5">
          <UsuariosManager />
        </TabsContent>

        <TabsContent value="billing" className="mt-5">
          <BillingManager />
        </TabsContent>

        <TabsContent value="resellers" className="mt-5">
          <ResellersManager />
        </TabsContent>

        <TabsContent value="crm" className="mt-5">
          <CRMLeadsManager />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-5">
          <AuditLogsManager />
        </TabsContent>

        <TabsContent value="config" className="mt-5">
          <ConfigGlobaisManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState({ tenants: 0, users: 0, demandas: 0 });
  const [seeding, setSeeding] = useState(false);
  const [demoPassword, setDemoPassword] = useState<string | null>(null);

  useEffect(() => {
    void loadStats();
  }, []);

  async function loadStats() {
    const [t, u, d] = await Promise.all([
      supabase.from("tenants").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("demandas").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      tenants: t.count ?? 0,
      users: u.count ?? 0,
      demandas: d.count ?? 0,
    });
  }

  async function runSeed() {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo", {});
      if (error) throw error;
      toast.success(
        `Seed concluído: ${data?.tenants ?? 0} municípios, ${data?.demandas ?? 0} demandas.`,
      );
      if (data?.demoPassword) setDemoPassword(data.demoPassword);
      await loadStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar seed");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <Database className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">Tenants</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">{stats.tenants}</p>
        </Card>
        <Card className="p-4">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">Usuários</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">{stats.users}</p>
        </Card>
        <Card className="p-4">
          <Database className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase text-muted-foreground">Demandas</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">{stats.demandas}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Seed de demonstração</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cria 3 municípios fictícios do Pará (Santarinho do Norte, Marajoense, Nova Belém
          do Tapajós) com secretarias, demandas, KPIs e alertas. Pode ser executado várias
          vezes (idempotente). Cada execução gera uma nova senha aleatória para os
          usuários demo.
        </p>
        <Button onClick={runSeed} disabled={seeding} className="mt-4">
          {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {seeding ? "Executando…" : "Executar seed"}
        </Button>

        {demoPassword && (
          <div className="mt-5 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            <p className="mb-2 font-semibold text-foreground">
              Senha desta execução (copie agora — não será exibida novamente após sair):
            </p>
            <code className="block break-all rounded bg-background px-2 py-1 font-mono text-sm">
              {demoPassword}
            </code>
            <p className="mt-2 text-muted-foreground">
              Use com os emails dos usuários demo (prefeito@…, secretario.saude@…,
              cidadao@…, governador@pa.gov.br).
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
