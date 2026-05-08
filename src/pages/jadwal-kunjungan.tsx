import { useState, useMemo, useEffect } from "react";
import { useListCustomers } from "@/lib/supabase-client-react";
import { getSalesIdsAdmin, updateCustomerAdmin } from "@/lib/supabase-service";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Calendar, Pencil, Trash2, Clock, X, MapPin, Phone, Hash, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useAdminMode } from "@/components/admin-mode-provider";
import { supabase } from "@/lib/supabase";

interface VisitSchedule {
  id?: number;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  customerCode?: string;
  customerAddress?: string;
  customerKecamatan?: string;
  customerKab?: string;
  customerMapUrl?: string;
  visited?: boolean;
  visited_at?: string;
  salesId?: string;
  salesName?: string;
  day: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const DAYS = [
  { value: "senin", label: "Senin" },
  { value: "selasa", label: "Selasa" },
  { value: "rabu", label: "Rabu" },
  { value: "kamis", label: "Kamis" },
  { value: "jumat", label: "Jumat" },
  { value: "sabtu", label: "Sabtu" },
];

function emptyForm(): VisitSchedule {
  return { customerId: 0, customerName: "", customerCode: "", customerPhone: "", customerAddress: "", customerKecamatan: "", customerKab: "", customerMapUrl: "", salesId: "", salesName: "", day: "senin", notes: "" };
}

export function JadwalKunjungan() {
  const { toast } = useToast();
  const { adminMode, isAdmin } = useAdminMode();
  const queryClient = useQueryClient();
  const isReadOnly = !(adminMode && isAdmin);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<VisitSchedule>(emptyForm());
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("all");
  const [salesOptions, setSalesOptions] = useState<Array<{ userId: string; salesId: string }>>([]);
  const [selectedSalesFilter, setSelectedSalesFilter] = useState<string>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [detailSchedule, setDetailSchedule] = useState<VisitSchedule | null>(null);

  const { data: customers } = useListCustomers(adminMode && isAdmin ? { adminAll: true } : undefined);

  // Get current user ID for sales filtering
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      } catch (error) {
        console.error('Error getting user:', error);
      }
    };
    getUserId();
  }, []);

  // Load sales options
  useEffect(() => {
    const loadSales = async () => {
      if (!(adminMode && isAdmin)) return;
      try {
        const entries = await getSalesIdsAdmin();
        const normalized = (entries || [])
          .map((e) => ({ userId: e.userId, salesId: String(e.salesId ?? "") }))
          .sort((a, b) => (a.salesId || a.userId).localeCompare(b.salesId || b.userId));
        setSalesOptions(normalized);
      } catch (error) {
        console.error('Error loading sales options:', error);
      }
    };
    loadSales();
  }, [adminMode, isAdmin]);

  // Load schedules with react-query for auto-refresh on invalidation
  const { data: schedules = [], isLoading: loading } = useQuery({
    queryKey: ["visit_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_schedules')
        .select('*')
        .order('day', { ascending: true });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerCode: row.customer_code,
        customerAddress: row.customer_address,
        customerKecamatan: row.customer_kecamatan,
        customerKab: row.customer_kab,
        customerMapUrl: row.customer_map_url,
        visited: row.visited || false,
        visited_at: row.visited_at,
        salesId: row.sales_id,
        salesName: row.sales_name,
        day: row.day,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('visit_schedules_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visit_schedules' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["visit_schedules"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isSameLocalDay = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  useEffect(() => {
    const resetIfNewDay = async () => {
      if (!isReadOnly) return;
      if (!currentUserId) return;
      if (!schedules?.length) return;

      const now = new Date();
      const needReset = schedules
        .filter((s) => s.salesId === currentUserId)
        .filter((s) => s.visited)
        .filter((s) => {
          if (!s.visited_at) return true;
          const d = new Date(s.visited_at);
          return Number.isNaN(d.getTime()) || !isSameLocalDay(d, now);
        });

      if (needReset.length === 0) return;

      try {
        const ids = needReset.map((s) => s.id).filter(Boolean) as number[];
        if (ids.length === 0) return;
        const { error } = await supabase
          .from('visit_schedules')
          .update({ visited: false, visited_at: null })
          .in('id', ids);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["visit_schedules"] });
      } catch (error) {
        console.error('Error resetting visited status:', error);
      }
    };

    resetIfNewDay();
  }, [isReadOnly, currentUserId, schedules, queryClient]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (schedule: VisitSchedule) => {
    setEditId(schedule.id || null);
    setForm({
      customerId: schedule.customerId,
      customerName: schedule.customerName,
      customerPhone: schedule.customerPhone,
      customerCode: schedule.customerCode || "",
      customerAddress: schedule.customerAddress || "",
      customerKecamatan: schedule.customerKecamatan || "",
      customerKab: schedule.customerKab || "",
      customerMapUrl: schedule.customerMapUrl || "",
      visited: schedule.visited || false,
      visited_at: schedule.visited_at || "",
      salesId: schedule.salesId || "",
      salesName: schedule.salesName || "",
      day: schedule.day,
      notes: schedule.notes,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.customerName || !form.day) {
      toast({ title: "Nama pelanggan dan hari wajib diisi", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const dataToSave = {
        user_id: user?.id || null,
        customer_id: form.customerId,
        customer_name: form.customerName,
        customer_phone: form.customerPhone || null,
        customer_code: form.customerCode || null,
        customer_address: form.customerAddress || null,
        customer_kecamatan: form.customerKecamatan || null,
        customer_kab: form.customerKab || null,
        customer_map_url: form.customerMapUrl || null,
        visited: form.visited || false,
        visited_at: form.visited ? form.visited_at || new Date().toISOString() : null,
        sales_id: form.salesId || null,
        sales_name: form.salesName || null,
        day: form.day,
        notes: form.notes || null,
      };

      if (editId) {
        const { error } = await supabase
          .from('visit_schedules')
          .update(dataToSave)
          .eq('id', editId);

        if (error) throw error;
        toast({ title: "Jadwal diperbarui", variant: "primary" });
      } else {
        const { error } = await supabase
          .from('visit_schedules')
          .insert([dataToSave]);

        if (error) throw error;
        toast({ title: "Jadwal baru ditambahkan", variant: "primary" });
      }

      // Sync customer data back to customers table (for both new and edit)
      if (form.customerId) {
        try {
          await updateCustomerAdmin(form.customerId, {
            code: form.customerCode,
            name: form.customerName,
            phone: form.customerPhone,
            address: form.customerAddress,
            kab: form.customerKab,
            kecamatan: form.customerKecamatan,
          });
        } catch (syncErr) {
          console.error('Error syncing customer data:', syncErr);
        }

        // Also sync customer data to all other visit_schedules with the same customer_id
        try {
          const customerSnapshot = {
            customer_name: form.customerName,
            customer_phone: form.customerPhone || null,
            customer_code: form.customerCode || null,
            customer_address: form.customerAddress || null,
            customer_kecamatan: form.customerKecamatan || null,
            customer_kab: form.customerKab || null,
            customer_map_url: form.customerMapUrl || null,
          };
          await supabase
            .from('visit_schedules')
            .update(customerSnapshot)
            .eq('customer_id', form.customerId)
            .neq('id', editId || 0);
        } catch (syncErr) {
          console.error('Error syncing to other schedules:', syncErr);
        }
      }

      setShowDialog(false);
      queryClient.invalidateQueries({ queryKey: ["visit_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({ title: "Gagal menyimpan jadwal", variant: "destructive" });
    }
  };

  const toggleVisited = async (schedule: VisitSchedule) => {
    if (!schedule.id) return;
    const newVisited = !schedule.visited;
    try {
      const { error } = await supabase
        .from('visit_schedules')
        .update({
          visited: newVisited,
          visited_at: newVisited ? new Date().toISOString() : null,
        })
        .eq('id', schedule.id);
      if (error) throw error;
      toast({ title: newVisited ? "Ditandai sudah dikunjungi" : "Ditandai belum dikunjungi", variant: "primary" });
      queryClient.invalidateQueries({ queryKey: ["visit_schedules"] });
    } catch (error) {
      console.error('Error toggling visited:', error);
      toast({ title: "Gagal mengubah status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('visit_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Jadwal dihapus", variant: "primary" });
      queryClient.invalidateQueries({ queryKey: ["visit_schedules"] });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({ title: "Gagal menghapus jadwal", variant: "destructive" });
    }
  };

  // Filter schedules by day, sales, and search
  const filteredSchedules = useMemo(() => {
    // Wait for currentUserId before showing schedules in sales mode to avoid flash
    if (isReadOnly && !currentUserId) return [];
    return schedules.filter(schedule => {
      // Sales users only see their own schedules
      if (isReadOnly && currentUserId) {
        if (schedule.salesId !== currentUserId) return false;
      }
      const dayMatch = selectedDayFilter === "all" || schedule.day === selectedDayFilter;
      const salesMatch = isReadOnly || selectedSalesFilter === "all" || schedule.salesId === selectedSalesFilter;
      const searchMatch = !search || 
        schedule.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (schedule.customerPhone && schedule.customerPhone.includes(search)) ||
        (schedule.salesName && schedule.salesName.toLowerCase().includes(search.toLowerCase()));
      return dayMatch && salesMatch && searchMatch;
    });
  }, [schedules, selectedDayFilter, selectedSalesFilter, search, isReadOnly, currentUserId]);

  // Group schedules by day
  const schedulesByDay = useMemo(() => {
    const grouped: Record<string, VisitSchedule[]> = {};
    DAYS.forEach(day => {
      grouped[day.value] = filteredSchedules.filter(s => s.day === day.value);
    });
    return grouped;
  }, [filteredSchedules]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Jadwal Kunjungan Sales</h1>
          <p className="text-muted-foreground text-xs">
            {isReadOnly ? "Lihat jadwal kunjungan Anda" : "Kelola jadwal kunjungan pelanggan"}
          </p>
        </div>
        {!isReadOnly && (
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Jadwal</span>
            </Button>
          </motion.div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative group flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Cari nama pelanggan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-card/50 border-none shadow-sm focus-visible:ring-primary focus-within:ring-1 ring-primary/20"
          />
        </div>
        {!isReadOnly && (
          <Select value={selectedSalesFilter} onValueChange={setSelectedSalesFilter}>
            <SelectTrigger className="w-full sm:w-40 h-11 bg-card/50 border-none shadow-sm">
              <SelectValue placeholder="Semua Sales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sales</SelectItem>
              {salesOptions.map(sales => (
                <SelectItem key={sales.userId} value={sales.userId}>{sales.salesId || sales.userId}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={selectedDayFilter} onValueChange={setSelectedDayFilter}>
          <SelectTrigger className="w-full sm:w-40 h-11 bg-card/50 border-none shadow-sm">
            <SelectValue placeholder="Semua Hari" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Hari</SelectItem>
            {DAYS.map(day => (
              <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schedule Grid */}
      <div className="space-y-4 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : Object.keys(schedulesByDay).length === 0 || filteredSchedules.length === 0 ? (
          <Card className="border-none shadow-sm bg-card/50">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">
                {search || selectedDayFilter !== "all" ? "Jadwal tidak ditemukan" : "Belum ada jadwal kunjungan"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {search || selectedDayFilter !== "all" ? "Coba ubah filter pencarian" : "Tambahkan jadwal kunjungan baru"}
              </p>
            </CardContent>
          </Card>
        ) : (
          DAYS.map(day => {
            const daySchedules = schedulesByDay[day.value];
            if (!daySchedules || daySchedules.length === 0) return null;

            return (
              <div key={day.value} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">{day.label}</h3>
                  <Badge variant="outline" className="text-xs">
                    {daySchedules.length} pelanggan
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {daySchedules.map((schedule) => (
                    <Card key={schedule.id} className={`overflow-hidden border-none shadow-sm cursor-pointer hover:bg-primary/10 transition-colors relative ${schedule.visited ? 'bg-primary/5 border-l-2 border-l-primary' : 'bg-card/50'}`} onClick={() => setDetailSchedule(schedule)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm truncate">{schedule.customerName}</p>
                              {schedule.visited && isReadOnly && (
                                <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-primary mt-0.5 font-bold">
                              {[schedule.salesName, schedule.customerCode || customers?.find(c => c.id === schedule.customerId)?.code].filter(Boolean).join(" - ")}
                            </p>
                            {schedule.customerPhone && (
                              <p className="text-xs text-muted-foreground mt-0.5">{schedule.customerPhone}</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              {schedule.customerMapUrl && (
                                <a
                                  href={schedule.customerMapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MapPin className="w-3 h-3" />
                                  Lihat Maps
                                </a>
                              )}
                              {!isReadOnly && schedule.visited && (
                                <Badge className="text-[10px] gap-1 bg-primary/10 text-primary border-0 inline-flex items-center ml-auto">
                                  <CheckCircle className="w-3 h-3" />
                                  Selesai
                                </Badge>
                              )}
                            </div>
                            {schedule.notes && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{schedule.notes}</p>
                            )}
                          </div>
                          {isReadOnly && (
                            <Button
                              size="sm"
                              variant={schedule.visited ? "default" : "outline"}
                              className={`h-6 px-2 text-[10px] gap-1 shrink-0 ${schedule.visited ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                              onClick={(e) => { e.stopPropagation(); toggleVisited(schedule); }}
                            >
                              <CheckCircle className="w-3 h-3" />
                              {schedule.visited ? 'Selesai' : 'Kunjungi'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!isReadOnly && (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm">
              {editId != null ? "Edit Jadwal" : "Tambah Jadwal"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editId != null ? "Perbarui jadwal kunjungan pelanggan." : "Tambahkan jadwal kunjungan baru."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Nama Sales</Label>
              <Select
                value={form.salesId || ""}
                onValueChange={(value) => {
                  const sales = salesOptions.find(s => s.userId === value);
                  setForm({
                    ...form,
                    salesId: value,
                    salesName: sales?.salesId || sales?.userId || "",
                  });
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih sales" />
                </SelectTrigger>
                <SelectContent>
                  {salesOptions.map(sales => (
                    <SelectItem key={sales.userId} value={sales.userId}>
                      {sales.salesId || sales.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Nama Pelanggan *</Label>
              {form.customerName ? (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-xs">
                  <span className="flex-1 truncate font-medium">{form.customerName}{form.customerCode ? ` - ${form.customerCode}` : ""}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 shrink-0"
                    onClick={() => {
                      setForm({ ...form, customerId: 0, customerName: "", customerPhone: "", customerCode: "", customerAddress: "", customerKecamatan: "", customerKab: "" });
                      setCustomerSearch("");
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Ketik nama pelanggan..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                  {customerSearch && (
                    <div className="max-h-32 overflow-y-auto rounded-md border bg-card shadow-sm">
                      {customers
                        ?.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                        .slice(0, 20)
                        .map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors truncate"
                            onClick={() => {
                              setForm({
                                ...form,
                                customerId: customer.id || 0,
                                customerName: customer.name,
                                customerPhone: customer.phone,
                                customerCode: customer.code,
                                customerAddress: customer.address,
                                customerKecamatan: customer.kecamatan,
                                customerKab: customer.kab,
                              });
                              setCustomerSearch("");
                            }}
                          >
                            {customer.name}{customer.code ? ` - ${customer.code}` : ""}
                          </button>
                        ))}
                      {customers?.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Pelanggan tidak ditemukan</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {form.customerName && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Nama Pelanggan</Label>
                  <Input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="Nama pelanggan"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">ID Pelanggan</Label>
                    <Input
                      value={form.customerCode || ""}
                      onChange={(e) => setForm({ ...form, customerCode: e.target.value })}
                      placeholder="ID Pelanggan"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">No Telp</Label>
                    <Input
                      value={form.customerPhone || ""}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      placeholder="08xxxxxxxxxx"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Alamat</Label>
                  <Input
                    value={form.customerAddress || ""}
                    onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                    placeholder="Alamat"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Kecamatan</Label>
                    <Input
                      value={form.customerKecamatan || ""}
                      onChange={(e) => setForm({ ...form, customerKecamatan: e.target.value })}
                      placeholder="Kecamatan"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Kabupaten</Label>
                    <Input
                      value={form.customerKab || ""}
                      onChange={(e) => setForm({ ...form, customerKab: e.target.value })}
                      placeholder="Kabupaten"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[11px]">Hari Kunjungan *</Label>
              <Select
                value={form.day}
                onValueChange={(value) => setForm({ ...form, day: value })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih hari" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(day => (
                    <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">URL Google Maps</Label>
              <Input
                placeholder="https://maps.google.com/..."
                value={form.customerMapUrl || ""}
                onChange={(e) => setForm({ ...form, customerMapUrl: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <motion.div whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
              <Button onClick={handleSave} className="w-full sm:w-auto">
                Simpan
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="w-full sm:w-auto">
                Batal
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Detail Popup */}
      <Dialog open={!!detailSchedule} onOpenChange={() => setDetailSchedule(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Detail Pelanggan</DialogTitle>
            <DialogDescription>Detail informasi pelanggan</DialogDescription>
          </DialogHeader>
          {detailSchedule && (
            <>
              {/* Header */}
              <div className="bg-primary px-6 pt-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
                    <span className="text-primary-foreground font-bold text-sm">{detailSchedule.customerName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base truncate text-primary-foreground">{detailSchedule.customerName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-primary-foreground/80 font-bold truncate">
                        {[detailSchedule.salesName, detailSchedule.customerCode].filter(Boolean).join(" - ")}
                      </p>

                      {!isReadOnly && (
                        <div className="flex gap-1 shrink-0 ml-auto">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                            onClick={() => {
                              openEdit(detailSchedule);
                              setDetailSchedule(null);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                            onClick={() => {
                              if (detailSchedule.id) handleDelete(detailSchedule.id);
                              setDetailSchedule(null);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-4 space-y-4">
                {/* ID & Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5">
                    <Hash className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ID Pelanggan</p>
                      <p className="text-sm font-semibold mt-0.5">{detailSchedule.customerCode || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">No Telp</p>
                      <p className="text-sm font-semibold mt-0.5">{detailSchedule.customerPhone || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Alamat</p>
                    <p className="text-sm font-semibold mt-0.5">{detailSchedule.customerAddress || "-"}</p>
                  </div>
                </div>

                {/* Kecamatan & Kabupaten */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kecamatan</p>
                      <p className="text-sm font-semibold mt-0.5">{detailSchedule.customerKecamatan || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kabupaten</p>
                      <p className="text-sm font-semibold mt-0.5">{detailSchedule.customerKab || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {detailSchedule.notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Catatan</p>
                    <p className="text-sm italic">{detailSchedule.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-6 pb-5 pt-2 flex gap-2">
                {detailSchedule.customerMapUrl && (
                  <a
                    href={detailSchedule.customerMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full gap-2" size="sm">
                      <MapPin className="w-4 h-4" />
                      Buka Google Maps
                    </Button>
                  </a>
                )}
                {detailSchedule.customerPhone && (
                  <a
                    href={`https://wa.me/${detailSchedule.customerPhone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full gap-2" size="sm">
                      <Phone className="w-4 h-4" />
                      Hubungi
                    </Button>
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
