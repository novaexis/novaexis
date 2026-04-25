import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/secretaria")({
  head: () => ({ meta: [{ title: "Painel da Secretaria — NovaeXis" }] }),
  component: () => (
    <RoleGuard
      allowed={["secretario", "superadmin"]}
      title="Painel da Secretaria"
      subtitle="Demandas e indicadores setoriais"
    >
      <RedirectToSlug />
    </RoleGuard>
  ),
});

function RedirectToSlug() {
  const { roles, primaryRole, loading } = useAuth();
  const slug = roles.find((r) => r.role === "secretario")?.secretaria_slug;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (primaryRole === "secretario" && slug) {
    return <Navigate to="/painel/secretaria/$slug" params={{ slug }} replace />;
  }

  if (primaryRole === "superadmin") {
    return <Navigate to="/painel/secretaria/$slug" params={{ slug: "saude" }} replace />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-semibold">Secretaria não atribuída</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta não tem uma secretaria vinculada. Procure o prefeito ou administrador.
        </p>
      </Card>
    </div>
  );
}
