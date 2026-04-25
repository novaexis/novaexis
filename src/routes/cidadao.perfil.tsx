import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CidadaoBottomNav } from "@/components/cidadao/CidadaoBottomNav";
import { Loader2, LogOut, Gift, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cidadao/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — App do Cidadão NovaeXis" },
      { name: "description", content: "Seu perfil e benefícios municipais e federais." },
    ],
  }),
  component: () => (
    <RoleGuard allowed={["cidadao", "superadmin"]} title="Perfil" subtitle="Conta e benefícios">
      <PerfilPage />
      <CidadaoBottomNav />
    </RoleGuard>
  ),
});

interface Beneficio { id: string; nome: string; descricao: string | null; criterios: string | null }

const PROGRAMAS_FEDERAIS = [
  { nome: "Bolsa Família", desc: "Transferência de renda para famílias em vulnerabilidade.", url: "https://www.gov.br/mds/pt-br/acoes-e-programas/bolsa-familia" },
  { nome: "BPC", desc: "Benefício de Prestação Continuada para idosos e pessoas com deficiência.", url: "https://www.gov.br/inss/pt-br/saiba-mais/auxilios/bpc" },
  { nome: "Auxílio Gás", desc: "Auxílio para compra de botijão de gás.", url: "https://www.gov.br/mds/pt-br/acoes-e-programas/auxilio-gas-dos-brasileiros" },
];

function PerfilPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void (async () => {
      const { data } = await supabase
        .from("beneficios_municipais")
        .select("id, nome, descricao, criterios")
        .eq("tenant_id", profile.tenant_id!)
        .eq("ativo", true);
      setBeneficios((data ?? []) as Beneficio[]);
      setLoading(false);
    })();
  }, [profile?.tenant_id]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <Card className="mb-5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
            {profile?.nome?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold">{profile?.nome ?? "Cidadão"}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>
      </Card>

      <section className="mb-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Benefícios municipais
        </h2>
        {loading ? (
          <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : beneficios.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">Nenhum benefício cadastrado.</Card>
        ) : (
          <ul className="space-y-2">
            {beneficios.map((b) => (
              <li key={b.id}>
                <Card className="flex gap-3 p-4">
                  <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{b.nome}</p>
                    {b.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{b.descricao}</p>}
                    {b.criterios && (
                      <p className="mt-1.5 rounded bg-muted/40 p-2 text-xs">
                        <strong>Critérios:</strong> {b.criterios}
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Programas federais
        </h2>
        <Card className="mb-2 p-4 text-sm">
          Para consultar e solicitar benefícios federais, acesse o portal Gov.br.
        </Card>
        <ul className="space-y-2">
          {PROGRAMAS_FEDERAIS.map((p) => (
            <li key={p.nome}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <Card className="flex items-center gap-3 p-3.5 hover:shadow-md">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.nome}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Card>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          await signOut();
          toast.success("Sessão encerrada");
          navigate({ to: "/login" });
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>

      <p className="mt-6 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        ✨ Próximo ciclo: histórico completo, configurações de notificação, integração Gov.br real e modo offline com IndexedDB.
      </p>
    </div>
  );
}
