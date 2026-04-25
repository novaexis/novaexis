import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export interface SecretariaData {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
  secretario_id: string | null;
  secretario_nome?: string | null;
}

export interface KPISecretaria {
  id: string;
  indicador: string;
  valor: number;
  unidade: string | null;
  variacao_pct: number | null;
  status: "ok" | "atencao" | "critico";
  referencia_data: string;
  fonte: string | null;
  secretaria_slug: string;
}

export interface DemandaSecretaria {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  endereco: string | null;
  prazo_sla: string | null;
  created_at: string;
  updated_at: string;
  cidadao_id: string | null;
  secretaria_slug: string;
  cidadao_nome?: string | null;
}

interface UseSecretariaResult {
  secretaria: SecretariaData | null;
  kpis: KPISecretaria[];
  demandas: DemandaSecretaria[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  canEdit: boolean;
}

export function useSecretaria(slug: string): UseSecretariaResult {
  const { profile, roles, primaryRole } = useAuth();
  const [secretaria, setSecretaria] = useState<SecretariaData | null>(null);
  const [kpis, setKpis] = useState<KPISecretaria[]>([]);
  const [demandas, setDemandas] = useState<DemandaSecretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = profile?.tenant_id ?? null;
  const secretarioRole = roles.find((r) => r.role === "secretario");
  const isSecretarioOutroSlug =
    primaryRole === "secretario" && secretarioRole?.secretaria_slug !== slug;

  const canEdit =
    primaryRole === "superadmin" ||
    primaryRole === "prefeito" ||
    (primaryRole === "secretario" && secretarioRole?.secretaria_slug === slug);

  async function load() {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    if (isSecretarioOutroSlug) {
      setError("Você não tem acesso a esta secretaria.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [secRes, kpisRes, demandasRes] = await Promise.all([
        supabase
          .from("secretarias")
          .select("id, slug, nome, ativo, secretario_id")
          .eq("tenant_id", tenantId)
          .eq("slug", slug)
          .maybeSingle(),
        supabase
          .from("kpis")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("secretaria_slug", slug)
          .order("referencia_data", { ascending: false })
          .limit(200),
        supabase
          .from("demandas")
          .select(
            "id, protocolo, titulo, descricao, tipo, status, prioridade, endereco, prazo_sla, created_at, updated_at, cidadao_id, secretaria_slug",
          )
          .eq("tenant_id", tenantId)
          .eq("secretaria_slug", slug)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (secRes.error) throw secRes.error;
      if (kpisRes.error) throw kpisRes.error;
      if (demandasRes.error) throw demandasRes.error;

      let secretarioNome: string | null = null;
      if (secRes.data?.secretario_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", secRes.data.secretario_id)
          .maybeSingle();
        secretarioNome = prof?.nome ?? null;
      }

      setSecretaria(
        secRes.data
          ? { ...secRes.data, secretario_nome: secretarioNome }
          : null,
      );
      setKpis((kpisRes.data ?? []) as KPISecretaria[]);

      const demandasData = (demandasRes.data ?? []) as DemandaSecretaria[];
      const cidadaoIds = Array.from(
        new Set(demandasData.map((d) => d.cidadao_id).filter(Boolean) as string[]),
      );
      let nomesById = new Map<string, string>();
      if (cidadaoIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", cidadaoIds);
        nomesById = new Map((profs ?? []).map((p) => [p.id, p.nome ?? "—"]));
      }
      setDemandas(
        demandasData.map((d) => ({
          ...d,
          cidadao_nome: d.cidadao_id ? (nomesById.get(d.cidadao_id) ?? "—") : "Anônimo",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, slug]);

  return {
    secretaria,
    kpis,
    demandas,
    loading,
    error,
    reload: load,
    canEdit,
  };
}
