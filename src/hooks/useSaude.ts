import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export interface CampanhaVacinacao {
  id: string;
  nome: string;
  publico_alvo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  meta_doses: number;
  doses_aplicadas: number;
  status: "planejada" | "ativa" | "encerrada";
}

export function useSaude() {
  const { profile } = useAuth();
  const [campanhas, setCampanhas] = useState<CampanhaVacinacao[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = profile?.tenant_id;

  async function loadCampanhas() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campanhas_vacinacao")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampanhas((data || []) as CampanhaVacinacao[]);
    } catch (e) {
      console.error("Erro ao carregar campanhas:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampanhas();
  }, [tenantId]);

  return {
    campanhas,
    loading,
    reload: loadCampanhas,
  };
}
