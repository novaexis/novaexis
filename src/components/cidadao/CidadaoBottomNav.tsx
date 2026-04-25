import { Link, useLocation } from "@tanstack/react-router";
import { Home, ClipboardList, Heart, GraduationCap, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/cidadao",          label: "Início",    icon: Home },
  { to: "/cidadao/servicos", label: "Serviços",  icon: ClipboardList },
  { to: "/cidadao/saude",    label: "Saúde",     icon: Heart },
  { to: "/cidadao/educacao", label: "Educação",  icon: GraduationCap },
  { to: "/cidadao/perfil",   label: "Perfil",    icon: User },
] as const;

export function CidadaoBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur"
      aria-label="Navegação principal"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {TABS.map((t) => {
          const active =
            t.to === "/cidadao"
              ? pathname === "/cidadao"
              : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2.5 text-xs transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5", active && "stroke-[2.5]")}
                aria-hidden
              />
              <span className={cn("font-medium", active && "font-semibold")}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
