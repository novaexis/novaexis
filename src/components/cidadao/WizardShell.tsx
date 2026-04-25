import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

interface WizardShellProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  submitting?: boolean;
}

export function WizardShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  submitting,
}: WizardShellProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-5 sm:px-6">
      {/* Progress dots */}
      <div className="mb-4 flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i < step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Passo {step} de {totalSteps}
      </p>
      <h1 className="mb-1 text-xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mb-5 text-sm text-muted-foreground">{subtitle}</p>}

      <Card className="p-4 sm:p-5">{children}</Card>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur sm:bottom-4 sm:left-1/2 sm:right-auto sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-xl sm:border sm:shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={!onBack || submitting}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || !onNext || submitting}
            className="gap-1"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                {nextLabel}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
