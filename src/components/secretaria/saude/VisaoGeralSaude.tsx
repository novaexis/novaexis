import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Syringe, 
  Stethoscope, 
  AlertTriangle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock
} from "lucide-react";
import { type KPISecretaria } from "@/hooks/useSecretaria";
import { useSaude } from "@/hooks/useSaude";
import { cn } from "@/lib/utils";

interface VisaoGeralSaudeProps {
  kpis: KPISecretaria[];
}

export function VisaoGeralSaude({ kpis }: VisaoGeralSaudeProps) {
  const { campanhas, loading } = useSaude();

  // Encontrar KPIs específicos
  const kpiAtendimentos = kpis.find(k => k.indicador.toLowerCase().includes("atendimento"));
  const kpiVacinacao = kpis.find(k => k.indicador.toLowerCase().includes("vacina"));
  const kpiMedicos = kpis.find(k => k.indicador.toLowerCase().includes("médico") || k.indicador.toLowerCase().includes("medico"));
  const kpiMedicamentos = kpis.find(k => k.indicador.toLowerCase().includes("medicamento") || k.indicador.toLowerCase().includes("falta"));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "text-emerald-500";
      case "atencao": return "text-amber-500";
      case "critico": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Grid de KPIs principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard 
          title="Atendimentos (Mês)" 
          value={kpiAtendimentos?.valor?.toLocaleString("pt-BR") || "0"}
          variation={kpiAtendimentos?.variacao_pct}
          icon={Users}
          status={kpiAtendimentos?.status}
          unit={kpiAtendimentos?.unidade}
        />
        <KPICard 
          title="Vacinação Geral" 
          value={`${kpiVacinacao?.valor || 0}%`}
          variation={kpiVacinacao?.variacao_pct}
          icon={Syringe}
          status={kpiVacinacao?.status}
          unit={kpiVacinacao?.unidade}
        />
        <KPICard 
          title="Médicos de Plantão" 
          value={kpiMedicos?.valor?.toString() || "0"}
          icon={Stethoscope}
          status={kpiMedicos?.status}
          description="Efetivo nas UPAs e UBS"
        />
        <KPICard 
          title="Falta de Medicamentos" 
          value={kpiMedicamentos?.valor?.toString() || "0"}
          icon={AlertTriangle}
          status={kpiMedicamentos?.status === 'ok' ? 'critico' : 'ok'} // Invertendo lógica: falta é ruim
          description="Itens críticos em estoque baixo"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Campanhas de Vacinação */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Campanhas de Vacinação</CardTitle>
                <CardDescription>Progresso das metas em tempo real</CardDescription>
              </div>
              <Syringe className="h-5 w-5 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-muted" />)}
                </div>
              ) : campanhas.length > 0 ? (
                campanhas.map((campanha) => {
                  const percent = Math.min(100, Math.round((campanha.doses_aplicadas / (campanha.meta_doses || 1)) * 100));
                  return (
                    <div key={campanha.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{campanha.nome}</span>
                          <Badge variant={campanha.status === 'ativa' ? 'default' : 'secondary'}>
                            {campanha.status === 'ativa' ? 'Ativa' : campanha.status === 'planejada' ? 'Planejada' : 'Encerrada'}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {campanha.doses_aplicadas.toLocaleString()} / {campanha.meta_doses.toLocaleString()} doses
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={percent} className="h-2" />
                        <span className="min-w-[40px] text-right text-sm font-bold">{percent}%</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Início: {campanha.data_inicio ? new Date(campanha.data_inicio).toLocaleDateString("pt-BR") : "N/A"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Público: {campanha.publico_alvo}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma campanha registrada no momento.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status das Unidades (Simulado / Mock based on spec requirements) */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Unidades</CardTitle>
            <CardDescription>Ocupação e funcionamento</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                <UnitStatus 
                  name="UPA Central" 
                  status="normal" 
                  waitingTime="15 min"
                  occupancy={45}
                />
                <UnitStatus 
                  name="Hospital Municipal" 
                  status="alerta" 
                  waitingTime="45 min"
                  occupancy={88}
                />
                <UnitStatus 
                  name="UBS Jardim América" 
                  status="normal" 
                  waitingTime="10 min"
                  occupancy={30}
                />
                <UnitStatus 
                  name="UBS Vila Nova" 
                  status="normal" 
                  waitingTime="5 min"
                  occupancy={25}
                />
                <UnitStatus 
                  name="UPA Norte" 
                  status="alerta" 
                  waitingTime="30 min"
                  occupancy={75}
                />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ 
  title, 
  value, 
  variation, 
  icon: Icon, 
  status, 
  description,
  unit 
}: { 
  title: string; 
  value: string; 
  variation?: number | null; 
  icon: any; 
  status?: string;
  description?: string;
  unit?: string | null;
}) {
  const isPositive = variation && variation > 0;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", status === 'critico' ? 'text-destructive' : status === 'atencao' ? 'text-amber-500' : 'text-primary')} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value} {unit}</div>
        <div className="mt-1 flex items-center gap-2">
          {variation !== undefined && variation !== null ? (
            <div className={cn("flex items-center text-xs font-medium", isPositive ? "text-emerald-500" : "text-destructive")}>
              {isPositive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
              {Math.abs(variation)}% em relação ao mês anterior
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{description || "Atualizado hoje"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UnitStatus({ name, status, waitingTime, occupancy }: { name: string, status: 'normal' | 'alerta' | 'critico', waitingTime: string, occupancy: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{name}</span>
        <Badge variant={status === 'normal' ? 'outline' : 'destructive'} className={cn(status === 'normal' && "border-emerald-500/50 text-emerald-600 dark:text-emerald-400")}>
          {status === 'normal' ? 'Normal' : 'Alerta'}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>Espera: {waitingTime}</span>
        <span>Ocupação: {occupancy}%</span>
      </div>
      <Progress value={occupancy} className="mt-2 h-1" />
    </div>
  );
}
