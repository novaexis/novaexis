import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Construction, 
  MapPin, 
  Clock, 
  HardHat, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap
} from "lucide-react";
import { useSecretaria, KPISecretaria } from "@/hooks/useSecretaria";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VisaoGeralInfraestruturaProps {
  kpis: KPISecretaria[];
}

export function VisaoGeralInfraestrutura({ kpis }: VisaoGeralInfraestruturaProps) {
  const { loading } = useSecretaria("infraestrutura");

  // Busca dados de contratos de obras
  const { data: obras, isLoading: isLoadingObras } = useQuery({
    queryKey: ["contratos-obras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_obras")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data;
    },
  });

  if (loading || isLoadingObras) {
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
            <CardTitle className="text-sm font-medium">Obras em Andamento</CardTitle>
            <Construction className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.find(k => k.indicador.includes("Andamento"))?.valor || "12"}</div>
            <p className="text-xs text-muted-foreground">+2 iniciadas este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 14.2M</div>
            <p className="text-xs text-muted-foreground">85% do orçamento empenhado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipes em Campo</CardTitle>
            <HardHat className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">08</div>
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Todas operacionais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Atraso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">03</div>
            <p className="text-xs text-rose-500">Requer atenção imediata</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Lista de Obras Prioritárias */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Acompanhamento de Obras Críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {obras?.map((obra) => {
                const progresso = Math.round(((obra.valor_executado || 0) / (obra.valor_total || 1)) * 100);
                return (
                  <div key={obra.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{obra.descricao}</p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <MapPin className="mr-1 h-3 w-3" />
                          {obra.bairro || "Diversos"}
                        </div>
                      </div>
                      <Badge variant={progresso > 80 ? "outline" : "secondary"}>
                        {progresso}%
                      </Badge>
                    </div>
                    <Progress value={progresso} className="h-2" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 
                        Prev. Entrega: {new Date(obra.data_fim_prevista || "").toLocaleDateString()}
                      </span>
                      <span>R$ {(Number(obra.valor_total) / 1000000).toFixed(1)}M</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
... keep existing code

        {/* Status de Manutenção Urbana */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Manutenção Urbana</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Iluminação Pública</span>
                <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                  92% OK
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted p-2 rounded">
                  <p className="text-muted-foreground">Chamados</p>
                  <p className="font-bold">45</p>
                </div>
                <div className="bg-muted p-2 rounded">
                  <p className="text-muted-foreground">Resolvidos</p>
                  <p className="font-bold text-emerald-500">38</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Operação Tapa-Buraco</span>
                <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                  Em Execução
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Foco atual: Bairros Centro e Vila Nova. 3 frentes ativas.
              </p>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Limpeza de Bueiros</span>
                <Badge variant="secondary">Preventivo</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Meta semestral: 65% concluída
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
