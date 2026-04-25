import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar à home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NovaeXis — Plataforma de Gestão Pública Inteligente" },
      {
        name: "description",
        content:
          "NovaeXis integra União, Estado e Municípios em uma única plataforma com IA estratégica para prefeitos, secretários e cidadãos.",
      },
      { name: "author", content: "NovaeXis" },
      { property: "og:title", content: "NovaeXis — Plataforma de Gestão Pública Inteligente" },
      {
        property: "og:description",
        content: "Painel do prefeito, app do cidadão e cérebro estadual em um só produto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "NovaeXis — Plataforma de Gestão Pública Inteligente" },
      { name: "description", content: "NovaeXis: Plataforma SaaS para gestão pública municipal e estadual." },
      { property: "og:description", content: "NovaeXis: Plataforma SaaS para gestão pública municipal e estadual." },
      { name: "twitter:description", content: "NovaeXis: Plataforma SaaS para gestão pública municipal e estadual." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Pq8jSxyLjHWdeVpJwyERRXmHqbW2/social-images/social-1777115969468-logo2_cf.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Pq8jSxyLjHWdeVpJwyERRXmHqbW2/social-images/social-1777115969468-logo2_cf.webp" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster />
    </AuthProvider>
  );
}
