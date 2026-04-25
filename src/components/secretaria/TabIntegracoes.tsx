import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CardIntegrador, ModalErroIntegrador, type IntegradorItem } from "@/components/integracoes/CardIntegrador";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plug } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  tenantId: string;
  secretariaSlug: string;
}

export function TabIntegracoes({ tenantId, secretariaSlug }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<IntegradorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroModal, setErroModal] = useState<IntegradorItem | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("integradores")
        .select("id, tenant_id, secretaria_slug, nome, descricao, tipo, status, ultimo_sync, ultimo_erro, total_registros_importados")
        .eq("tenant_id", tenantId)
        .eq("secretaria_slug", secretariaSlug);
      setItems((data ?? []) as IntegradorItem[]);
      setLoading(false);
    })();
  }, [tenantId, secretariaSlug]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Plug className="mx-auto mb-2 h-8 w-8 opacity-40" />
        Nenhum conector configurado para esta secretaria.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((i) => (
        <CardIntegrador
          key={i.id}
          integrador={i}
          onVerErro={setErroModal}
          onImportar={() =>
            navigate({ to: "/prefeito/secretaria/$slug/importar", params: { slug: secretariaSlug } })
          }
        />
      ))}
      <ModalErroIntegrador integrador={erroModal} onClose={() => setErroModal(null)} />
    </div>
  );
}
