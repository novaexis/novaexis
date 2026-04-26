import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prefeito/credenciais")({
  head: () => ({ meta: [{ title: "Credenciais de integração — NovaeXis" }] }),
  component: CredenciaisPage,
});

type ResultadoCheck = {
  servico: string;
  configurada: boolean;
  ok: boolean;
  http_status?: number;
  mensagem: string;
  amostra?: unknown;
};

function CredenciaisPage() {
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCheck[] | null>(null);
  const [verificadoEm, setVerificadoEm] = useState<string | null>(null);

  const validar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validar-credenciais-estaduais");
      if (error) throw error;
      setResultados(data?.resultados ?? []);
      setVerificadoEm(data?.verificado_em ?? null);
      const okCount = (data?.resultados ?? []).filter((r: ResultadoCheck) => r.ok).length;
      toast.success(`Validação concluída — ${okCount}/${data?.resultados?.length ?? 0} OK`);
    } catch (err) {
      toast.error("Falha ao validar credenciais");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <KeyRound className="h-6 w-6 text-primary" />
          Credenciais de integração estadual
        </h1>
        <p className="text-sm text-muted-foreground">
          As chaves <code className="rounded bg-muted px-1 py-0.5 text-xs">PORTAL_TRANSPARENCIA_API_KEY</code>{" "}
          e <code className="rounded bg-muted px-1 py-0.5 text-xs">CNES_API_KEY</code> são armazenadas
          como secrets no backend. Use o botão abaixo para fazer uma chamada real às APIs e
          confirmar que as chaves foram aceitas.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Validação automática</CardTitle>
            {verificadoEm && (
              <p className="mt-1 text-xs text-muted-foreground">
                Última verificação: {new Date(verificadoEm).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <Button onClick={validar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Testar credenciais
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {!resultados && (
            <p className="text-sm text-muted-foreground">
              Clique em <strong>Testar credenciais</strong> para disparar uma chamada de
              verificação a cada API.
            </p>
          )}

          {resultados && (
            <ul className="space-y-3">
              {resultados.map((r) => (
                <li
                  key={r.servico}
                  className="flex items-start gap-3 rounded-lg border bg-card p-4"
                >
                  <div className="mt-0.5">
                    {r.ok ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.servico}</p>
                      {r.configurada ? (
                        <Badge variant="secondary">Chave configurada</Badge>
                      ) : (
                        <Badge variant="destructive">Sem chave</Badge>
                      )}
                      {r.http_status !== undefined && (
                        <Badge variant={r.ok ? "default" : "outline"}>HTTP {r.http_status}</Badge>
                      )}
                    </div>
                    <p className={`text-sm ${r.ok ? "text-foreground" : "text-muted-foreground"}`}>
                      {r.mensagem}
                    </p>
                    {!r.ok && r.amostra !== undefined && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Ver resposta da API
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
                          {typeof r.amostra === "string"
                            ? r.amostra
                            : JSON.stringify(r.amostra, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como obter cada chave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Portal da Transparência</p>
            <p className="text-muted-foreground">
              Cadastre-se em{" "}
              <a
                href="https://api.portaldatransparencia.gov.br/swagger-ui/index.html"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                api.portaldatransparencia.gov.br
              </a>
              . O cabeçalho usado é <code>chave-api-dados</code>.
            </p>
          </div>
          <div>
            <p className="font-medium">CNES (DATASUS)</p>
            <p className="text-muted-foreground">
              A maioria dos endpoints é pública, mas algumas rotas exigem token. Solicite em{" "}
              <a
                href="https://apidadosabertos.saude.gov.br/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                apidadosabertos.saude.gov.br
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
