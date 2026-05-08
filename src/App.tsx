import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationProvider } from "@/components/notification-provider";
import { AdminModeProvider } from "@/components/admin-mode-provider";
import { useEffect, useRef, useState } from "react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";

import { Layout } from "@/components/layout/layout";
import { Dashboard } from "@/pages/dashboard";
import { Kasir } from "@/pages/kasir";
import { Transaksi } from "@/pages/transaksi";
import { Pelanggan } from "@/pages/pelanggan";
import { Layanan } from "@/pages/layanan";
import { JadwalKunjungan } from "@/pages/jadwal-kunjungan";
import Setting from "@/pages/setting";

import { isLoggedIn, onAuthStateChange } from "@/lib/auth";

const queryClient = new QueryClient();

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useLocation();
  const locationRef = useRef(location);
  const authRef = useRef(isAuthenticated);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    authRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    // Check authentication status
    const checkAuth = async () => {
      if (!mounted) return;
      const authStatus = await isLoggedIn();
      setIsAuthenticated(authStatus);
      setLoading(false);

      if (!authStatus) {
        setLocation("/login");
      }
    };

    checkAuth();

    // Listen for auth state changes using Supabase
    const subscription = onAuthStateChange((session) => {
      if (!mounted) return;
      const newAuthStatus = !!session;
      setIsAuthenticated(newAuthStatus);

      const currentPath = locationRef.current;
      const wasAuthenticated = authRef.current;

      if (newAuthStatus) {
        // Jangan paksa balik ke dashboard kalau user sedang di halaman lain.
        // Redirect ke "/" hanya ketika user berada di halaman login (baru login).
        if (!wasAuthenticated && currentPath === "/login") {
          setLocation("/");
        }
      } else {
        // Kalau logout / session hilang, paksa ke halaman login.
        if (currentPath !== "/login") {
          setLocation("/login");
        }
      }

      authRef.current = newAuthStatus;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setLocation]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium animate-pulse">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        {isAuthenticated ? (
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/kasir" component={Kasir} />
              <Route path="/transaksi" component={Transaksi} />
              <Route path="/pelanggan" component={Pelanggan} />
              <Route path="/layanan" component={Layanan} />
              <Route path="/jadwal-kunjungan" component={JadwalKunjungan} />
              <Route path="/setting" component={Setting} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        ) : (
          <Route component={() => {
            useEffect(() => { setLocation("/login"); }, []);
            return null;
          }} />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="tokopembantu-theme">
      <AdminModeProvider>
        <NotificationProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              {/* Wouter Router */}
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>

              {/* Global toaster */}
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </NotificationProvider>
      </AdminModeProvider>
    </ThemeProvider>
  );
}

export default App;