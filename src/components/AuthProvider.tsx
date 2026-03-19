"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { guestHasAnySave, migrateGuestSaves } from "@/lib/saveManager";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isGuest: true,
  loading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handlePostAuth = useCallback(async () => {
    if (guestHasAnySave()) {
      try {
        const count = await migrateGuestSaves();
        if (count > 0) console.log(`Migrated ${count} guest save(s) to account`);
      } catch (e) {
        console.error("Migration failed:", e);
      }
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Sign in failed";
      setUser(data.user);
      await handlePostAuth();
      return null;
    } catch {
      return "Network error";
    }
  }, [handlePostAuth]);

  const signUp = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Sign up failed";
      setUser(data.user);
      await handlePostAuth();
      return null;
    } catch {
      return "Network error";
    }
  }, [handlePostAuth]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isGuest: !user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
