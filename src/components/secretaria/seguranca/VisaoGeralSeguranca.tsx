import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2,
  Phone,
  Siren,
  BarChart3,
  Users
} from "lucide-react";
import { KPISecretaria } from "@/hooks/useSecretaria";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VisaoGeralSegurancaProps {
  kpis: KPISecretaria[];
}

export function VisaoGeralSeguranca({ kpis }: VisaoGeralSegurancaProps) {
  // Busca ocorrências recentes
  const { data: ocorrencias, isLoading: isLoadingOcorrencias } = useQuery({
    queryKey: ["ocorrencias-seguranca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocorrencias_seguranca")
        .select("*")
        .order("data_hora", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoadingOcorrencias) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cards de KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio Resposta</CardTitle>
            <Siren className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">08:45 min</div>
            <p className="text-xs text-emerald-500">-12% vs. mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Viaturas Operacionais</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14 / 15</div>
            <p className="text-xs text-muted-foreground">1 em manutenção preventiva</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chamados (24h)</CardTitle>
            <Phone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">32</div>
            <p className="text-xs text-amber-500">Volume alto no Centro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Resolutividade</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-muted-foreground">Ocorrências finalizadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Mapa de Calor / Ocorrências Recentes */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Monitoramento de Ocorrências em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ocorrencias?.map((oc) => (
                <div key={oc.id} className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{oc.tipo}</span>
                      <Badge variant={oc.status === "Em andamento" ? "default" : "secondary"} className="text-[10px] h-4">
                        {oc.status}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <MapPin className="mr-1 h-3 w-3" />
                      {oc.bairro || "Local não informado"}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground">
                    {new Date(oc.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {ocorrencias?.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-8">Nenhuma ocorrência registrada nas últimas horas.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gestão de Efetivo */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Gestão de Efetivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Guardas Civis Ativos</span>
                <span className="font-bold">42</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Em Patrulhamento</span>
                <span className="font-bold text-emerald-500">28</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Monitoramento (CCO)</span>
                <span className="font-bold text-blue-500">06</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Administrativo</span>
                <span className="font-bold text-muted-foreground">08</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Zonas de Patrulha Críticas</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Setor 01 (Centro)</span>
                  <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20">Alta Prioridade</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Setor 04 (Parques)</span>
                  <Badge variant="outline">Normal</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
