import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  aberta: "aberta",
  em_analise: "em análise",
  em_andamento: "em andamento",
  concluida: "concluída",
  rejeitada: "rejeitada",
};

/**
 * Escuta atualizações de status nas demandas do cidadão e dispara
 * notificações nativas (quando autorizadas) + toasts no app.
 *
 * Solicita permissão de notificação no primeiro mount (uma vez).
 */
export function usePushNotifications(userId: string | undefined) {
  const askedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    // Pede permissão uma única vez por sessão
    if (
      !askedRef.current &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      askedRef.current = true;
      // pequeno delay para não atrapalhar o paint inicial
      setTimeout(() => {
        void Notification.requestPermission().catch(() => {});
      }, 1500);
    }

    const channel = supabase
      .channel(`demandas-cidadao-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demandas",
          filter: `cidadao_id=eq.${userId}`,
        },
        (payload) => {
          const novo = payload.new as { protocolo?: string; status?: string };
          const status = STATUS_LABELS[novo.status ?? ""] ?? novo.status ?? "";
          const titulo = "Atualização na sua solicitação";
          const corpo = `Protocolo ${novo.protocolo ?? "—"}: ${status}`;

          toast.info(titulo, { description: corpo });

          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(titulo, {
                body: corpo,
                icon: "/favicon.ico",
                tag: `demanda-${novo.protocolo}`,
              });
            } catch {
              // ignora — alguns browsers exigem service worker
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
