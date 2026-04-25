import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  GraduationCap, 
  School, 
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  Bus,
  Apple
} from "lucide-react";
import { type KPISecretaria } from "@/hooks/useSecretaria";
import { cn } from "@/lib/utils";

interface VisaoGeralEducacaoProps {
  kpis: KPISecretaria[];
}

export function VisaoGeralEducacao({ kpis }: VisaoGeralEducacaoProps) {
  // Encontrar KPIs específicos
  const kpiAlunos = kpis.find(k => k.indicador.toLowerCase().includes("aluno") || k.indicador.toLowerCase().includes("matricula"));
  const kpiIdeba = kpis.find(k => k.indicador.toLowerCase().includes("ideb"));
  const kpiEscolas = kpis.find(k => k.indicador.toLowerCase().includes("escola") || k.indicador.toLowerCase().includes("unidade"));
  const kpiMerenda = kpis.find(k => k.indicador.toLowerCase().includes("merenda") || k.indicador.toLowerCase().includes("alimentação"));

  return (
    <div className="space-y-6">
      {/* Grid de KPIs principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard 
          title="Total de Alunos" 
          value={kpiAlunos?.valor?.toLocaleString("pt-BR") || "0"}
          variation={kpiAlunos?.variacao_pct}
          icon={Users}
          status={kpiAlunos?.status}
          unit={kpiAlunos?.unidade}
        />
        <KPICard 
          title="IDEB Médio" 
          value={kpiIdeba?.valor?.toString() || "0"}
          variation={kpiIdeba?.variacao_pct}
          icon={GraduationCap}
          status={kpiIdeba?.status}
          unit={kpiIdeba?.unidade}
        />
        <KPICard 
          title="Unidades Escolares" 
          value={kpiEscolas?.valor?.toString() || "0"}
          icon={School}
          status={kpiEscolas?.status}
          description="Escolas e creches ativas"
        />
        <KPICard 
          title="Qualidade Merenda" 
          value={`${kpiMerenda?.valor || 0}%`}
          icon={Apple}
          status={kpiMerenda?.status}
          description="Aprovação nutricional"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Status de Projetos/Obras Escolares */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Infraestrutura e Projetos</CardTitle>
                <CardDescription>Acompanhamento de reformas e expansão</CardDescription>
              </div>
              <School className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <ProjectStatus 
                name="Reforma Escola Municipal Dom Pedro I" 
                progress={85} 
                deadline="15/05/2026"
                status="no-prazo"
              />
              <ProjectStatus 
                name="Construção Nova Creche Bairro Esperança" 
                progress={40} 
                deadline="10/10/2026"
                status="atencao"
              />
              <ProjectStatus 
                name="Laboratório de Informática - Escola Vila Verde" 
                progress={100} 
                deadline="Concluído"
                status="concluido"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transporte Escolar e Logística */}
        <Card>
          <CardHeader>
            <CardTitle>Logística e Apoio</CardTitle>
            <CardDescription>Serviços complementares</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                <LogisticItem 
                  title="Frota Escolar" 
                  status="ok" 
                  label="42 veículos operando"
                  icon={Bus}
                />
                <LogisticItem 
                  title="Distribuição Merenda" 
                  status="ok" 
                  label="100% das unidades atendidas"
                  icon={Apple}
                />
                <LogisticItem 
                  title="Material Didático" 
                  status="atencao" 
                  label="Entrega 92% concluída"
                  icon={BookOpen}
                />
                <LogisticItem 
                  title="Efetivo Docente" 
                  status="ok" 
                  label="98% de ocupação"
                  icon={Users}
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
              {Math.abs(variation)}% em relação ao ano anterior
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{description || "Atualizado hoje"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectStatus({ name, progress, deadline, status }: { name: string, progress: number, deadline: string, status: 'no-prazo' | 'atencao' | 'concluido' }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{name}</span>
        <Badge variant={status === 'concluido' ? 'default' : status === 'atencao' ? 'destructive' : 'outline'} className={cn(status === 'no-prazo' && "border-blue-500/50 text-blue-600 dark:text-blue-400")}>
          {status === 'concluido' ? 'Concluído' : status === 'atencao' ? 'Atraso' : 'No Prazo'}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-2" />
        <span className="min-w-[40px] text-right text-sm font-bold">{progress}%</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Entrega prevista: {deadline}
      </div>
    </div>
  );
}

function LogisticItem({ title, status, label, icon: Icon }: { title: string, status: 'ok' | 'atencao' | 'critico', label: string, icon: any }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className={cn("rounded-full p-2", status === 'ok' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="ml-auto">
        <div className={cn("h-2 w-2 rounded-full", status === 'ok' ? "bg-emerald-500" : "bg-amber-500")} />
      </div>
    </div>
  );
}