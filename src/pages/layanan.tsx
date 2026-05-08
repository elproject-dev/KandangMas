import { useState, useRef } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey } from "@/lib/supabase-client-react";
import { formatRupiah, formatNumber, parseNumber } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Package, Pencil, Trash2, Upload, Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useAdminMode } from "@/components/admin-mode-provider";

interface ProductForm {
  name: string;
  priceTiers: { label: string; price: string; hpp: string }[];
  isActive: boolean;
}

function emptyForm(): ProductForm {
  return { name: "", priceTiers: [], isActive: true };
}

export function Layanan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { adminMode, isAdmin } = useAdminMode();
  const canManageProducts = adminMode && isAdmin;
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());

  const { data: products, isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });

  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleExcel = async () => {
    try {
      const data = [
        {
          "Nama Produk": "Kertas Nasi MB 25 x 35",
          "Varian": "1 bal",
          "Harga Jual": 40000,
          "HPP": 35000,
          "Satuan": "bal",
          "Aktif (Y/T)": "Y"
        },
        {
          "Nama Produk": "Kertas Nasi MB 25 x 35",
          "Varian": "5 bal",
          "Harga Jual": 120000,
          "HPP": 100000,
          "Satuan": "bal",
          "Aktif (Y/T)": "Y"
        },
        {
          "Nama Produk": "Sendok Makan Jerapah PS",
          "Varian": "1 dus",
          "Harga Jual": 40000,
          "HPP": 32000,
          "Satuan": "dus",
          "Aktif (Y/T)": "Y"
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Produk");
      
      const wscols = [
        { wch: 30 }, // Nama Produk
        { wch: 15 }, // Varian
        { wch: 15 }, // Harga Jual
        { wch: 15 }, // HPP
        { wch: 10 }, // Satuan
        { wch: 10 }, // Aktif
      ];
      worksheet["!cols"] = wscols;

      const fileName = "sample_produk_tokopembantu.xlsx";

      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

      if (isTauri) {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const filePath = await save({
          defaultPath: fileName,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        
        if (filePath) {
          await writeFile(filePath, new Uint8Array(wbout as ArrayBuffer));
          toast({ title: "Sample Excel berhasil disimpan" });
        }
        return;
      }

      if (Capacitor.isNativePlatform()) {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        
        const result = await Filesystem.writeFile({
          path: fileName,
          data: wbout,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Sample Produk Kantong Mas',
          text: 'Unduh file sample excel untuk import produk',
          url: result.uri,
          dialogTitle: 'Simpan file sample',
        });
      } else {
        XLSX.writeFile(workbook, fileName);
      }
      
      toast({ title: "Sample Excel berhasil diunduh" });
    } catch (error) {
      console.error('Download error:', error);
      toast({ 
        title: "Gagal mengunduh file", 
        description: "Terjadi kesalahan saat menyiapkan file",
        variant: "destructive" 
      });
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast({ title: "File Excel kosong", variant: "destructive" });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Group by product name to handle variants
        const groupedProducts = new Map<string, any>();

        for (const item of data) {
          const name = item["Nama Produk"];
          const variantLabel = item["Varian"];
          const price = Number(item["Harga Jual"] || item["Harga"] || 0);
          const hpp = Number(item["HPP"] || 0);
          const unit = item["Satuan"] || "pcs";
          const isActive = String(item["Aktif (Y/T)"]).toUpperCase() === "Y";

          if (!name || isNaN(price)) continue;

          if (!groupedProducts.has(name)) {
            groupedProducts.set(name, {
              name,
              unit,
              isActive,
              priceTiers: []
            });
          }

          const product = groupedProducts.get(name);
          product.priceTiers.push({
            label: variantLabel || "Default",
            price,
            hpp
          });
        }

        for (const [name, productData] of groupedProducts) {
          try {
            // Use first tier as base price/hpp
            const basePrice = productData.priceTiers[0]?.price || 0;
            const baseHpp = productData.priceTiers[0]?.hpp || 0;

            await createProduct.mutateAsync({
              data: {
                ...productData,
                price: basePrice,
                hpp: baseHpp,
                global: true
              }
            });
            successCount++;
          } catch (err) {
            errorCount++;
          }
        }

        toast({ 
          title: "Import selesai", 
          description: `${successCount} berhasil, ${errorCount} gagal.`,
          variant: successCount > 0 ? "primary" : "destructive"
        });
        
        if (successCount > 0) invalidate();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        toast({ title: "Gagal memproses file Excel", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (s: NonNullable<typeof products>[number]) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      priceTiers: (s.priceTiers ?? []).map(t => ({
        label: String(t.label ?? ""),
        price: formatNumber(String(t.price ?? "")),
        hpp: formatNumber(String(t.hpp ?? "")),
      })),
      isActive: s.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Nama produk wajib diisi", variant: "destructive" });
      return;
    }
    try {
      const priceTiers = (form.priceTiers || [])
        .map(t => ({
          label: String(t.label || "").trim(),
          price: Number(parseNumber(t.price)),
          hpp: Number(parseNumber(t.hpp)),
        }))
        .filter(t => t.label && Number.isFinite(t.price) && t.price > 0);

      if (priceTiers.length === 0) {
        toast({ title: "Harga varian wajib diisi", description: "Tambahkan minimal 1 varian harga", variant: "destructive" });
        return;
      }

      const basePrice = priceTiers[0]?.price ?? 0;
      const baseHpp = priceTiers[0]?.hpp ?? 0;

      const data = {
        name: form.name,
        price: basePrice,
        hpp: baseHpp,
        priceTiers,
        isActive: form.isActive,
      };
      if (editId) {
        await updateProduct.mutateAsync({ id: editId, data, allowGlobal: true });
        toast({ title: "Produk diperbarui", variant: "primary" });
      } else {
        await createProduct.mutateAsync({ data: { ...data, global: true } });
        toast({ title: "Produk baru ditambahkan", variant: "primary" });
      }
      setShowDialog(false);
      invalidate();
    } catch {
      toast({ title: "Gagal menyimpan produk", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProduct.mutateAsync({ id, allowGlobal: true });
      toast({ title: "Produk dihapus", variant: "primary" });
      invalidate();
    } catch {
      toast({ title: "Gagal menghapus produk", variant: "destructive" });
    }
  };

  // Flat list
  const productList = products ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Daftar Produk</h1>
          <p className="text-muted-foreground text-xs">Kelola produk dan harga produk</p>
        </div>
        {canManageProducts && (
          <div className="hidden sm:flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button 
                size="sm" 
                onClick={() => setShowImportDialog(true)}
                className="gap-2 h-9 text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button onClick={openCreate} size="sm" className="gap-2 h-9 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      {/* Mobile Import & Tambah Buttons */}
      {canManageProducts && (
        <div className="sm:hidden flex flex-col gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button 
              size="sm" 
              onClick={() => setShowImportDialog(true)}
              className="gap-2 h-8 text-[10px] w-full"
            >
              <Upload className="w-3 h-3" />
              Import
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={openCreate} size="sm" className="gap-2 h-8 text-[10px] w-full">
              <Plus className="w-3 h-3" />
              Tambah
            </Button>
          </motion.div>
        </div>
      )}

      {/* Product list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : !products?.length ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Belum ada produk</p>
            <p className="text-sm text-muted-foreground/70">Tambah produk pertama Anda</p>
          </CardContent>
        </Card>
      ) : productList.map((s: any) => s && (
            <Card key={s.id} className={!s.isActive ? "opacity-60" : ""}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{s.name}</p>
                        {!s.isActive && <Badge variant="secondary" className="text-[10px] mt-1">Nonaktif</Badge>}
                      </div>

                      <span className="inline-flex text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded-full shrink-0">
                        {s.priceTiers?.length || 0} Varian
                      </span>
                    </div>

                    <div className="mt-2">
                      {Array.isArray(s.priceTiers) && s.priceTiers.length > 0 ? (
                        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                          {(s.priceTiers as any[]).map((t, idx) => (
                            <div key={idx} className="contents">
                              <span className="text-xs text-muted-foreground truncate">{String(t?.label ?? "-")}</span>
                              <span className="text-primary font-semibold text-xs text-right tabular-nums">
                                {formatRupiah(Number(t?.price ?? 0) || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto] gap-x-3">
                          <span className="text-xs text-muted-foreground truncate">Harga</span>
                          <span className="text-primary font-semibold text-xs text-right tabular-nums">
                            {formatRupiah(s.price)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {canManageProducts && (
                      <>
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(s)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-xs sm:max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Import Produk
            </DialogTitle>
            <DialogDescription className="text-[10px] leading-relaxed">
              Gunakan file Excel untuk mengunggah daftar produk sekaligus.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4 py-4">
            <div className="flex flex-col gap-3">
              <div className="p-4 border-2 border-dashed border-muted rounded-xl bg-muted/20 text-center">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground mb-4">Pastikan format kolom sesuai dengan sample</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={downloadSampleExcel}
                >
                  <Download className="w-4 h-4" />
                  Unduh Sample Excel
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Kemudian</span>
                </div>
              </div>

              <Button 
                onClick={() => {
                  setShowImportDialog(false);
                  fileInputRef.current?.click();
                }}
                className="w-full gap-2 h-11"
              >
                <Upload className="w-4 h-4" />
                Pilih & Upload File
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowImportDialog(false)} className="w-full text-xs">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
            <DialogDescription>
              {editId ? "Perbarui detail produk dan harga." : "Buat produk baru untuk ditampilkan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nama Produk *</Label>
              <Input placeholder="Masukkan nama produk..." value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Varian</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setForm(f => ({
                    ...f,
                    priceTiers: [...(f.priceTiers || []), { label: "", price: "", hpp: "" }],
                  }))}
                >
                  Tambah Varian
                </Button>
              </div>
              {(form.priceTiers || []).length === 0 ? (
                <div className="text-xs text-muted-foreground">Belum ada varian harga</div>
              ) : (
                <div className="space-y-3">
                  {(form.priceTiers || []).map((t, idx) => (
                    <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 relative">
                            <Input
                              placeholder="Nama varian (contoh: 1 Box / Satuan)"
                              value={t.label}
                              onChange={(e) => setForm(f => ({
                                ...f,
                                priceTiers: (f.priceTiers || []).map((x, i) => i === idx ? { ...x, label: e.target.value } : x),
                              }))}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="w-10 h-10 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => setForm(f => ({
                              ...f,
                              priceTiers: (f.priceTiers || []).filter((_, i) => i !== idx),
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase">Harga Jual</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="Harga Jual"
                              value={t.price}
                              onChange={(e) => setForm(f => ({
                                ...f,
                                priceTiers: (f.priceTiers || []).map((x, i) => i === idx ? { ...x, price: formatNumber(e.target.value) } : x),
                              }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase">HPP</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="HPP"
                              value={t.hpp}
                              onChange={(e) => setForm(f => ({
                                ...f,
                                priceTiers: (f.priceTiers || []).map((x, i) => i === idx ? { ...x, hpp: formatNumber(e.target.value) } : x),
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Aktif</Label>
                <p className="text-xs text-muted-foreground">Tampilkan di order</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending} className="w-full sm:w-auto">
              {createProduct.isPending || updateProduct.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="w-full sm:w-auto">Batal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
