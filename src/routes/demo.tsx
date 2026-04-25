import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo NovaeXis — Veja a plataforma em ação" },
      {
        name: "description",
        content:
          "Demo interativa do NovaeXis com dados do município fictício de Marajoense (PA). Modo somente leitura.",
      },
    ],
  }),
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-amber-50/95 backdrop-blur dark:bg-amber-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-7" />
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 dark:text-amber-300">
              <Eye className="h-3 w-3" />
              Modo demonstração — somente leitura
            </Badge>
          </div>
          <Link to="/onboarding">
            <Button size="sm">
              Começar grátis <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {[
            { to: "/demo/prefeito", label: "Prefeito" },
            { to: "/demo/cidadao", label: "Cidadão" },
            { to: "/demo/governador", label: "Governador" },
          ].map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium bg-background text-foreground shadow-sm" }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
