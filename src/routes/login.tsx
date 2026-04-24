import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, defaultRouteForRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DEMO_PASSWORD = "Demo@2026";

type DemoUser = { label: string; email: string; group: string };

const DEMO_USERS: DemoUser[] = [
  // Estado
  { group: "Estado", label: "Governador do Pará", email: "governador@pa.gov.br" },
  // Marajoense
  { group: "Marajoense", label: "Prefeito", email: "prefeito@marajoense.pa.gov.br" },
  { group: "Marajoense", label: "Sec. Educação", email: "secretario.educacao@marajoense.pa.gov.br" },
  { group: "Marajoense", label: "Sec. Saúde", email: "secretario.saude@marajoense.pa.gov.br" },
  { group: "Marajoense", label: "Sec. Infraestrutura", email: "secretario.infraestrutura@marajoense.pa.gov.br" },
  { group: "Marajoense", label: "Sec. Assist. Social", email: "secretario.assistencia_social@marajoense.pa.gov.br" },
  { group: "Marajoense", label: "Sec. Finanças", email: "secretario.financas@marajoense.pa.gov.br" },
  { group: "Marajoense", label: "Cidadão", email: "cidadao@marajoense.pa.gov.br" },
  // Nova Belém do Tapajós
  { group: "Nova Belém do Tapajós", label: "Prefeito", email: "prefeito@nova-belem-do-tapajos.pa.gov.br" },
  { group: "Nova Belém do Tapajós", label: "Sec. Educação", email: "secretario.educacao@nova-belem-do-tapajos.pa.gov.br" },
  { group: "Nova Belém do Tapajós", label: "Sec. Saúde", email: "secretario.saude@nova-belem-do-tapajos.pa.gov.br" },
  { group: "Nova Belém do Tapajós", label: "Sec. Infraestrutura", email: "secretario.infraestrutura@nova-belem-do-tapajos.pa.gov.br" },
  { group: "Nova Belém do Tapajós", label: "Sec. Assist. Social", email: "secretario.assistencia_social@nova-belem-do-tapajos.pa.gov.br" },
  { group: "Nova Belém do Tapajós", label: "Sec. Finanças", email: "secretario.financas@nova-belem-do-tapajos.pa.gov.br" },
  { group: "Nova Belém do Tapajós", label: "Cidadão", email: "cidadao@nova-belem-do-tapajos.pa.gov.br" },
  // Santarinho do Norte
  { group: "Santarinho do Norte", label: "Prefeito", email: "prefeito@santarinho-do-norte.pa.gov.br" },
  { group: "Santarinho do Norte", label: "Sec. Educação", email: "secretario.educacao@santarinho-do-norte.pa.gov.br" },
  { group: "Santarinho do Norte", label: "Sec. Saúde", email: "secretario.saude@santarinho-do-norte.pa.gov.br" },
  { group: "Santarinho do Norte", label: "Sec. Infraestrutura", email: "secretario.infraestrutura@santarinho-do-norte.pa.gov.br" },
  { group: "Santarinho do Norte", label: "Sec. Assist. Social", email: "secretario.assistencia_social@santarinho-do-norte.pa.gov.br" },
  { group: "Santarinho do Norte", label: "Sec. Finanças", email: "secretario.financas@santarinho-do-norte.pa.gov.br" },
  { group: "Santarinho do Norte", label: "Cidadão", email: "cidadao@santarinho-do-norte.pa.gov.br" },
];

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — NovaeXis" },
      { name: "description", content: "Acesse a plataforma NovaeXis." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user, primaryRole, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: defaultRouteForRole(primaryRole) });
    }
  }, [loading, user, primaryRole, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.includes("Invalid") ? "Email ou senha incorretos" : error);
    } else {
      toast.success("Bem-vindo!");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signUp(email, password, nome);
    setSubmitting(false);
    if (error) {
      toast.error(
        error.includes("registered") ? "Este email já está cadastrado" : error,
      );
    } else {
      toast.success("Conta criada! Verifique seu email.");
    }
  }

  async function quickLogin(demoEmail: string) {
    setSubmitting(true);
    let { error } = await signIn(demoEmail, DEMO_PASSWORD);
    if (error) {
      // Tenta resetar as senhas demo e tentar de novo
      toast.message("Preparando usuários demo...");
      const { error: fnErr } = await supabase.functions.invoke("reset-demo-passwords");
      if (fnErr) {
        setSubmitting(false);
        toast.error("Falha ao preparar demo: " + fnErr.message);
        return;
      }
      ({ error } = await signIn(demoEmail, DEMO_PASSWORD));
    }
    setSubmitting(false);
    if (error) toast.error(error);
    else toast.success(`Entrando como ${demoEmail}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Acesso à plataforma</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com sua conta NovaeXis
            </p>
          </div>

          <Card className="p-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-pass">Senha</Label>
                    <Input
                      id="signin-pass"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Login Gov.br em breve
                </p>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-nome">Nome completo</Label>
                    <Input
                      id="signup-nome"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-pass">Senha</Label>
                    <Input
                      id="signup-pass"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="mt-4 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Login rápido — Demonstração</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Senha padrão: <code className="rounded bg-muted px-1 py-0.5">{DEMO_PASSWORD}</code>
            </p>
            {Array.from(new Set(DEMO_USERS.map((u) => u.group))).map((group) => (
              <div key={group} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DEMO_USERS.filter((u) => u.group === group).map((u) => (
                    <Button
                      key={u.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={submitting}
                      onClick={() => quickLogin(u.email)}
                      className="justify-start text-xs"
                    >
                      {u.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Voltar à home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
