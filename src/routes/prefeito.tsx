import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { PrefeitoLayoutShell } from "@/components/prefeito/AppSidebarPrefeito";

export const Route = createFileRoute("/prefeito")({
  head: () => ({ meta: [{ title: "Painel do Prefeito — NovaeXis" }] }),
  component: PrefeitoLayoutRoute,
});

function PrefeitoLayoutRoute() {
  return (
    <RoleGuard
      allowed={["prefeito", "superadmin"]}
      title="Painel do Prefeito"
      subtitle="Visão executiva 360°"
    >
      <PrefeitoShellWithData />
    </RoleGuard>
  );
}

function PrefeitoShellWithData() {
  const { profile } = useAuth();
  const [tenantNome, setTenantNome] = useState<string>();

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void (async () => {
      const { data } = await supabase
        .from("tenants")
        .select("nome")
        .eq("id", profile.tenant_id)
        .maybeSingle();
      if (data) setTenantNome(data.nome);
    })();
  }, [profile?.tenant_id]);

  return (
    <PrefeitoLayoutShell tenantNome={tenantNome} prefeitoNome={profile?.nome ?? undefined}>
      <Outlet />
    </PrefeitoLayoutShell>
  );
}
