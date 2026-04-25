import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Calendar
} from "lucide-react";
import { KPISecretaria } from "@/hooks/useSecretaria";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VisaoGeralFinancasProps {
  kpis: KPISecretaria[];
}

export function VisaoGeralFinancas({ kpis }: VisaoGeralFinancasProps) {
  // Busca repasses recentes
  const { data: repasses, isLoading: isLoadingRepasses } = useQuery({
    queryKey: ["repasses-municipais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repasses_municipais")
        .select("*")
        .order("data_credito", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoadingRepasses) {
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

  const saldoDisponivel = kpis?.find(k => k.indicador.includes("Disponível"))?.valor || 4500000;
  const arrecadacaoMes = kpis?.find(k => k.indicador.includes("Arrecadação"))?.valor || 1200000;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cards de KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo em Caixa</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(saldoDisponivel / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              +2.4% vs. mês ant.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Arrecadação Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(arrecadacaoMes / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">Meta: R$ 1.5M</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Empenhadas</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 850k</div>
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              +5% projeção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice LRF</CardTitle>
            <PieChart className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">48.2%</div>
            <p className="text-xs text-emerald-500">Abaixo do limite prudencial</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Últimos Repasses (FPM, ICMS, etc) */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-500" />
              Entradas Recentes e Repasses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {repasses?.map((rp) => (
                <div key={rp.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <ArrowDownRight className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{rp.fonte}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="mr-1 h-3 w-3" />
                        {new Date(rp.data_credito || "").toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">R$ {Number(rp.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <Badge variant="outline" className="text-[10px] h-4">Referência: {rp.competencia}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status de Pagamentos */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Calendário de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">Folha de Pagamento</h4>
              <p className="text-xs text-emerald-600 mb-2">Programada para o dia 30/04</p>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-emerald-600 font-medium">Provisionado: 100%</span>
                <Badge className="bg-emerald-500 text-white border-none">R$ 2.4M</Badge>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-sm font-semibold text-blue-700 mb-1">Fornecedores</h4>
              <p className="text-xs text-blue-600 mb-2">Processamento de NFs da semana</p>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-blue-600 font-medium">Lotes: 12</span>
                <Badge className="bg-blue-500 text-white border-none">R$ 156k</Badge>
              </div>
            </div>

            <div className="p-3 rounded-lg border">
              <h4 className="text-sm font-semibold mb-2">Dívida Consolidada</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Precatórios</span>
                  <span className="font-medium">R$ 1.2M</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Empréstimos</span>
                  <span className="font-medium text-amber-500">R$ 450k/ano</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
