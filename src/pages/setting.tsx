import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings, Palette, Shield, HelpCircle, Trash2, Moon, Sun, Type, Download, Mail, Phone, ExternalLink, FileSpreadsheet, BookOpen, DollarSign, FileText, BarChart3, Users, Calendar, LogOut, RefreshCw, Lock, User as UserIcon } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { useEffect, useState } from "react";
import { logout, getCurrentUser, onAuthStateChange } from "@/lib/auth";
import { getAllSettings, setSetting, deleteAllTransactions, getSalesIdsAdmin } from "@/lib/supabase-service";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { useAdminMode } from "@/components/admin-mode-provider";
import { supabase } from "@/lib/supabase";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { motion } from "framer-motion";
import { formatNumber, parseNumber } from "@/lib/format";
import { User } from "@supabase/supabase-js";

export default function Setting() {
  const { theme, setTheme, fontSize, setFontSize, primaryColor, setPrimaryColor } = useTheme();
  const { toast } = useToast();

  const [h, s, l] = (primaryColor || "145 85% 40%").split(" ").map(v => parseInt(v));
  const [hue, setHue] = useState(h || 145);
  const [saturation, setSaturation] = useState(s || 85);
  const [lightness, setLightness] = useState(l || 40);

  useEffect(() => {
    setPrimaryColor(`${hue} ${saturation}% ${lightness}%`);
  }, [hue, saturation, lightness]);
  const { adminMode, setAdminMode, isAdmin } = useAdminMode();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const [remoteSalesOptions, setRemoteSalesOptions] = useState<Array<{ userId: string; salesId: string }>>([]);
  const [remoteSelectedUserId, setRemoteSelectedUserId] = useState<string>("all");
  const [remoteEnabled, setRemoteEnabled] = useState<boolean>(false);
  const [remoteLoading, setRemoteLoading] = useState<boolean>(false);
  const [salesId, setSalesId] = useState("");
  const [isSavingSalesId, setIsSavingSalesId] = useState(false);
  const [customerCodePrefix, setCustomerCodePrefix] = useState("");
  const [isSavingPrefix, setIsSavingPrefix] = useState(false);

  const [isDeletingData, setIsDeletingData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      }

      try {
        const settings = await getAllSettings();

        const savedSalesId = settings?.salesId ?? "";
        setSalesId(String(savedSalesId ?? ""));
        
        const savedPrefix = settings?.customerCodePrefix ?? "";
        setCustomerCodePrefix(String(savedPrefix ?? ""));
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const sub = onAuthStateChange((session) => {
      setUser(session?.user ?? null);
    });

    const handleAuthChangeEvent = () => {
      getCurrentUser()
        .then((u) => setUser(u))
        .catch(() => setUser(null));
    };

    window.addEventListener("auth-change", handleAuthChangeEvent);

    return () => {
      window.removeEventListener("auth-change", handleAuthChangeEvent);
      sub?.unsubscribe();
    };
  }, []);

  const handleSaveSalesId = async () => {
    if (!user) return;
    setIsSavingSalesId(true);
    try {
      await setSetting('salesId', salesId);

      // Save to localStorage for quick access (per-user key)
      if (user?.id) {
        localStorage.setItem(`tokopembantu:sales_id:${user.id}`, salesId);
      }
      
      toast({
        title: "Berhasil",
        description: "Sales ID berhasil disimpan",
        variant: "primary",
      });
    } catch (error: any) {
      toast({
        title: "Gagal menyimpan",
        description: error?.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsSavingSalesId(false);
    }
  };

  const handleSavePrefix = async () => {
    if (!user) return;
    setIsSavingPrefix(true);
    try {
      await setSetting('customerCodePrefix', customerCodePrefix.toUpperCase());

      // Save to localStorage for quick access (per-user key)
      if (user?.id) {
        localStorage.setItem(`tokopembantu:customer_code_prefix:${user.id}`, customerCodePrefix.toUpperCase());
      }

      toast({
        title: "Berhasil",
        description: "Prefix ID Pelanggan berhasil disimpan",
        variant: "primary",
      });
    } catch (error: any) {
      toast({
        title: "Gagal menyimpan",
        description: error?.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsSavingPrefix(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Berhasil Logout",
        description: "Sampai jumpa kembali!",
        variant: "primary",
      });
      window.location.href = "/login";
    } catch (error: any) {
      toast({
        title: "Gagal Logout",
        description: error.message || "Terjadi kesalahan saat logout",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllData = async () => {
    setIsDeletingData(true);
    try {
      await deleteAllTransactions();
      toast({
        title: "Berhasil",
        description: "Semua riwayat penjualan berhasil dihapus",
        variant: "primary",
      });
    } catch (error: any) {
      console.error('Error deleting transactions:', error);
      toast({
        title: "Gagal",
        description: error?.message || "Terjadi kesalahan saat menghapus riwayat penjualan",
        variant: "destructive",
      });
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleAdminModeToggle = (checked: boolean) => {
    if (!isAdmin) return;
    if (checked) {
      setShowPasswordDialog(true);
    } else {
      setAdminMode(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (!isAdmin) return;
    if (adminPassword === "admin123") {
      setAdminMode(true);
      setShowPasswordDialog(false);
      setAdminPassword("");
      toast({
        title: "Mode Admin Aktif",
        description: "Tombol hapus dan edit telah ditampilkan",
        variant: "primary",
      });
    } else {
      toast({
        title: "Password Salah",
        description: "Password yang Anda masukkan tidak benar",
        variant: "destructive",
      });
      setAdminPassword("");
    }
  };

  useEffect(() => {
    const loadSalesOptions = async () => {
      if (!isAdmin) return;
      try {
        const entries = await getSalesIdsAdmin();
        const normalized = (entries || [])
          .map((e) => ({ userId: e.userId, salesId: String(e.salesId ?? "") }))
          .sort((a, b) => (a.salesId || a.userId).localeCompare(b.salesId || b.userId));
        setRemoteSalesOptions(normalized);
      } catch (e) {
        console.error("Error loading sales options:", e);
      }
    };

    loadSalesOptions();
  }, [isAdmin]);

  useEffect(() => {
    const loadRemoteState = async () => {
      if (!isAdmin) return;
      if (!adminMode) return;
      if (remoteSelectedUserId === "all") {
        setRemoteEnabled(false);
        return;
      }

      setRemoteLoading(true);
      try {
        const { data, error } = await supabase
          .from("admin_remote_mode")
          .select("enabled")
          .eq("user_id", remoteSelectedUserId)
          .maybeSingle();

        if (error) {
          console.error("Error loading remote state:", error);
          setRemoteEnabled(false);
        } else {
          setRemoteEnabled(Boolean((data as any)?.enabled));
        }
      } finally {
        setRemoteLoading(false);
      }
    };

    loadRemoteState();
  }, [adminMode, isAdmin, remoteSelectedUserId]);

  const handleRemoteToggle = async (checked: boolean) => {
    if (!isAdmin) return;
    if (!adminMode) return;
    if (remoteSelectedUserId === "all") return;

    setRemoteLoading(true);
    try {
      const { error } = await supabase
        .from("admin_remote_mode")
        .upsert({
          user_id: remoteSelectedUserId,
          enabled: checked,
          enabled_by: user?.id ?? null,
          enabled_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      setRemoteEnabled(checked);
      toast({
        title: "Berhasil",
        description: checked ? "Mode koreksi diaktifkan untuk sales" : "Mode koreksi dimatikan untuk sales",
        variant: "primary",
      });
    } catch (e: any) {
      console.error("Error setting remote mode:", e);
      toast({
        title: "Gagal",
        description: e?.message || "Gagal mengubah mode koreksi",
        variant: "destructive",
      });
    } finally {
      setRemoteLoading(false);
    }
  };

  const APP_BRAND_STORAGE_KEY = "kantongmas:app_brand";
  const DEFAULT_APP_BRAND = "Kantong Mas";
  const [appBrand, setAppBrand] = useState(() => {
    try {
      return localStorage.getItem(APP_BRAND_STORAGE_KEY) ?? DEFAULT_APP_BRAND;
    } catch {
      return DEFAULT_APP_BRAND;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(APP_BRAND_STORAGE_KEY, appBrand);
    } catch {
      // ignore
    }

    try {
      window.dispatchEvent(new Event("tokopembantu:app_brand_changed"));
    } catch {
      // ignore
    }
  }, [appBrand]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6" />
        <h1 className="text-xl font-bold">Pengaturan</h1>
      </div>

      <div className="grid gap-4">
        {/* Tampilan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/monitor.png" alt="Tampilan" className="w-4 h-4 object-contain" />
              Tampilan
            </CardTitle>
            <CardDescription>Sesuaikan tampilan aplikasi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-brand">Nama Brand (Header)</Label>
              <Input
                id="app-brand"
                value={appBrand}
                onChange={(e) => setAppBrand(e.target.value)}
                placeholder="Kantong Mas"
              />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Warna Tema Utama</p>
                    <p className="text-xs text-muted-foreground">Geser untuk menyesuaikan warna aplikasi</p>
                  </div>
                </div>
                <div 
                  className="w-10 h-10 rounded-full border-2 border-background shadow-lg transition-colors duration-200" 
                  style={{ backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)` }}
                />
              </div>
              
              <div className="space-y-3 px-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Hue (Warna)</span>
                    <span>{hue}°</span>
                  </div>
                  <Slider 
                    value={[hue]} 
                    min={0} 
                    max={360} 
                    step={1} 
                    onValueChange={([v]) => setHue(v)}
                    className="py-2"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Saturation (Ketajaman)</span>
                    <span>{saturation}%</span>
                  </div>
                  <Slider 
                    value={[saturation]} 
                    min={0} 
                    max={100} 
                    step={1} 
                    onValueChange={([v]) => setSaturation(v)}
                    className="py-2"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Lightness (Terang/Gelap)</span>
                    <span>{lightness}%</span>
                  </div>
                  <Slider 
                    value={[lightness]} 
                    min={20} 
                    max={80} 
                    step={1} 
                    onValueChange={([v]) => setLightness(v)}
                    className="py-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/dark-mode.png" alt="Dark Mode" className="w-4 h-4 object-contain" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Mode Gelap</p>
                  <p className="text-xs text-muted-foreground">Aktifkan tema gelap</p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/tools.png" alt="Font" className="w-4 h-4 object-contain" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Ukuran Font</p>
                  <p className="text-xs text-muted-foreground">Atur ukuran teks</p>
                </div>
              </div>
              <Select value={fontSize} onValueChange={(val: any) => setFontSize(val)}>
                <div className="scale-90 md:scale-100 origin-right">
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Pilih ukuran" />
                  </SelectTrigger>
                </div>
                <SelectContent>
                  <SelectItem value="sm">Kecil</SelectItem>
                  <SelectItem value="base">Sedang</SelectItem>
                  <SelectItem value="lg">Besar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Keamanan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/shield.png" alt="Keamanan" className="w-4 h-4 object-contain" />
              Keamanan & Data
            </CardTitle>
            <CardDescription>Pengaturan keamanan akun dan data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 border-b pb-4 border-border/50">
              <div className="flex items-center gap-2">
                <img src="/man.png" alt="User" className="w-4 h-4 object-contain" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">User Login</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? "-"}</p>
                </div>
              </div>
              
              <div className="space-y-1.5 pl-6">
                <Label htmlFor="salesId" className="text-[10px] uppercase tracking-wider text-muted-foreground">Sales ID</Label>
                <div className="flex gap-2">
                  <Input 
                    id="salesId"
                    placeholder="Masukkan ID Sales" 
                    value={salesId}
                    onChange={(e) => setSalesId(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button 
                    size="sm" 
                    className="h-8 px-3 text-xs"
                    onClick={handleSaveSalesId}
                    disabled={isSavingSalesId || !user}
                  >
                    {isSavingSalesId ? "..." : "Simpan"}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 pl-6">
                <Label htmlFor="customerCodePrefix" className="text-[10px] uppercase tracking-wider text-muted-foreground">Prefix ID Pelanggan</Label>
                <div className="flex gap-2">
                  <Input 
                    id="customerCodePrefix"
                    placeholder="A"
                    maxLength={1}
                    value={customerCodePrefix}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      if (value.length <= 1) {
                        setCustomerCodePrefix(value);
                      }
                    }}
                    className="h-8 text-xs w-16"
                  />
                  <Button 
                    size="sm" 
                    className="h-8 px-3 text-xs"
                    onClick={handleSavePrefix}
                    disabled={isSavingPrefix || !user}
                  >
                    {isSavingPrefix ? "..." : "Simpan"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Contoh: CTM-A00001 (1 huruf)</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/padlock.png" alt="Admin" className="w-4 h-4 object-contain" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Mode Admin</p>
                  <p className="text-xs text-muted-foreground">Aktifkan Hak Akses Penuh Admin</p>
                </div>
              </div>
              <Switch checked={adminMode} onCheckedChange={handleAdminModeToggle} disabled={!isAdmin} />
            </div>

            {!isAdmin && (
              <p className="text-[10px] text-muted-foreground">
                Mode koreksi hanya bisa diaktifkan oleh Admin.
              </p>
            )}

            <Button 
              variant="outline" 
              className="w-full justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleLogout}
            >
              Logout
            </Button>

            <div className="border-t pt-4 mt-4">
              {adminMode && (
                <>
                  {isAdmin && (
                    <div className="border rounded-md p-3 bg-muted/20 mb-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Mode Koreksi (Remote)</p>
                        <p className="text-xs text-muted-foreground">Admin bisa aktifkan edit/hapus untuk sales tertentu</p>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pilih Sales</Label>
                        <Select value={remoteSelectedUserId} onValueChange={setRemoteSelectedUserId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih sales" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Pilih sales...</SelectItem>
                            {remoteSalesOptions.map((opt) => (
                              <SelectItem key={opt.userId} value={opt.userId}>
                                {opt.salesId ? opt.salesId : opt.userId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">Aktifkan Mode Koreksi</p>
                          <p className="text-xs text-muted-foreground">Sales bisa edit/hapus data miliknya sendiri</p>
                        </div>
                        <Switch
                          checked={remoteEnabled}
                          onCheckedChange={handleRemoteToggle}
                          disabled={remoteLoading || remoteSelectedUserId === "all"}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <div>
                      <p className="text-sm font-medium text-destructive">Hapus Riwayat Penjualan</p>
                      <p className="text-xs text-muted-foreground">Hapus semua riwayat transaksi penjualan</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <motion.div whileTap={{ scale: 0.95 }} className="w-full">
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          disabled={isDeletingData}
                        >
                          {isDeletingData ? "Menghapus..." : "Hapus Riwayat Penjualan"}
                        </Button>
                      </motion.div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Hapus Riwayat Penjualan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tindakan ini akan menghapus SEMUA riwayat transaksi penjualan dari database.
                          <p className="mt-2 text-destructive font-semibold">Tindakan ini TIDAK DAPAT dibatalkan!</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAllData}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Ya, Hapus Riwayat
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bantuan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/help-desk.png" alt="Bantuan" className="w-4 h-4 object-contain" />
              Bantuan
            </CardTitle>
            <CardDescription>Dapatkan bantuan teknis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <img src="/book.png" alt="Guide" className="w-4 h-4 mr-2 object-contain" />
                  Panduan Penggunaan
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto no-scrollbar rounded-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <img src="/book.png" alt="Guide" className="w-5 h-5 object-contain" />
                    Panduan Penggunaan Aplikasi
                  </DialogTitle>
                  <DialogDescription className="text-left ml-7">
                    Panduan Aplikasi Kantong Mas v.1.0
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  {/* Overview */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
                      <Settings className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-bold">Management System</p>
                        <p className="text-xs text-muted-foreground">Sistem manajemen modern dan terintegrasi</p>
                      </div>
                    </div>
                  </div>

                  {/* Main Features */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Fitur Utama
                    </h3>
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3 p-3 rounded-md border">
                        <Users className="h-4 w-4 mt-0.5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">Manajemen Pelanggan</p>
                          <p className="text-xs text-muted-foreground">Tambah, edit, dan kelola data pelanggan dengan mudah</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-md border">
                        <Calendar className="h-4 w-4 mt-0.5 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">Pantau Riwayat Transaksi</p>
                          <p className="text-xs text-muted-foreground">Lihat dan pantau semua riwayat transaksi penjualan secara detail</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-md border">
                        <DollarSign className="h-4 w-4 mt-0.5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium">Kasir & Penjualan</p>
                          <p className="text-xs text-muted-foreground">Atur produk, harga, dan proses transaksi kasir</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-md border">
                        <FileText className="h-4 w-4 mt-0.5 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium">Laporan & Analitik</p>
                          <p className="text-xs text-muted-foreground">Pantau performa bisnis dengan laporan detail</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-md border">
                        <BarChart3 className="h-4 w-4 mt-0.5 text-orange-500" />
                        <div>
                          <p className="text-sm font-medium">Dashboard Profesional</p>
                          <p className="text-xs text-muted-foreground">Dashboard interaktif untuk memantau performa bisnis Anda secara real-time</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Start Guide */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Panduan Mulai Cepat
                    </h3>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</div>
                        <div>
                          <p className="text-sm font-medium">Input Data Pelanggan</p>
                          <p className="text-xs text-muted-foreground">Input data pelanggan tetap untuk mempermudah transaksi</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</div>
                        <div>
                          <p className="text-sm font-medium">Kelola Pelanggan</p>
                          <p className="text-xs text-muted-foreground">Tambah, edit, dan kelola data pelanggan untuk mempermudah transaksi</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</div>
                        <div>
                          <p className="text-sm font-medium">Multi Login & Mode Admin</p>
                          <p className="text-xs text-muted-foreground">Gunakan banyak akun sales dan kontrol penuh melalui Mode Admin</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <p className="text-[10px] text-center w-full text-muted-foreground italic">
                    Panduan Penggunaan Aplikasi Kantong Mas
                  </p>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <img src="/settings.png" alt="Support" className="w-4 h-4 mr-2 object-contain" />
                  Hubungi Support
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-primary">
                    <img src="/settings.png" alt="Support" className="w-5 h-5 object-contain" />
                    Dukungan Teknis
                  </DialogTitle>
                  <DialogDescription className="text-left ml-7">Copyright © 2026 Kantong Mas Dev</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-primary bg-muted/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] dark:shadow-[0_0_20px_rgba(var(--primary),0.1)] transition-all">
                    <div>
                      <p className="text-sm font-bold text-primary">EL Project Development</p>
                      <p className="text-xs text-muted-foreground">Official System Developer</p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                      <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                        <img src="/hacker.png" alt="Developer" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <a href="mailto:support@elproject.dev" className="flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors group">
                      <img src="/email.png" alt="Email" className="h-4 w-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                      <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">elproject.dev@gmail.com</span>
                      <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                    <a href="https://wa.me/6283867180887" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors group">
                      <img src="/whatsapp.png" alt="WhatsApp" className="h-4 w-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                      <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">+62 838-6718-0887</span>
                      <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  </div>
                </div>
                <DialogFooter>
                  <p className="text-[10px] text-center w-full text-muted-foreground italic">Kami Siap Membantu Anda Setiap Saat</p>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Admin Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => !open && (setShowPasswordDialog(false), setAdminPassword(""))}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src="/padlock.png" alt="Admin" className="w-5 h-5 object-contain" />
              Password Admin
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan password untuk mengaktifkan mode admin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Masukkan password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePasswordSubmit();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button onClick={handlePasswordSubmit} className="w-full sm:w-auto">
              Konfirmasi
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPasswordDialog(false);
                setAdminPassword("");
              }}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
