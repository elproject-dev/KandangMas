import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface AdminModeProviderProps {
  children: React.ReactNode;
  storageKey?: string;
}

interface AdminModeProviderState {
  adminMode: boolean;
  setAdminMode: (adminMode: boolean) => void;
  isAdmin: boolean;
  role: string | null;
}

const initialState: AdminModeProviderState = {
  adminMode: false,
  setAdminMode: () => null,
  isAdmin: false,
  role: null,
};

const AdminModeProviderContext = createContext<AdminModeProviderState>(initialState);

export function AdminModeProvider({
  children,
  storageKey = "kantongmas:admin_mode",
  ...props
}: AdminModeProviderProps) {
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = role === "admin";

  const [remoteMode, setRemoteMode] = useState<boolean>(false);

  const [adminLocalMode, setAdminLocalMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  const adminMode = isAdmin ? adminLocalMode : remoteMode;

  const loadRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // console.log("AdminModeProvider: Checking user:", user?.email, "ID:", user?.id);
      
      if (!user?.id) {
        // console.log("AdminModeProvider: No user session found");
        setRole(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("AdminModeProvider: Supabase error fetching role:", error);
        setRole(null);
        return;
      }

      // console.log("AdminModeProvider: Role data from DB:", data);
      const userRole = (data as any)?.role ?? null;
      // console.log("AdminModeProvider: Setting role to:", userRole);
      setRole(userRole);

      // Proactively set adminLocalMode to true if the user is an admin
      if (userRole === "admin") {
        try {
          localStorage.setItem(storageKey, "true");
        } catch {
          // ignore
        }
        setAdminLocalMode(true);
      }

      if (userRole !== "admin") {
        try {
          const { data: remote, error: remoteError } = await supabase
            .from("admin_remote_mode")
            .select("enabled")
            .eq("user_id", user.id)
            .maybeSingle();

          if (remoteError) {
            console.error("AdminModeProvider: Error fetching remote mode:", remoteError);
            setRemoteMode(false);
          } else {
            setRemoteMode(Boolean((remote as any)?.enabled));
          }
        } catch (e) {
          console.error("AdminModeProvider: Error in remote mode fetch:", e);
          setRemoteMode(false);
        }
      } else {
        setRemoteMode(false);
      }
    } catch (err) {
      console.error("AdminModeProvider: Catch block error:", err);
      setRole(null);
      setRemoteMode(false);
    }
  };

  useEffect(() => {
    // 1. Initial load
    loadRole();

    // 2. Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // console.log("AdminModeProvider: Auth event:", event);
      if (session?.user) {
        loadRole();
      } else {
        setRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // If adminMode is enabled but user is not an admin, force it to false
    if (adminLocalMode && role !== null && !isAdmin) {
      try {
        localStorage.setItem(storageKey, "false");
      } catch {
        // ignore
      }
      setAdminLocalMode(false);
    }
  }, [adminLocalMode, isAdmin, role, storageKey]);

  const value = {
    adminMode,
    setAdminMode: (mode: boolean) => {
      // Only admins can toggle local admin mode.
      if (!isAdmin) return;
      localStorage.setItem(storageKey, String(mode));
      setAdminLocalMode(mode);
    },
    isAdmin,
    role,
  };

  return (
    <AdminModeProviderContext.Provider {...props} value={value}>
      {children}
    </AdminModeProviderContext.Provider>
  );
}

export const useAdminMode = () => {
  const context = useContext(AdminModeProviderContext);

  if (context === undefined)
    throw new Error("useAdminMode must be used within an AdminModeProvider");

  return context;
}
