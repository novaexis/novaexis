import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import {
  Building2,
  Users,
  Brain,
  TrendingUp,
  Shield,
  Globe2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NovaeXis — Plataforma SaaS de Gestão Pública para o Pará" },
      {
        name: "description",
        content:
          "Cérebro digital integrando União, Estado do Pará e municípios. Painel do prefeito com IA, app do cidadão e visão estadual em uma única plataforma.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#produto" className="text-sm text-muted-foreground hover:text-foreground">
              Produto
            </a>
            <a href="#publicos" className="text-sm text-muted-foreground hover:text-foreground">
              Públicos
            </a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground">
              Planos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Solicitar demo</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-5xl text-center text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Feito para municípios do Pará
          </span>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            O cérebro digital da gestão pública municipal
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-white/85">
            Da União à secretaria, do gabinete do prefeito ao celular do cidadão. NovaeXis
            integra dados, IA estratégica e ouvidoria em uma única plataforma.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="font-semibold">
                Acessar plataforma <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <a href="#produto">
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
                Ver como funciona
              </Button>
            </a>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Login Gov.br</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> IA estratégica nativa</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Multi-tenant seguro</span>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="produto" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight">
            Três camadas, uma plataforma
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Integração vertical inédita entre Federal, Estadual e Municipal.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Globe2,
                titulo: "União",
                desc: "Login Gov.br, benefícios federais e captação de recursos da União em um só lugar.",
              },
              {
                icon: Building2,
                titulo: "Estado",
                desc: "Cérebro estadual integrando secretarias do Pará e municípios aderentes.",
              },
              {
                icon: Users,
                titulo: "Município",
                desc: "Painel do prefeito, painéis setoriais e app do cidadão para serviços públicos.",
              },
            ].map(({ icon: Icon, titulo, desc }) => (
              <Card key={titulo} className="p-6 transition hover:shadow-lg">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Públicos */}
      <section id="publicos" className="bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight">
            Cada perfil, um produto sob medida
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Brain,
                titulo: "Prefeito",
                desc: "Visão 360° + IA estratégica + alertas de prazo de captação.",
              },
              {
                icon: TrendingUp,
                titulo: "Secretário",
                desc: "Painel setorial, gestão de demandas e indicadores em tempo real.",
              },
              {
                icon: Building2,
                titulo: "Governador",
                desc: "Mapa do Pará, municípios críticos e alocação de recursos.",
              },
              {
                icon: Users,
                titulo: "Cidadão",
                desc: "Saúde, educação, ouvidoria e benefícios em um único app.",
              },
            ].map(({ icon: Icon, titulo, desc }) => (
              <Card key={titulo} className="p-5">
                <Icon className="h-8 w-8 text-accent" />
                <h3 className="mt-4 font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight">
            Diferenciais NovaeXis
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[
              { icon: Brain, t: "IA estratégica Claude", d: "Conselheiro digital do prefeito 24/7." },
              { icon: TrendingUp, t: "Benchmark automático", d: "Compare seu município com similares do Brasil." },
              { icon: Shield, t: "Social Intelligence", d: "Reputação da prefeitura monitorada nas redes." },
              { icon: Globe2, t: "Login Gov.br nativo", d: "Cidadão entra com a mesma conta que já usa." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4 rounded-lg border bg-card p-5">
                <div className="shrink-0 rounded-md bg-accent/10 p-2.5 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="planos"
        className="relative overflow-hidden px-4 py-20 sm:px-6"
        style={{ background: "var(--gradient-success)" }}
      >
        <div className="mx-auto max-w-3xl text-center text-white">
          <h2 className="text-balance text-3xl font-bold sm:text-4xl">
            Pronto para modernizar sua prefeitura?
          </h2>
          <p className="mt-4 text-white/85">
            Agende uma demonstração com dados de municípios fictícios do Pará e veja na prática.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="font-semibold">
                Entrar na plataforma
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} NovaeXis. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
