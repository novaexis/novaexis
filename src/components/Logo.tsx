import logoHorizontal from "@/assets/logo-horizontal.png";
import logoVertical from "@/assets/logo-vertical.png";

interface LogoProps {
  /** "horizontal" (default) for headers/sidebars, "vertical" for splash/login hero */
  orientation?: "horizontal" | "vertical";
  /** Legacy: kept for back-compat — no longer affects rendering */
  variant?: "default" | "light";
  /** Legacy: image already contains the wordmark */
  showText?: boolean;
  /** Tailwind height utility, e.g. "h-8", "h-12", "h-24" */
  className?: string;
}

export function Logo({
  orientation = "horizontal",
  className = "h-8",
}: LogoProps) {
  const src = orientation === "vertical" ? logoVertical : logoHorizontal;
  return (
    <img
      src={src}
      alt="NovaeXis — Gestão Pública Inteligente"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
