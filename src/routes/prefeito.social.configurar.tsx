import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/prefeito/social/configurar")({
  head: () => ({ meta: [{ title: "Configurar fontes — Social Intelligence — NovaeXis" }] }),
  component: ConfigurarFontes,
});

interface Fonte {
  id: string;
  plataforma: string;
  identificador: string;
  nome_exibicao: string | null;
  ativo: boolean;
  ultimo_sync: string | null;
  ultimo_erro: string | null;
}

const PLATAFORMAS_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X / Twitter",
  google_maps: "Google Maps",
  noticias: "Notícias (RSS)",
  youtube: "YouTube",
  tiktok: "TikTok",
};

function ConfigurarFontes() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [loading, setLoading] = useState(true);
  const [coletando, setColetando] = useState(false);
  const [fontes, setFontes] = useState<Fonte[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fontes_monitoramento")
      .select("id, plataforma, identificador, nome_exibicao, ativo, ultimo_sync, ultimo_erro")
      .eq("tenant_id", tenantId)
      .order("plataforma");
    if (error) toast.error("Erro ao carregar fontes");
    setFontes((data ?? []) as Fonte[]);
    setLoading(false);
  }

  function update(id: string, patch: Partial<Fonte>) {
    setFontes((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function salvar(f: Fonte) {
    const { error } = await supabase
      .from("fontes_monitoramento")
      .update({
        identificador: f.identificador,
        nome_exibicao: f.nome_exibicao,
        ativo: f.ativo,
      })
      .eq("id", f.id);
    if (error) toast.error("Falha ao salvar");
    else toast.success(`${PLATAFORMAS_LABEL[f.plataforma]} atualizado`);
  }

  async function rodarColeta() {
    if (!tenantId) return;
    setColetando(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-intel-coletor", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      const stats = (data as { stats?: { coletadas?: number; falhas?: number }; inseridas?: number }) ?? {};
      toast.success(
        `Coleta concluída — ${stats.inseridas ?? 0} novas, ${stats.stats?.falhas ?? 0} falhas`,
      );
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao executar coleta");
    } finally {
      setColetando(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/prefeito/social" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Configurar fontes de monitoramento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina quais perfis e portais devem ser monitorados pela inteligência social.
          </p>
        </div>
        <Button onClick={rodarColeta} disabled={coletando}>
          {coletando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Rodar coleta agora
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : fontes.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma fonte cadastrada.
        </p>
      ) : (
        <ul className="space-y-3">
          {fontes.map((f) => (
            <li key={f.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{PLATAFORMAS_LABEL[f.plataforma] ?? f.plataforma}</p>
                  {f.ultimo_sync && (
                    <p className="text-xs text-muted-foreground">
                      Último sync: {new Date(f.ultimo_sync).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {f.ultimo_erro && (
                    <p className="mt-0.5 text-xs text-destructive">Erro: {f.ultimo_erro}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{f.ativo ? "Ativo" : "Pausado"}</span>
                  <Switch checked={f.ativo} onCheckedChange={(v) => update(f.id, { ativo: v })} />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Identificador</label>
                  <Input
                    value={f.identificador}
                    onChange={(e) => update(f.id, { identificador: e.target.value })}
                    placeholder={f.plataforma === "noticias" ? "https://exemplo.com.br/feed" : "@usuario"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome de exibição</label>
                  <Input
                    value={f.nome_exibicao ?? ""}
                    onChange={(e) => update(f.id, { nome_exibicao: e.target.value })}
                    placeholder="Ex: Prefeitura no Instagram"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => void salvar(f)}>
                  <Save className="mr-2 h-3.5 w-3.5" /> Salvar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
