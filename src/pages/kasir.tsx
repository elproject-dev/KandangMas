import { useState, useMemo, useEffect } from "react";
import { useListProducts, useListCustomers, useCreateTransaction, useCreateCustomer, getListCustomersQueryKey } from "@/lib/supabase-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatRupiah, formatNumber, parseNumber, formatDate, normalizeCustomerCode } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Minus, ShoppingCart, Box, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/lib/supabase-client-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications } from "@/components/notification-provider";
import { getSetting, getAllSettings } from "@/lib/supabase-service";
import { motion } from "framer-motion";

export function Kasir() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { settings: notifSettings, sendNotification, permissionStatus } = useNotifications();

  const { data: products } = useListProducts();
  const { data: customers } = useListCustomers();
  const createTransaction = useCreateTransaction();
  const createCustomer = useCreateCustomer();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("general");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerKecamatan, setCustomerKecamatan] = useState("");
  const [customerKab, setCustomerKab] = useState("");
  const [customerCodePrefix, setCustomerCodePrefix] = useState("");

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const queryClient = useQueryClient();

  // Auto-generate next customer code (CTM-{PREFIX}00001 format)
  const nextCustomerCode = useMemo(() => {
    if (!customers || customers.length === 0) {
      return `CTM-${customerCodePrefix.toUpperCase()}00001`;
    }
    const codes = customers
      .map((c: any) => c.code || "")
      .filter(code => code.toUpperCase().startsWith(`CTM-${customerCodePrefix.toUpperCase()}`))
      .map((code: string) => {
        const num = parseInt(code.replace(/^CTM-[A-Za-z]/, ""), 10);
        return isNaN(num) ? 0 : num;
      })
      .filter((n: number) => n > 0);
    const maxNum = codes.length > 0 ? Math.max(...codes) : 0;
    return `CTM-${customerCodePrefix.toUpperCase()}${String(maxNum + 1).padStart(5, "0")}`;
  }, [customers, customerCodePrefix]);

  // Auto-fill customer code for new customers
  useEffect(() => {
    if (selectedCustomerId === "general" && customers && !showConfirmDialog && !createTransaction.isPending) {
      if (customerCodePrefix) {
        setCustomerCode(nextCustomerCode);
      } else {
        setCustomerCode("");
      }
    }
  }, [nextCustomerCode, selectedCustomerId, customers, showConfirmDialog, createTransaction.isPending, customerCodePrefix]);

  // Load customer code prefix from settings
  useEffect(() => {
    const loadPrefix = async () => {
      try {
        const settings = await getAllSettings();
        const savedPrefix = settings?.customerCodePrefix ?? "";
        setCustomerCodePrefix(String(savedPrefix));
      } catch (error) {
        console.error('Error loading customer code prefix:', error);
      }
    };
    loadPrefix();
  }, []);

  const [cart, setCart] = useState<{ product: Product; quantity: number; unitPrice: number; tierLabel?: string }[]>([]);
  const [periodeMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [periodeYear] = useState<string>(String(new Date().getFullYear()));
  const [searchTerm, setSearchTerm] = useState("");
  const [showServiceList, setShowServiceList] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<string>("1");
  const [addUnitPrice, setAddUnitPrice] = useState<number>(0);
  const [addTierLabel, setAddTierLabel] = useState<string>("");
  const CASHIER_SETTINGS_STORAGE_KEY = "tokopembantu:cashier_settings";

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const total = subtotal;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((s: any) =>
      s.isActive &&
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  // Load settings from Supabase
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getAllSettings();
        
        try {
          localStorage.setItem(
            CASHIER_SETTINGS_STORAGE_KEY,
            JSON.stringify({
              customerCodePrefix: settings.customerCodePrefix,
            }),
          );
        } catch {
          // ignore
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Check for transferred reservation data from janji page
  useEffect(() => {
    const transferredData = localStorage.getItem('kasir_cart_from_reservation');
    if (transferredData) {
      try {
        const data = JSON.parse(transferredData);
        if (data.cart && Array.isArray(data.cart)) {
          // Populate cart
          setCart(data.cart.map((item: any) => ({
            ...item,
            unitPrice: item.unitPrice ?? item.product?.price ?? 0,
          })));
        }
        if (data.customerName) {
          // Find customer by name or phone
          const customer = customers?.find(c => c.name === data.customerName || c.phone === data.customerPhone);
          if (customer) {
            setSelectedCustomerId(customer.id.toString());
          }
        }
        // Clear the localStorage after loading
        localStorage.removeItem('kasir_cart_from_reservation');
      } catch (e) {
        console.error('Error loading transferred data:', e);
      }
    }
  }, [customers]);

  const openAddDialog = (product: Product) => {
    setAddProduct(product);
    setAddQty("1");
    setAddUnitPrice(0);
    setAddTierLabel("pending_selection");
    setShowAddProductDialog(true);
  };

  const confirmAddToCart = () => {
    if (!addProduct) return;
    if (addTierLabel === "pending_selection") {
      toast({ title: "Pilih varian harga", description: "Silakan pilih salah satu varian harga terlebih dahulu", variant: "destructive" });
      return;
    }
    const qty = Number(parseNumber(addQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Qty tidak valid", variant: "destructive" });
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === addProduct.id && item.unitPrice === addUnitPrice && (item.tierLabel || "") === (addTierLabel || ""));
      if (existing) {
        return prev.map(item => (item.product.id === addProduct.id && item.unitPrice === addUnitPrice && (item.tierLabel || "") === (addTierLabel || ""))
          ? { ...item, quantity: item.quantity + qty }
          : item
        );
      }
      return [...prev, { product: addProduct, quantity: qty, unitPrice: addUnitPrice, tierLabel: addTierLabel || undefined }];
    });
    setShowAddProductDialog(false);
    setSearchTerm("");
    setShowServiceList(false);
  };

  const incrementCartItem = (productId: number, unitPrice: number, tierLabel?: string) => {
    setCart(prev => prev.map(item => (item.product.id === productId && item.unitPrice === unitPrice && (item.tierLabel || "") === (tierLabel || ""))
      ? { ...item, quantity: item.quantity + 1 }
      : item
    ));
  };

  const removeFromCart = (productId: number, unitPrice: number, tierLabel?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId && item.unitPrice === unitPrice && (item.tierLabel || "") === (tierLabel || ""));
      if (existing && existing.quantity > 1) {
        return prev.map(item => (item.product.id === productId && item.unitPrice === unitPrice && (item.tierLabel || "") === (tierLabel || ""))
          ? { ...item, quantity: item.quantity - 1 }
          : item
        );
      }
      return prev.filter(item => !(item.product.id === productId && item.unitPrice === unitPrice && (item.tierLabel || "") === (tierLabel || "")));
    });
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase().trim();
    return (customers || []).filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    ).slice(0, 10);
  }, [customers, customerSearch]);

  const handleSelectCustomer = (c: any) => {
    setSelectedCustomerId(String(c.id));
    setCustomerSearch("");
    setShowCustomerResults(false);
    setCustomerName(c.name || "");
    setCustomerCode(normalizeCustomerCode(c.code));
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
    setCustomerKecamatan(c.kecamatan || "");
    setCustomerKab(c.kab || "");
  };

  const handleClearCustomer = async () => {
    setCustomerSearch("");
    setCustomerName("");
    setCustomerCode("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerKecamatan("");
    setCustomerKab("");
    // Invalidate cache
    await queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  };

  const selectedCustomer = selectedCustomerId === "general"
    ? null
    : customers?.find((c: any) => String(c.id) === selectedCustomerId);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({ title: "Keranjang kosong", variant: "destructive" });
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmCheckout = async () => {
    setShowConfirmDialog(false);

    let customerId = selectedCustomerId === "general" ? undefined : Number(selectedCustomerId);

    // Auto-create customer if name is entered manually
    if (selectedCustomerId === "general" && customerName.trim() && customerName !== "Pelanggan Umum") {
      if (!customerPhone || !String(customerPhone).trim()) {
        toast({
          title: "No Telp wajib diisi",
          description: "Untuk pelanggan baru, silakan isi nomor telepon terlebih dahulu.",
          variant: "destructive",
        });
        return;
      }
      if (!customerAddress || !String(customerAddress).trim()) {
        toast({
          title: "Alamat wajib diisi",
          description: "Untuk pelanggan baru, silakan isi alamat terlebih dahulu.",
          variant: "destructive",
        });
        return;
      }
      if (!customerKecamatan || !String(customerKecamatan).trim()) {
        toast({
          title: "Kecamatan wajib diisi",
          description: "Untuk pelanggan baru, silakan isi kecamatan terlebih dahulu.",
          variant: "destructive",
        });
        return;
      }
      if (!customerKab || !String(customerKab).trim()) {
        toast({
          title: "Kabupaten wajib diisi",
          description: "Untuk pelanggan baru, silakan isi kabupaten terlebih dahulu.",
          variant: "destructive",
        });
        return;
      }
      try {
        const newCustomer = await createCustomer.mutateAsync({
          data: {
            code: customerCode || null,
            name: customerName.trim(),
            phone: customerPhone || null,
            address: customerAddress || null,
            kab: customerKab || null,
            kecamatan: customerKecamatan || null,
          }
        });
        customerId = newCustomer.id;
      } catch (err) {
        console.error("Failed to auto-create customer:", err);
      }
    }

    const transactionData = {
      customerId,
      items: cart.map(item => ({
        productId: Number(item.product.id),
        productName: String(item.product.name),
        quantity: Number(item.quantity),
        price: Number(item.unitPrice),
        subtotal: Number(item.unitPrice * item.quantity),
        tierLabel: item.tierLabel ?? null,
      })),
      discount: 0,
      subtotal: Number(subtotal),
      total: Number(total),
      customerName: customerName || "Pelanggan Umum",
      customerPhone: customerPhone || null,
      customerCode: customerCode || null,
      customerAddress: customerAddress || null,
      customerKab: customerKab || null,
      customerKecamatan: customerKecamatan || null,
      periodeMonth: Number(periodeMonth),
      periodeYear: Number(periodeYear),
    };

    processTransaction(transactionData);
  };

  const processTransaction = (transactionData: any) => {
    createTransaction.mutate(
      {
        data: transactionData,
      },
      {
        onSuccess: async (data) => {
          toast({
            title: "Transaksi berhasil!",
            variant: "primary"
          });

          if (notifSettings.payments && permissionStatus === "granted") {
            sendNotification("Pembayaran berhasil", { body: `Total: ${formatRupiah(total)}` } as any);
          }

          setCart([]);
          handleClearCustomer();
        },
        onError: (error: any) => {
          console.error("Error creating transaction:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          toast({
            title: "Gagal menyimpan transaksi",
            description: error?.message || "Terjadi kesalahan",
            variant: "destructive"
          });
        },
      }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {/* Service Grid */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col space-y-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Order</h1>
            <p className="text-muted-foreground text-xs">Pilih produk untuk ditambahkan ke keranjang.</p>
          </div>
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari produk..."
              className="pl-9 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground font-normal border h-10 bg-muted/30"
            onClick={() => setShowServiceList(!showServiceList)}
          >
            <div className="flex items-center gap-2">
              <Plus className={`h-4 w-4 transition-transform ${showServiceList ? "rotate-45" : ""}`} />
              {showServiceList ? "Tutup Daftar Produk" : "Pilih Produk"}
            </div>
            {showServiceList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

        {(showServiceList || searchTerm.length >= 2) && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
            {filteredProducts.map((product: any) => {
              const inCart = cart.find(item => item.product.id === product.id);
              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all ${inCart ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}
                  onClick={() => openAddDialog(product)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2 relative">
                    {inCart && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
                        {inCart.quantity}
                      </div>
                    )}
                    <div className="flex items-center justify-center text-primary mb-1">
                      <Box className="w-8 h-8" />
                    </div>
                    <div className="font-medium text-sm line-clamp-2">{product.name}</div>
                    <div className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                      {(product?.priceTiers?.length || 0)} Varian
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-10 text-center text-muted-foreground text-sm">
                Produk tidak ditemukan
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="lg:col-span-1">
        <Card className="sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Transaksi Pos
              {cart.length > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item
                </span>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5 relative">
              <Label className="text-xs">Pelanggan</Label>
              {selectedCustomerId !== "general" ? (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-background text-xs">
                  <span className="flex-1 truncate font-medium">{selectedCustomer?.name || "Pelanggan"}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => { handleClearCustomer(); }}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari Pelanggan..."
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerResults(true); }}
                    onFocus={() => { if (customerSearch.trim()) setShowCustomerResults(true); }}
                    onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                    className="h-9 text-xs pl-8"
                  />
                  {showCustomerResults && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 top-10 left-0 right-0 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between items-center"
                          onMouseDown={() => { handleSelectCustomer(c); }}
                        >
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Pelanggan</Label>
                <Input
                  placeholder="Nama"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Pelanggan</Label>
                  <Input
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    className="h-9 text-xs"
                    readOnly={selectedCustomerId === "general"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">No Telp</Label>
                  <Input
                    placeholder="08xxxxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alamat</Label>
                <Input
                  placeholder="Alamat"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kecamatan</Label>
                  <Input
                    placeholder="Kecamatan"
                    value={customerKecamatan}
                    onChange={(e) => setCustomerKecamatan(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kabupaten</Label>
                  <Input
                    placeholder="Kabupaten"
                    value={customerKab}
                    onChange={(e) => setCustomerKab(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">Belum ada produk</div>
              ) : (
                cart.map(item => (
                  <div key={`${item.product.id}-${item.unitPrice}-${item.tierLabel || ""}`} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs leading-tight truncate">{item.product.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {item.tierLabel ? `${item.tierLabel} · ` : ""}{formatRupiah(item.unitPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-center">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => removeFromCart(Number(item.product.id), item.unitPrice, item.tierLabel)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => incrementCartItem(Number(item.product.id), item.unitPrice, item.tierLabel)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-xs font-medium w-20 text-right shrink-0 mr-3">
                      {formatRupiah(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground mr-3">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t mr-3">
                <span>Grand Total</span>
                <span className="text-primary">{formatRupiah(total)}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <motion.div
              className="w-full"
              whileTap={{
                filter: "brightness(0.99)",
                y: 2,
              }}
              transition={{ duration: 0.08 }}
            >
              <Button
                className="w-full h-11 text-base font-semibold gap-2"
                onClick={handleCheckout}
                disabled={cart.length === 0 || createTransaction.isPending}
              >
                {createTransaction.isPending ? "Memproses..." : "Proses Transaksi"}
              </Button>
            </motion.div>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => window.location.reload()}
              >
                Refresh Order
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Varian & Qty</DialogTitle>
            <DialogDescription>
              {addProduct ? addProduct.name : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Varian Harga</Label>
              <div className="flex flex-col gap-2">
                {(addProduct?.priceTiers ?? []).map((t) => (
                  <Button
                    key={`${t.label}-${t.price}`}
                    type="button"
                    variant={addTierLabel === String(t.label) ? "default" : "outline"}
                    className="h-10 justify-between"
                    onClick={() => {
                      setAddTierLabel(String(t.label));
                      setAddUnitPrice(Number(t.price));
                    }}
                  >
                    <span className="text-xs">{t.label}</span>
                    <span className="text-xs font-bold">{formatRupiah(Number(t.price))}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Qty</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button 
              type="button" 
              onClick={confirmAddToCart}
              disabled={addTierLabel === "pending_selection"}
              className="w-full"
            >
              Tambah ke Keranjang
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowAddProductDialog(false)}
              className="w-full"
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Transaction Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Konfirmasi Transaksi</DialogTitle>
            <DialogDescription className="text-xs">Periksa detail transaksi sebelum melanjutkan</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            {/* Customer info */}
            {(customerName || customerCode) && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Pelanggan</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {customerCode && <><span className="text-muted-foreground">ID</span><span className="font-medium">{customerCode}</span></>}
                  <><span className="text-muted-foreground">Nama</span><span className="font-medium">{customerName || "Pelanggan Umum"}</span></>
                  {customerPhone && <><span className="text-muted-foreground">Telp</span><span className="font-medium">{customerPhone}</span></>}
                  {customerAddress && <><span className="text-muted-foreground">Alamat</span><span className="font-medium col-span-1">{customerAddress}</span></>}
                  {customerKecamatan && <><span className="text-muted-foreground">Kecamatan</span><span className="font-medium">{customerKecamatan}</span></>}
                  {customerKab && <><span className="text-muted-foreground">Kabupaten</span><span className="font-medium">{customerKab}</span></>}
                </div>
              </div>
            )}
            {/* Items */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Item Pesanan</p>
              {cart.map(item => (
                <div key={`${item.product.id}-${item.unitPrice}-${item.tierLabel || ""}`} className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product.name}</p>
                    <p className="text-muted-foreground">
                      {item.tierLabel ? `${item.tierLabel} · ` : ""}{formatRupiah(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold ml-2">{formatRupiah(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex justify-between font-bold text-sm">
                <span>Grand Total</span>
                <span className="text-primary">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row sm:flex-row">
            <Button
              className="w-full"
              onClick={confirmCheckout}
              disabled={createTransaction.isPending}
            >
              {createTransaction.isPending ? "Memproses..." : "Konfirmasi"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowConfirmDialog(false)}
              disabled={createTransaction.isPending}
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
