import {
  Heart,
  GraduationCap,
  DollarSign,
  Construction,
  Shield,
  HandHeart,
  type LucideIcon,
} from "lucide-react";

export interface SecretariaMeta {
  slug: string;
  nome: string;
  nomeCompleto: string;
  icon: LucideIcon;
  cor: string;
}

export const SECRETARIAS_MUNICIPAIS: Record<string, SecretariaMeta> = {
  saude: {
    slug: "saude",
    nome: "Saúde",
    nomeCompleto: "Secretaria Municipal de Saúde",
    icon: Heart,
    cor: "text-rose-500",
  },
  educacao: {
    slug: "educacao",
    nome: "Educação",
    nomeCompleto: "Secretaria Municipal de Educação",
    icon: GraduationCap,
    cor: "text-blue-500",
  },
  financas: {
    slug: "financas",
    nome: "Finanças",
    nomeCompleto: "Secretaria Municipal de Finanças",
    icon: DollarSign,
    cor: "text-emerald-500",
  },
  infraestrutura: {
    slug: "infraestrutura",
    nome: "Infraestrutura",
    nomeCompleto: "Secretaria Municipal de Infraestrutura",
    icon: Construction,
    cor: "text-amber-500",
  },
  seguranca: {
    slug: "seguranca",
    nome: "Segurança Pública",
    nomeCompleto: "Secretaria Municipal de Segurança Pública",
    icon: Shield,
    cor: "text-indigo-500",
  },
  assistencia: {
    slug: "assistencia",
    nome: "Assistência Social",
    nomeCompleto: "Secretaria Municipal de Assistência Social",
    icon: HandHeart,
    cor: "text-purple-500",
  },
};

export function getSecretariaMeta(slug: string): SecretariaMeta | null {
  return SECRETARIAS_MUNICIPAIS[slug] ?? null;
}
