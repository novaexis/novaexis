import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Banknote,
  BarChart3,
  Brain,
  Radio,
  FileText,
  Plug,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}

const NAV: NavItem[] = [
  { to: "/prefeito", label: "Dashboard", icon: LayoutDashboard },
  { to: "/prefeito/secretarias", label: "Secretarias", icon: Building2, disabled: true },
  { to: "/prefeito/captacao", label: "Captação de recursos", icon: Banknote },
  { to: "/prefeito/benchmark", label: "Benchmark", icon: BarChart3 },
  { to: "/prefeito/ia", label: "IA Estratégica", icon: Brain, disabled: true },
  { to: "/prefeito/social", label: "Social Intelligence", icon: Radio },
  { to: "/prefeito/relatorios", label: "Relatórios", icon: FileText },
  { to: "/prefeito/integracoes", label: "Integrações", icon: Plug, disabled: true },
];

interface Props {
  tenantNome?: string;
  prefeitoNome?: string;
}

export function AppSidebarPrefeito({ tenantNome, prefeitoNome }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card shadow-sm md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-card transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <Link to="/" onClick={() => setMobileOpen(false)}>
            <Logo />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b px-4 py-3">
          <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
            Prefeitura
          </p>
          <p className="truncate text-sm font-semibold">{tenantNome ?? "—"}</p>
          {prefeitoNome && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{prefeitoNome}</p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <NavLink key={item.to} item={item} onNavigate={() => setMobileOpen(false)} />
            ))}
          </ul>
        </nav>

        <div className="border-t p-2">
          <button
            disabled
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-60"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </button>
          <button
            onClick={async () => {
              await signOut();
              toast.success("Sessão encerrada");
              navigate({ to: "/login" });
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const location = useLocation();
  const Icon = item.icon;
  const active = location.pathname === item.to;

  if (item.disabled) {
    return (
      <li>
        <span
          className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-60"
          title="Em breve"
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 truncate">{item.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
            soon
          </span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 truncate">{item.label}</span>
      </Link>
    </li>
  );
}

export function PrefeitoLayoutShell({
  children,
  tenantNome,
  prefeitoNome,
}: {
  children: React.ReactNode;
  tenantNome?: string;
  prefeitoNome?: string;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <AppSidebarPrefeito tenantNome={tenantNome} prefeitoNome={prefeitoNome} />
      <div className="md:pl-60">{children}</div>
    </div>
  );
}
