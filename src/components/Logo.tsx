interface LogoProps {
  variant?: "default" | "light";
  showText?: boolean;
  className?: string;
}

export function Logo({ variant = "default", showText = true, className = "" }: LogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-foreground";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="url(#novaexis-grad)" />
        <path
          d="M9 22V10L16 18.5L23 10V22"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23" cy="22" r="2" fill="#F5A623" />
        <defs>
          <linearGradient id="novaexis-grad" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="oklch(0.42 0.11 248)" />
            <stop offset="1" stopColor="oklch(0.55 0.12 160)" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className={`text-xl font-semibold tracking-tight ${textColor}`}>
          Novae<span className="text-accent">Xis</span>
        </span>
      )}
    </div>
  );
}
