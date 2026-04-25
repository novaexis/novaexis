import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  HandHeart, 
  Users, 
  Home, 
  Heart,
  Calendar,
  AlertCircle,
  Clock,
  MapPin
} from "lucide-react";
import { KPISecretaria } from "@/hooks/useSecretaria";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VisaoGeralAssistenciaProps {
  kpis: KPISecretaria[];
}

export function VisaoGeralAssistencia({ kpis }: VisaoGeralAssistenciaProps) {
  // Busca atendimentos recentes
  const { data: atendimentos, isLoading: isLoadingAtendimentos } = useQuery({
    queryKey: ["atendimentos-cras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_cras")
        .select("*")
        .order("data_atendimento", { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoadingAtendimentos) {
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
            <CardTitle className="text-sm font-medium">Famílias em Acomp.</CardTitle>
            <Home className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.find(k => k.indicador.includes("Acompanhamento"))?.valor || "1.240"}</div>
            <p className="text-xs text-muted-foreground">+12 novas famílias/mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos CRAS</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342</div>
            <p className="text-xs text-emerald-500">85% agendados online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CadÚnico Atualizado</CardTitle>
            <Heart className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">Dentro do prazo legal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benefícios Ativos</CardTitle>
            <HandHeart className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 450k</div>
            <p className="text-xs text-muted-foreground">Repasse municipal direto</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Atendimentos Recentes */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Plantão Social e Atendimentos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {atendimentos?.map((at) => (
                <div key={at.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{at.tipo_atendimento}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <MapPin className="mr-1 h-3 w-3" />
                        {at.unidade_atendimento}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={at.status === "Concluído" ? "outline" : "default"} className="text-[10px] h-4">
                      {at.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(at.data_atendimento).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas e Demandas Reprimidas */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Alertas Socioassistenciais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 bg-amber-500/5 border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">Visitas Técnicas Pendentes</span>
              </div>
              <p className="text-xs text-amber-800">14 famílias aguardando primeira visita (SLA: 48h).</p>
            </div>

            <div className="rounded-lg border p-3">
              <h4 className="text-sm font-semibold mb-3">Distribuição CRAS</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span>CRAS Central</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="w-[80%] h-full bg-purple-500" />
                    </div>
                    <span className="font-medium">80%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>CRAS Norte</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="w-[45%] h-full bg-purple-500" />
                    </div>
                    <span className="font-medium">45%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>CRAS Sul</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="w-[95%] h-full bg-rose-500" />
                    </div>
                    <span className="font-medium text-rose-600">95%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
