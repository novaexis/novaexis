import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { TabelaMunicipios } from "@/components/governador/TabelaMunicipios";

export const Route = createFileRoute("/governador/municipios")({
  head: () => ({
    meta: [{ title: "Situação dos Municípios — Governador — NovaeXis" }],
  }),
  component: () => (
    <RoleGuard
      allowed={["governador", "superadmin"]}
      title="Situação dos Municípios"
      subtitle="Visão operacional"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Municípios Aderentes ao NovaeXis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada apenas com dados agregados — nenhum dado pessoal de cidadão.
          </p>
        </div>
        <TabelaMunicipios />
      </div>
    </RoleGuard>
  ),
});
