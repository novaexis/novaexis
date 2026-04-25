import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth, defaultRouteForRole } from "@/lib/auth-context";

interface SecretariaShellProps {
  icon: LucideIcon;
  nome: string;
  secretarioNome?: string | null;
  ultimaAtualizacao?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  visaoGeral: ReactNode;
  demandas: ReactNode;
  indicadores: ReactNode;
  relatorios: ReactNode;
  integracoes?: ReactNode;
  acoes?: ReactNode;
}

export function SecretariaShell({
  icon: Icon,
  nome,
  secretarioNome,
  ultimaAtualizacao,
  loading,
  error,
  onRetry,
  visaoGeral,
  demandas,
  indicadores,
  relatorios,
  acoes,
}: SecretariaShellProps) {
  const { primaryRole } = useAuth();
  const backRoute = defaultRouteForRole(primaryRole);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link to={backRoute}>
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{nome}</h1>
            <p className="text-sm text-muted-foreground">
              {secretarioNome ? `Secretário(a): ${secretarioNome}` : "Secretário(a) não atribuído"}
              {ultimaAtualizacao && (
                <>
                  <span className="mx-2 text-border">·</span>
                  Última atualização: {new Date(ultimaAtualizacao).toLocaleString("pt-BR")}
                </>
              )}
            </p>
          </div>
        </div>
        {acoes && <div className="flex gap-2">{acoes}</div>}
      </div>

      {error && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void onRetry()}
            >
              Tentar novamente
            </Button>
          )}
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="visao">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="demandas">Demandas</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="mt-4">{visaoGeral}</TabsContent>
          <TabsContent value="demandas" className="mt-4">{demandas}</TabsContent>
          <TabsContent value="indicadores" className="mt-4">{indicadores}</TabsContent>
          <TabsContent value="relatorios" className="mt-4">{relatorios}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
