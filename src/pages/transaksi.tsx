import { useState, useEffect } from "react";
import { useListTransactions, useDeleteTransaction, getListTransactionsQueryKey } from "@/lib/supabase-client-react";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Receipt, Trash2, Filter, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminMode } from "@/components/admin-mode-provider";
import { getSalesIdsAdmin } from "@/lib/supabase-service";
import { supabase } from "@/lib/supabase";

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function Transaksi() {
  const { adminMode, isAdmin } = useAdminMode();
  const showAdminControls = adminMode && isAdmin;
  const { data: transactions, isLoading } = useListTransactions(
    showAdminControls ? { adminAll: true } : undefined
  );
  const [selectedTransaction, setSelectedTransaction] = useState<NonNullable<typeof transactions>[number] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteTransaction = useDeleteTransaction();
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [salesOptions, setSalesOptions] = useState<Array<{ userId: string; salesId: string }>>([]);
  const [selectedSalesFilter, setSelectedSalesFilter] = useState<string>("all");

  useEffect(() => {
    const channel = supabase
      .channel('transactions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  const filteredTransactions = transactions?.filter(trx => {
    if (selectedSalesFilter === "all") return true;
    return trx.userId === selectedSalesFilter;
  }) || [];

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handleDeleteAllBySales = async () => {
    if (selectedSalesFilter === "all") return;
    
    setIsDeletingAll(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', selectedSalesFilter);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Semua riwayat sales berhasil dihapus", variant: "primary" });
    } catch (error) {
      console.error('Error deleting all by sales:', error);
      toast({ title: "Gagal menghapus riwayat", variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDelete = (id: number) => {
    deleteTransaction.mutate(
      { id },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ["transactions"] });
          toast({ title: "Transaksi dihapus", variant: "primary" });
        },
        onError: () => {
          toast({ title: "Gagal menghapus transaksi", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Riwayat Transaksi</h1>
          <p className="text-muted-foreground text-[10px] sm:text-xs">Daftar semua transaksi yang telah dilakukan.</p>
        </div>
        
        {showAdminControls && (
          <div className="flex items-center gap-2">
            <Select value={selectedSalesFilter} onValueChange={(val) => { setSelectedSalesFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 bg-card/50 border-none shadow-sm">
                <SelectValue placeholder="Semua Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sales</SelectItem>
                {salesOptions.map(sales => (
                  <SelectItem key={sales.userId} value={sales.userId}>{sales.salesId || sales.userId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2 sm:space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-28 w-full rounded-xl" />
          ))
        ) : !transactions?.length ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center">
              <Receipt className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mb-3 sm:mb-4" />
              <p className="text-muted-foreground">Belum ada transaksi</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {currentTransactions.map((trx) => (
              <Card key={trx.id} className="relative cursor-pointer" onClick={() => setSelectedTransaction(trx)}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-semibold text-sm sm:text-base">{trx.customerName || "Pelanggan Umum"}</p>
                      {trx.customerCode && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                          {trx.customerCode}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        {`${formatDate(trx.createdAt, "dd MMMM yyyy").toLowerCase()} - ${formatDate(trx.createdAt, "HH:mm")}`}
                      </span>
                      <span className="text-primary font-bold text-sm sm:text-base whitespace-nowrap">{formatRupiah(trx.total)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge
                      variant="default"
                      className="text-[10px] sm:text-xs px-2 py-0.5 !bg-primary !text-primary-foreground"
                    >
                      Selesai
                    </Badge>
                    <div className="flex items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {adminMode && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 sm:h-9"
                                disabled={deleteTransaction.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini tidak bisa dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(trx.id)}>
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 h-7 w-7 p-0 sm:h-8 sm:w-auto sm:px-3"
                          onClick={() => setSelectedTransaction(trx)}
                        >
                          <Receipt className="w-3 h-3" />
                          <span className="hidden sm:inline">Detail</span>
                        </Button>
                      </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground ml-1">
                  {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} dari {filteredTransactions.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(prev => Math.max(1, prev - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(prev => Math.min(totalPages, prev + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={currentPage === totalPages}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tanggal</span>
                  <span className="text-sm">{formatDate(selectedTransaction.createdAt, "dd MMMM yyyy, HH:mm")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pelanggan</span>
                  <span className="text-sm font-medium">{selectedTransaction.customerName || "Pelanggan Umum"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ID Customer</span>
                  <span className="text-sm font-medium">{selectedTransaction.customerCode || "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">No Telp</span>
                  <span className="text-sm font-medium">{selectedTransaction.customerPhone || "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Alamat</span>
                  <span className="text-sm font-medium text-right max-w-[60%] overflow-hidden whitespace-nowrap">{selectedTransaction.customerAddress || "-"}</span>
                </div>
                {(selectedTransaction.customerKecamatan || selectedTransaction.customerKab) && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Kec/Kab</span>
                    <span className="text-sm font-medium text-right max-w-[60%]">{[selectedTransaction.customerKecamatan, selectedTransaction.customerKab].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Rincian Item</h4>
                <div className="space-y-2">
                  {selectedTransaction.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex-1">
                        <span className="font-medium">{item.quantity}x</span>
                        <span className="ml-2">{item.productName}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          @{formatRupiah(item.price)}
                        </span>
                      </div>
                      <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span>{formatRupiah(selectedTransaction.subtotal)}</span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Diskon ({selectedTransaction.discount}%)</span>
                    <span className="text-red-600">-{formatRupiah(selectedTransaction.subtotal * (selectedTransaction.discount / 100))}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-base font-bold pt-2 border-t">
                  <span>Grand Total</span>
                  <span className="text-primary">{formatRupiah(selectedTransaction.total)}</span>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
