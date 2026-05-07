// Supabase authentication
import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";

export interface AuthUser {
  email: string;
  id: string;
  isLoggedIn: boolean;
}

export async function login(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message || "Gagal login");
  }

  // Dispatch custom event to notify app about auth change
  window.dispatchEvent(new Event("auth-change"));
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message || "Gagal logout");
  }

  // Dispatch custom event to notify app about auth change
  window.dispatchEvent(new Event("auth-change"));
}

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Listen to auth state changes
export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return subscription;
}
