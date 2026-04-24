import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "superadmin"
  | "governador"
  | "prefeito"
  | "secretario"
  | "cidadao"
  | "admin_parceiro";

export interface UserRole {
  role: AppRole;
  tenant_id: string | null;
  secretaria_slug: string | null;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  nome: string | null;
  email: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: UserRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    nome: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  primaryRole: AppRole | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = [
  "superadmin",
  "governador",
  "prefeito",
  "secretario",
  "admin_parceiro",
  "cidadao",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener PRIMEIRO
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // defer para evitar deadlock
          setTimeout(() => loadUserData(newSession.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
      },
    );

    // Sessão atual
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadUserData(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, tenant_id, nome, email")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role, tenant_id, secretaria_slug")
        .eq("user_id", userId),
    ]);
    setProfile(profileData);
    setRoles((rolesData ?? []) as UserRole[]);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, nome: string) {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { nome } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }

  const primaryRole =
    ROLE_PRIORITY.find((r) => roles.some((ur) => ur.role === r)) ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        loading,
        signIn,
        signUp,
        signOut,
        primaryRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function defaultRouteForRole(role: AppRole | null): string {
  switch (role) {
    case "superadmin":
      return "/admin";
    case "governador":
      return "/governador";
    case "prefeito":
      return "/prefeito";
    case "secretario":
      return "/secretaria";
    case "cidadao":
      return "/cidadao";
    default:
      return "/cidadao";
  }
}
