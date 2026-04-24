import { useEffect, type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth, type AppRole, defaultRouteForRole } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RoleGuardProps {
  allowed: AppRole[];
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function RoleGuard({ allowed, children, title, subtitle }: RoleGuardProps) {
  const { user, loading, primaryRole, profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Sem role atribuído ainda
  if (!primaryRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Logo />
        <h1 className="mt-4 text-xl font-semibold">Acesso pendente de atribuição</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Sua conta foi criada, mas ainda não tem perfil atribuído. Entre em contato com o
          administrador do município ou aguarde a sincronização do seed de demonstração.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            toast.success("Sessão encerrada");
            navigate({ to: "/login" });
          }}
        >
          Sair
        </Button>
      </div>
    );
  }

  if (!allowed.includes(primaryRole)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Logo />
        <h1 className="mt-4 text-xl font-semibold">Sem permissão para esta área</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil é <strong>{primaryRole}</strong>. Redirecionando…
        </p>
        <Link to={defaultRouteForRole(primaryRole)}>
          <Button>Ir para meu painel</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/"><Logo /></Link>
            <div className="hidden min-w-0 border-l pl-4 sm:block">
              <p className="truncate text-sm font-semibold">{title}</p>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-medium">{profile?.nome ?? profile?.email}</p>
              <p className="text-muted-foreground capitalize">{primaryRole}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                toast.success("Sessão encerrada");
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
