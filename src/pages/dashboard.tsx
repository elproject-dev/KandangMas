import { useGetDashboardSummary, useGetRevenueChart, useGetTopProducts, useGetRecentTransactions, useListProducts, useListCustomers, useListTransactions } from "@/lib/supabase-client-react";
import { getTransactions, getAllSettings, getSalesIdsAdmin } from "@/lib/supabase-service";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ExcelJS from "exceljs";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, Receipt, Calendar as CalendarIcon, TrendingUp, Download, Plus, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useAdminMode } from "@/components/admin-mode-provider";
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export function Dashboard() {
  const { toast } = useToast();
  const { adminMode, isAdmin } = useAdminMode();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("week");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadMonth, setDownloadMonth] = useState<number | "all">(new Date().getMonth() + 1);
  const [downloadYear, setDownloadYear] = useState<number>(new Date().getFullYear());
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [salesId, setSalesId] = useState<string>("");
  const [adminSalesOptions, setAdminSalesOptions] = useState<Array<{ userId: string; salesId: string }>>([]);
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string>("all");

  // Load Sales ID from settings
  useEffect(() => {
    const loadSalesId = async () => {
      try {
        const settings = await getAllSettings();
        const savedSalesId = settings?.salesId ?? "";
        setSalesId(String(savedSalesId));
      } catch (error) {
        console.error('Error loading Sales ID:', error);
      }
    };
    loadSalesId();
  }, []);

  useEffect(() => {
    const loadAdminSalesOptions = async () => {
      if (!(adminMode && isAdmin)) return;
      try {
        const entries = await getSalesIdsAdmin();
        const normalized = (entries || [])
          .map((e) => ({ userId: e.userId, salesId: String(e.salesId ?? "") }))
          .sort((a, b) => (a.salesId || a.userId).localeCompare(b.salesId || b.userId));
        setAdminSalesOptions(normalized);
      } catch (error) {
        console.error('Error loading admin sales options:', error);
      }
    };

    loadAdminSalesOptions();
  }, [adminMode, isAdmin]);

  
  
  const toDateOnlyString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const startOfWeekMonday = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const dayIndexMon0 = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - dayIndexMon0);
    return x;
  };
  
  const summaryRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    
    if (period === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      // Calculate Monday of current week (calendar week: Monday-Sunday)
      const dayOfWeek = start.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday as 0
      start.setDate(start.getDate() - daysFromMonday);
      start.setHours(0, 0, 0, 0);
      // Set end to Sunday of current week
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === "month") {
      const startOfMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      start.setTime(startOfMonth.getTime());
      const endOfMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);
      end.setTime(endOfMonth.getTime());
    } else if (period === "year") {
      // Dari 1 Januari tahun berjalan
      const startOfYear = new Date(end.getFullYear(), 0, 1);
      start.setTime(startOfYear.getTime());
      start.setHours(0, 0, 0, 0);
    }
    
    return {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [period]);

  const chartPeriod = period;
  const dashboardParams = useMemo(() => {
    const params: any = { period, startDate: summaryRange.startDate, endDate: summaryRange.endDate };
    if (adminMode && isAdmin) {
      if (selectedSalesUserId !== "all") {
        params.userId = selectedSalesUserId;
      } else {
        params.adminAll = true;
      }
    }
    return params;
  }, [period, summaryRange, adminMode, isAdmin, selectedSalesUserId]);

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(dashboardParams);
  const { data: chartData = [], isLoading: loadingChart } = useGetRevenueChart(dashboardParams);
  const { data: topProducts = [], isLoading: loadingTop } = useGetTopProducts(dashboardParams);
  const { data: recentTransactions = [], isLoading: loadingRecent } = useGetRecentTransactions({ ...dashboardParams, limit: 5 });
  const { data: periodTransactions = [], isLoading: loadingPeriodTransactions } = useListTransactions(dashboardParams);
  const { data: products, isLoading: loadingProducts } = useListProducts(
    (adminMode && isAdmin) ? {
      userId: dashboardParams.userId,
      adminAll: dashboardParams.adminAll
    } : undefined
  );
  const { data: customers } = useListCustomers(
    (adminMode && isAdmin) ? { 
      userId: dashboardParams.userId, 
      adminAll: dashboardParams.adminAll 
    } : undefined
  );

  // Use empty arrays/objects as fallback instead of mock data when data is explicitly empty
  const displaySummary = summary || { revenue: 0, transactionCount: 0, customerCount: 0, productCount: 0, orderCount: 0 };
  const displayChartData = chartData;
  const displayTopProducts = topProducts;
  const displayRecentTransactions = recentTransactions;

  const totalMarginAdmin = useMemo(() => {
    if (!(adminMode && isAdmin)) return 0;

    const productById = new Map<any, any>();
    const productByName = new Map<string, any>();

    if (Array.isArray(products)) {
      for (const p of products as any[]) {
        if (p?.id != null) productById.set(p.id, p);
        if (p?.name) productByName.set(String(p.name), p);
      }
    }

    let sum = 0;
    for (const t of (periodTransactions as any[]) || []) {
      for (const item of (t?.items as any[]) || []) {
        const qty = Number(item?.quantity || 0) || 0;
        const price = Number(item?.price || 0) || 0;
        if (qty <= 0) continue;

        let hpp = Number(item?.hpp || 0) || 0;
        if (!hpp) {
          const p = productById.get(item?.productId) || productByName.get(String(item?.productName || ""));
          if (p) {
            if (item?.tierLabel && Array.isArray(p?.priceTiers)) {
              const tier = (p.priceTiers as any[]).find((pt) => pt?.label === item.tierLabel);
              hpp = Number(tier?.hpp ?? p?.hpp ?? 0) || 0;
            } else {
              hpp = Number(p?.hpp ?? 0) || 0;
            }
          }
        }

        sum += (price - hpp) * qty;
      }
    }

    return sum;
  }, [adminMode, isAdmin, periodTransactions, products]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code: string; orderCount: number; total: number }>();

    for (const t of periodTransactions as any[]) {
      const name = t?.customerName || 'Pelanggan Umum';
      const code = t?.customerCode || '';
      const phone = t?.customerPhone || '';
      const key = code || phone || name;

      const prev = map.get(key) || { key, name, code, orderCount: 0, total: 0 };
      prev.orderCount += 1;
      prev.total += Number(t?.total || 0) || 0;

      if (!prev.name && name) prev.name = name;
      if (!prev.code && code) prev.code = code;
      map.set(key, prev);
    }

    return Array.from(map.values())
      .sort((a, b) => (b.orderCount - a.orderCount) || (b.total - a.total))
      .slice(0, 5);
  }, [periodTransactions]);

  const [animatedRevenue, setAnimatedRevenue] = useState<number>(0);
  const revenueAnimRef = useRef<number | null>(null);
  const prevRevenueRef = useRef<number>(0);

  useEffect(() => {
    if (loadingSummary) return;

    const target = Number(displaySummary.revenue ?? 0) || 0;
    const from = prevRevenueRef.current;
    prevRevenueRef.current = target;

    if (revenueAnimRef.current != null) {
      cancelAnimationFrame(revenueAnimRef.current);
      revenueAnimRef.current = null;
    }

    if (from === target) {
      setAnimatedRevenue(target);
      return;
    }

    const durationMs = 650;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      setAnimatedRevenue(value);

      if (t < 1) {
        revenueAnimRef.current = requestAnimationFrame(tick);
      } else {
        revenueAnimRef.current = null;
      }
    };

    revenueAnimRef.current = requestAnimationFrame(tick);

    return () => {
      if (revenueAnimRef.current != null) {
        cancelAnimationFrame(revenueAnimRef.current);
        revenueAnimRef.current = null;
      }
    };
  }, [displaySummary.revenue, loadingSummary]);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthLabelsFull = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const dayLabelsFull = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  // Get 6 months for mobile view (starting from current month)
  const getMobile6Months = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    const months = [];
    for (let i = 0; i < 6; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const year = currentMonth + i >= 12 ? currentYear + 1 : currentYear;
      months.push({
        label: monthLabels[monthIndex],
        monthIndex,
        year,
      });
    }
    return months;
  };

  const mobile6Months = getMobile6Months();
  const monthIndexFromLabel = (label: any): number | null => {
    if (label == null) return null;
    const s = String(label).trim();

    const m1 = s.match(/^(\d{4})-(\d{2})$/);
    if (m1) {
      const idx = Number(m1[2]) - 1;
      return idx >= 0 && idx <= 11 ? idx : null;
    }

    const n = Number(s);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) return n - 1;

    const idx = monthLabels.findIndex((m) => m.toLowerCase() === s.toLowerCase());
    return idx >= 0 ? idx : null;
  };

  const formatXAxisLabel = (label: any) => {
    if (label == null) return "";
    const s = String(label).trim();

    if (chartPeriod === "year") {
      const idx = monthIndexFromLabel(s);
      if (idx != null) return monthLabels[idx] ?? s;
    }

    if (chartPeriod === "week" && /^m\d+$/i.test(s)) {
      return s.toUpperCase();
    }

    // For daily chart (DD/MM format), show only DD
    if (chartPeriod === "today") {
      const parts = s.split("/");
      if (parts.length === 2) {
        return parts[0]; // Return only day
      }
    }

    return s;
  };

  const formatTooltipLabel = (label: any, payload?: any) => {
    if (label == null) return "";
    const s = String(label).trim();

    if (chartPeriod === "year") {
      // Check if label is a year (4 digits)
      if (/^\d{4}$/.test(s)) {
        // For year period with year labels (2026, 2027, etc), show fullDate from payload or return as is
        if (payload?.fullDate) {
          return payload.fullDate;
        }
        return s;
      }
      // Legacy: for month labels in year chart
      const idx = monthIndexFromLabel(s);
      if (idx != null) return monthLabelsFull[idx] ?? s;
      return s;
    }

    if (period === "month") {
      // Convert short month labels to full month name with year
      const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
      const monthLabelsFull = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const idx = monthLabels.indexOf(s);
      if (idx !== -1) {
        const year = summaryRange.startDate ? new Date(summaryRange.startDate).getFullYear() : new Date().getFullYear();
        return `${monthLabelsFull[idx]} ${year}`;
      }
    }

    if ((period === "today" || period === "week") && /^\d{2}$/.test(s)) {
      // For today/week period with date labels (01-12), show full date from payload
      if (payload?.fullDate) {
        return payload.fullDate;
      }
      // Fallback calculation
      const day = parseInt(s);
      const now = new Date();
      const date = new Date(now);
      date.setDate(date.getDate() - (11 - (day - 1)));
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (chartPeriod === "week" && /^m\d+$/i.test(s)) {
      return s.toUpperCase();
    }

    // For date labels (e.g., 01/04), show fuller date if possible
    if (chartPeriod === "today" || chartPeriod === "week") {
      // Try parsing DD/MM
      const parts = s.split('/');
      if (parts.length === 2) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        if (!isNaN(d) && !isNaN(m)) {
          const year = new Date().getFullYear();
          return `${String(d).padStart(2, '0')} ${monthLabels[m]} ${year}`;
        }
      }
    }

    return s;
  };

  const yearLabels = ["2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033", "2034"];

  const monthlyChartData = useMemo(() => {
    // Use 6 months for mobile, 12 months for desktop
    const base = isMobile
      ? mobile6Months.map((m) => ({ label: m.label, revenue: 0 }))
      : monthLabels.map((m) => ({ label: m, revenue: 0 }));

    for (const p of displayChartData as Array<any>) {
      const idx = monthIndexFromLabel(p?.label);
      if (idx == null) continue;

      // For mobile, only include data for months in rolling 6 months
      if (isMobile) {
        const rollingMonth = mobile6Months.find(m => m.monthIndex === idx);
        if (!rollingMonth) continue;
        const baseIdx = mobile6Months.indexOf(rollingMonth);
        base[baseIdx] = {
          label: rollingMonth.label,
          revenue: Number(p?.revenue ?? 0) || 0
        };
      } else {
        base[idx] = {
          label: monthLabels[idx],
          revenue: Number(p?.revenue ?? 0) || 0
        };
      }
    }
    return base;
  }, [displayChartData, isMobile, mobile6Months]);

  const mobileMonth12ChartData = useMemo(() => {
    const base = monthLabels.map((m) => ({ label: m, revenue: 0 }));

    for (const p of (displayChartData as Array<any>) || []) {
      const idx = monthIndexFromLabel(p?.label);
      if (idx == null) continue;
      base[idx] = {
        label: monthLabels[idx],
        revenue: Number(p?.revenue ?? 0) || 0,
      };
    }

    return base;
  }, [displayChartData, monthLabels]);

  const normalizedYearlyChartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const base = yearLabels.map((year) => ({
      label: year,
      revenue: 0,
      year: parseInt(year)
    }));

    for (const p of (displayChartData as Array<any>) || []) {
      const raw = p?.label;
      if (raw == null) continue;
      const cleaned = String(raw).trim();

      let yearIdx = -1;
      const yearMatch = cleaned.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        const yearStr = yearMatch[1];
        yearIdx = yearLabels.indexOf(yearStr);
      }
      if (yearIdx < 0) {
        yearIdx = yearLabels.indexOf(String(currentYear));
      }

      if (yearIdx >= 0) {
        const rev = Number(p?.revenue ?? 0) || 0;
        base[yearIdx] = {
          ...base[yearIdx],
          revenue: (Number(base[yearIdx].revenue) || 0) + rev
        };
      }
    }

    return base;
  }, [displayChartData, yearLabels]);

  const normalizedChartData = useMemo(() => {
    if (chartPeriod === "year") return normalizedYearlyChartData;

    // For "today" period on mobile, show last 7 days (rolling)
    if (chartPeriod === "today" && isMobile) {
      const raw = (displayChartData ?? []) as Array<any>;
      const today = new Date();
      const currentDay = today.getDate();

      const filtered = raw.filter((item) => {
        const label = String(item?.label ?? "").trim();
        const parts = label.split('/');
        if (parts.length === 2) {
          const day = parseInt(parts[0], 10);
          // Show last 7 days (currentDay - 6 to currentDay)
          const minDay = Math.max(1, currentDay - 6);
          const maxDay = currentDay;
          return day >= minDay && day <= maxDay;
        }
        return false;
      });
      return filtered;
    }

    return displayChartData;
  }, [chartPeriod, normalizedYearlyChartData, displayChartData, isMobile]);

  const finalChartData = useMemo(() => {
    if (period === "month") {
      if (isMobile) return mobileMonth12ChartData;
      return displayChartData;
    }
    if (period === "year") {
      return displayChartData;
    }
    if (period === "today" || period === "week") {
      // Take only last 12 days
      return (displayChartData as Array<any>).slice(-12);
    }
    if (summaryRange.startDate && summaryRange.endDate) {
      return displayChartData;
    }
    if (chartPeriod === "year") return normalizedYearlyChartData;
    return normalizedChartData;
  }, [period, chartPeriod, isMobile, mobileMonth12ChartData, monthlyChartData, normalizedYearlyChartData, normalizedChartData, displayChartData, summaryRange.startDate, summaryRange.endDate]);

  const shouldRenderChart = useMemo(() => {
    if (loadingChart) return false;
    if (period === "month" && isMobile) return true;
    return Array.isArray(displayChartData) && displayChartData.length > 0;
  }, [displayChartData, isMobile, loadingChart, period]);

  const xAxisInterval = useMemo(() => {
    if (isMobile && period === "month") return 0;
    if (chartPeriod === "week" || chartPeriod === "year") return 0;
    return "preserveEnd" as const;
  }, [chartPeriod, isMobile, period]);

  const xAxisMinTickGap = useMemo(() => {
    if (isMobile && period === "month") return 0;
    if (chartPeriod === "week" || chartPeriod === "year") return 0;
    return 12;
  }, [chartPeriod, isMobile, period]);

  const handleDownloadExcel = () => {
    setDownloadDialogOpen(true);
  };

  const handleConfirmDownload = async () => {
    try {
      let startDate: string;
      let endDate: string;

      if (downloadMonth === "all") {
        startDate = new Date(downloadYear, 0, 1, 0, 0, 0, 0).toISOString();
        endDate = new Date(downloadYear, 11, 31, 23, 59, 59, 999).toISOString();
      } else {
        const start = new Date(downloadYear, downloadMonth - 1, 1, 0, 0, 0, 0);
        const end = new Date(downloadYear, downloadMonth, 0, 23, 59, 59, 999);
        startDate = start.toISOString();
        endDate = end.toISOString();
      }

      let filename = "";

      // Fetch sales data for the selected period
      const isAdminExport = adminMode && isAdmin;
      const isAllSales = selectedSalesUserId === "all";

      const transactions = await getTransactions(
        isAdminExport
          ? (isAllSales
              ? { startDate, endDate, adminAll: true }
              : { startDate, endDate, userId: selectedSalesUserId })
          : { startDate, endDate }
      );

      const salesIdMap = new Map<string, string>();
      if (isAdminExport && isAllSales) {
        for (const e of adminSalesOptions) {
          salesIdMap.set(e.userId, e.salesId);
        }
      }

      filename = downloadMonth === "all" 
        ? `Laporan_Penjualan_Tahun_${downloadYear}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `Laporan_Penjualan_${String(downloadMonth).padStart(2, '0')}-${downloadYear}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Use ExcelJS for sales report with styling
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan');

      // Define columns with normal case headers
      const baseColumns = [
        { header: 'Date', key: 'tanggal', width: 12 },
        { header: 'Time', key: 'jam', width: 8 },
        { header: 'ID Costumers', key: 'idPelanggan', width: 14 },
        { header: 'Sales ID', key: 'salesId', width: 15 },
        { header: 'Costumers Name', key: 'namaPelanggan', width: 25 },
        { header: 'Phone', key: 'noTelp', width: 15 },
        { header: 'Address', key: 'alamat', width: 32 },
        { header: 'Kecamatan', key: 'kecamatan', width: 18 },
        { header: 'Kabupaten', key: 'kabupaten', width: 18 },
        { header: 'Item Product', key: 'namaProduk', width: 35 },
      ];

      const variantColumn = [
        { header: 'Variant', key: 'varian', width: 12 },
      ];

      const afterProductColumns = [
        { header: 'Qty', key: 'qty', width: 6 },
        { header: 'Price', key: 'harga', width: 12 },
        { header: 'Total', key: 'total', width: 12 },
      ];

      const marginColumns = [
        { header: 'HPP', key: 'hpp', width: 12 },
        { header: 'Margin', key: 'margin', width: 12 },
      ];

      const periodColumns = [
        { header: 'Period Month', key: 'periodeBulan', width: 14 },
        { header: 'Period Year', key: 'periodeTahun', width: 14 },
      ];

      const showMarginInfo = isAdminExport;
      const showVariant = !isAdminExport; // Khusus mode sales
      
      let finalColumns = [...baseColumns];
      if (showVariant) finalColumns = [...finalColumns, ...variantColumn];
      finalColumns = [...finalColumns, ...afterProductColumns];
      if (showMarginInfo) finalColumns = [...finalColumns, ...marginColumns];
      finalColumns = [...finalColumns, ...periodColumns];

      worksheet.columns = finalColumns;

      // Style header cells with black background and white text
      const lastColumnIndex = worksheet.columns.length;
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF000000' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });

      // Override specific header alignments
      worksheet.getCell('C1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('D1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('E1').alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('G1').alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getCell('H1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('I1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('J1').alignment = { horizontal: 'left', vertical: 'middle' };
      
      // Alignment depends on dynamic column count
      // Find indexes by key
      const getColIndex = (key: string) => worksheet.columns.findIndex(c => c.key === key) + 1;
      
      const qtyCol = getColIndex('qty');
      const priceCol = getColIndex('harga');
      const totalCol = getColIndex('total');
      const subtotalCol = getColIndex('subtotal');
      const hppCol = getColIndex('hpp');
      const marginCol = getColIndex('margin');
      const monthCol = getColIndex('periodeBulan');
      const yearCol = getColIndex('periodeTahun');

      if (qtyCol > 0) worksheet.getCell(1, qtyCol).alignment = { horizontal: 'center', vertical: 'middle' };
      if (priceCol > 0) worksheet.getCell(1, priceCol).alignment = { horizontal: 'right', vertical: 'middle' };
      if (totalCol > 0) worksheet.getCell(1, totalCol).alignment = { horizontal: 'right', vertical: 'middle' };
      if (subtotalCol > 0) worksheet.getCell(1, subtotalCol).alignment = { horizontal: 'right', vertical: 'middle' };
      if (hppCol > 0) worksheet.getCell(1, hppCol).alignment = { horizontal: 'right', vertical: 'middle' };
      if (marginCol > 0) worksheet.getCell(1, marginCol).alignment = { horizontal: 'right', vertical: 'middle' };
      if (monthCol > 0) worksheet.getCell(1, monthCol).alignment = { horizontal: 'center', vertical: 'middle' };
      if (yearCol > 0) worksheet.getCell(1, yearCol).alignment = { horizontal: 'center', vertical: 'middle' };
      
      const variantCol = getColIndex('varian');
      if (variantCol > 0) worksheet.getCell(1, variantCol).alignment = { horizontal: 'center', vertical: 'middle' };

      // Add data
      let transactionIndex = 0;

      transactions.forEach((t: any) => {
        const createdAt = t.createdAt ? new Date(t.createdAt) : null;
        const dateObj = createdAt;
        const formattedDate = createdAt
          ? `${String(dateObj.getDate()).padStart(2, '0')} ${dateObj.toLocaleDateString('id-ID', { month: 'short' })} ${dateObj.getFullYear()}`
          : '-';
        const time = createdAt ? createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        const isEven = transactionIndex % 2 === 0;
        const fillColor = isEven ? 'FFFFFFFF' : 'FFF2F2F2'; // Putih atau Abu-abu muda
        
        // Calculate total discount for the transaction
        const subtotalValue = t.subtotal || 0;
        const totalDiscount = t.discount ? (subtotalValue * (t.discount / 100)) : 0;

        const transactionSalesId = isAdminExport
          ? (isAllSales
              ? (salesIdMap.get(String(t.userId ?? "")) || "-")
              : (adminSalesOptions.find((x) => x.userId === selectedSalesUserId)?.salesId || "-"))
          : (salesId || '-');

        t.items?.forEach((item: any) => {
          const itemTotal = (item.price || 0) * (item.quantity || 0);
          
          // Find HPP from products data if not available in item
          let itemHpp = item.hpp || 0;
          if (!itemHpp && products) {
            const product = products.find((p: any) => 
              p.id === item.productId || p.name === item.productName
            );
            if (product) {
              if (item.tierLabel && product.priceTiers) {
                const tier = product.priceTiers.find((pt: any) => pt.label === item.tierLabel);
                itemHpp = tier?.hpp ?? product.hpp ?? 0;
              } else {
                itemHpp = product.hpp ?? 0;
              }
            }
          }
          
          const itemMargin = (item.price - itemHpp) * (item.quantity || 0);
          
          const row = worksheet.addRow({
            tanggal: formattedDate,
            jam: time,
            idPelanggan: t.customerCode || '-',
            salesId: transactionSalesId,
            namaPelanggan: t.customerName || '-',
            noTelp: t.customerPhone || '-',
            alamat: t.customerAddress || '-',
            kecamatan: t.customerKecamatan || '-',
            kabupaten: t.customerKab || '-',
            namaProduk: item.productName || item.serviceName || '-',
            varian: showVariant ? (item.tierLabel || '-') : undefined,
            qty: item.quantity || 0,
            harga: item.price || 0,
            total: itemTotal,
            subtotal: t.total || 0,
            hpp: showMarginInfo ? itemHpp * (item.quantity || 0) : undefined,
            margin: showMarginInfo ? itemMargin : undefined,
            periodeBulan: t.periodeMonth ? ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][(t.periodeMonth - 1)] || t.periodeMonth : '-',
            periodeTahun: t.periodeYear || '-',
          });
 
          // Apply alternating fill color + border per row (no merge)
          for (let c = 1; c <= lastColumnIndex; c++) {
            const cell = worksheet.getCell(row.number, c);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: fillColor },
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } },
            };
          }

          // Write time-only as a fraction of a day
          if (createdAt) {
            const timeFraction =
              (createdAt.getHours() * 3600 + createdAt.getMinutes() * 60 + createdAt.getSeconds()) / 86400;
            row.getCell(2).value = timeFraction;
            row.getCell(2).numFmt = 'hh:mm';
          }

          // Force phone number as text and center-align it
          const salesIdIdx = getColIndex('salesId');
          const phoneIdx = getColIndex('noTelp');
          
          if (salesIdIdx > 0) {
            row.getCell(salesIdIdx).numFmt = '@';
            row.getCell(salesIdIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (phoneIdx > 0) {
            row.getCell(phoneIdx).numFmt = '@';
            row.getCell(phoneIdx).alignment = { horizontal: 'center', vertical: 'middle' };
            if (row.getCell(phoneIdx).value == null || row.getCell(phoneIdx).value === '') {
              row.getCell(phoneIdx).value = '-';
            } else {
              row.getCell(phoneIdx).value = String(row.getCell(phoneIdx).value);
            }
          }
        });
        transactionIndex++;
      });

      // Style data rows with specific alignments and number formats (data starts from row 2)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const qtyIdx = getColIndex('qty');
          const priceIdx = getColIndex('harga');
          const totalIdx = getColIndex('total');
          const subtotalIdx = getColIndex('subtotal');
          const hppIdx = getColIndex('hpp');
          const marginIdx = getColIndex('margin');
          const dateIdx = getColIndex('tanggal');
          const timeIdx = getColIndex('jam');
          const customerIdIdx = getColIndex('idPelanggan');
          const salesIdIdx = getColIndex('salesId');
          const phoneIdx = getColIndex('noTelp');
          const kecamatanIdx = getColIndex('kecamatan');
          const kabupatenIdx = getColIndex('kabupaten');
          const productIdx = getColIndex('namaProduk');
          const variantIdx = getColIndex('varian');
          const monthIdx = getColIndex('periodeBulan');
          const yearIdx = getColIndex('periodeTahun');

          if (priceIdx > 0) {
            row.getCell(priceIdx).numFmt = '#,##0';
            row.getCell(priceIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (totalIdx > 0) {
            row.getCell(totalIdx).numFmt = '#,##0';
            row.getCell(totalIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (subtotalIdx > 0) {
            row.getCell(subtotalIdx).numFmt = '#,##0';
            row.getCell(subtotalIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (hppIdx > 0) {
            row.getCell(hppIdx).numFmt = '#,##0';
            row.getCell(hppIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (marginIdx > 0) {
            row.getCell(marginIdx).numFmt = '#,##0';
            row.getCell(marginIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          }
          if (dateIdx > 0) row.getCell(dateIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (timeIdx > 0) row.getCell(timeIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (customerIdIdx > 0) row.getCell(customerIdIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (salesIdIdx > 0) {
            row.getCell(salesIdIdx).numFmt = '@';
            row.getCell(salesIdIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (phoneIdx > 0) {
            row.getCell(phoneIdx).numFmt = '@';
            row.getCell(phoneIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (kecamatanIdx > 0) row.getCell(kecamatanIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (kabupatenIdx > 0) row.getCell(kabupatenIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (productIdx > 0) row.getCell(productIdx).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          if (variantIdx > 0) row.getCell(variantIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (qtyIdx > 0) {
            row.getCell(qtyIdx).numFmt = '#,##0';
            row.getCell(qtyIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (monthIdx > 0) row.getCell(monthIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          if (yearIdx > 0) row.getCell(yearIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();

      const arrayBufferToBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      };
      
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

      if (isTauri) {
        try {
          const filePath = await save({
            defaultPath: filename,
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
          });
          
          if (filePath) {
            const uint8Buffer = new Uint8Array(buffer as ArrayBuffer);
            await writeFile(filePath, uint8Buffer);
            toast({
              title: "Berhasil",
              description: "Laporan berhasil disimpan",
            });
          }
        } catch (err) {
          console.error('Error saving in Tauri:', err);
          toast({
            title: "Gagal",
            description: "Gagal menyimpan laporan",
            variant: "destructive"
          });
        }
      } else if (Capacitor.isNativePlatform()) {
        try {
          const base64 = arrayBufferToBase64(buffer as ArrayBuffer);
          const result = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Cache,
          });

          await Share.share({
            title: 'Laporan Penjualan',
            text: 'File Excel laporan penjualan',
            url: result.uri,
            dialogTitle: 'Simpan / Bagikan Laporan',
          });
        } catch (err) {
          console.error('Error saving/sharing in Capacitor:', err);
          toast({
            title: "Gagal",
            description: "Gagal mengunduh laporan di Android",
            variant: "destructive",
          });
        }
      } else {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      
      setDownloadDialogOpen(false);
    } catch (error) {
      console.error('Error downloading Excel:', error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ringkasan Bisnis</h1>
          <p className="text-muted-foreground text-xs mt-0">Pantau performa Toko Anda hari ini.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {adminMode && isAdmin && (
            <Select value={selectedSalesUserId} onValueChange={setSelectedSalesUserId}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Semua Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sales</SelectItem>
                {adminSalesOptions.map((opt) => (
                  <SelectItem key={opt.userId} value={opt.userId}>
                    {opt.salesId ? opt.salesId : opt.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="week">Minggu Ini</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="year">Tahun Ini</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-0 hover:scale-105 transition-transform cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Pendapatan</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            {loadingSummary ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-lg md:text-2xl font-bold text-primary">{formatRupiah(animatedRevenue)}</div>
            )}
          </CardContent>
        </Card>
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 hover:scale-105 transition-transform cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Transaksi</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-lg md:text-2xl font-bold">{displaySummary.transactionCount}</div>
            )}
          </CardContent>
        </Card>
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 hover:scale-105 transition-transform cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Pelanggan</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-lg md:text-2xl font-bold">
                {(adminMode && isAdmin) ? displaySummary.customerCount : (Array.isArray(customers) ? customers.length : 0)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 hover:scale-105 transition-transform cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">{(adminMode && isAdmin) ? "Total Margin" : "Total Produk"}</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            {loadingSummary ? <Skeleton className="h-8 w-16" /> : (
              <div className={`text-lg md:text-2xl font-bold ${(adminMode && isAdmin) ? "text-primary" : ""}`}>
                {(adminMode && isAdmin) ? formatRupiah(totalMarginAdmin) : (Array.isArray(products) ? products.length : 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="col-span-1 lg:col-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle>Grafik Pendapatan</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[220px] sm:h-[300px]">
                {loadingChart ? (
                  <Skeleton className="h-full w-full" />
                ) : shouldRenderChart ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={finalChartData}
                      margin={{ top: 12, right: 0, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: isMobile ? 8 : 12, fill: "hsl(var(--muted-foreground))", textAnchor: "middle" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatXAxisLabel}
                        interval={xAxisInterval}
                        tickMargin={10}
                        padding={{ left: 0, right: 0 }}
                        minTickGap={xAxisMinTickGap}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={false}
                        labelFormatter={(value: any, payload: any) => {
                          const data = Array.isArray(payload) ? payload[0]?.payload : payload?.payload;
                          if (data?.range) return `${value} (${data.range})`;
                          return formatTooltipLabel(value, data);
                        }}
                        formatter={(value: any) => [formatRupiah(Number(value) || 0), "Pendapatan"]}
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 10,
                          boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    Belum ada data pendapatan
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle>Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {loadingTop ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : Array.isArray(displayTopProducts) && displayTopProducts.length > 0 ? (() => {
                  const maxCount = Math.max(...displayTopProducts.map(s => s.count));
                  return displayTopProducts.map((product) => {
                    const percentage = maxCount > 0 ? (product.count / maxCount) * 100 : 0;
                    return (
                      <div key={product.productName} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs md:text-sm truncate">{product.productName}</p>
                            <p className="text-[10px] md:text-xs text-muted-foreground">{product.count} kali</p>
                          </div>
                          <div className="text-xs md:text-sm font-semibold self-start">{formatRupiah(product.revenue)}</div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })() : (
                  <div className="text-center text-xs md:text-sm text-muted-foreground py-4">Belum ada data layanan</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>


        <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
          <Card className="flex-1 flex flex-col min-h-[120px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-700 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 flex-shrink-0">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold">Top Pelanggan</CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0">Top 5 pelanggan terbanyak order</p>
              </div>
              <Users className="h-5 w-5 text-primary mr-2" />
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="space-y-3">
                {loadingPeriodTransactions ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
                ) : topCustomers.length > 0 ? (
                  topCustomers.map((c) => (
                    <div key={c.key} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {c.code || '-'} • {c.orderCount}x order
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-primary">{formatRupiah(c.total)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <Users className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Belum ada data</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Data pelanggan akan muncul di sini</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Riwayat Transaksi */}
          <Card className="flex-1 flex flex-col min-h-fit animate-in fade-in slide-in-from-bottom-4 duration-500 delay-800 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 flex-shrink-0">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg font-bold truncate">Riwayat Transaksi</CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0 truncate">Transaksi terbaru periode ini</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation('/transaksi')} className="shrink-0 h-8 text-[10px] sm:text-xs">
                Lihat Semua
              </Button>
            </CardHeader>
            <CardContent className="pt-0 pb-4 flex-1">
              <div className="space-y-3">
                {loadingRecent ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
                ) : Array.isArray(displayRecentTransactions) && displayRecentTransactions.length > 0 ? (
                    displayRecentTransactions.map((trx: any) => (
                      <div key={trx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{trx.customerName || 'Pelanggan Umum'}</p>
                            {trx.customerCode && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono bg-muted/50 h-4">
                                {trx.customerCode}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDate(trx.createdAt, "dd MMM yyyy, HH:mm")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-primary">{formatRupiah(trx.total)}</p>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Transaksi akan muncul di sini</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full cursor-pointer bg-primary text-primary-foreground min-h-[120px] animate-in fade-in slide-in-from-bottom-4 shadow-md hover:shadow-xl hover:-translate-y-1 hover:brightness-110 transition-all duration-300 active:scale-[0.98]" onClick={handleDownloadExcel}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-shrink-0">
            <div>
              <CardTitle className="text-lg font-bold">Download Laporan</CardTitle>
              <p className="text-xs text-primary-foreground/80 mt-0">Klik untuk unduh laporan Excel</p>
            </div>
            <Download className="h-5 w-5 text-primary-foreground" />
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            {/* Empty content for consistent spacing */}
          </CardContent>
        </Card>

        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogContent className="top-6 translate-y-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-top-0">
            <DialogHeader>
              <DialogTitle>Download Laporan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Periode Bulan</label>
                  <Select value={String(downloadMonth)} onValueChange={(val: any) => setDownloadMonth(val === "all" ? "all" : Number(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      <SelectItem value="all">Semua Bulan</SelectItem>
                      <SelectItem value="1">Januari</SelectItem>
                      <SelectItem value="2">Februari</SelectItem>
                      <SelectItem value="3">Maret</SelectItem>
                      <SelectItem value="4">April</SelectItem>
                      <SelectItem value="5">Mei</SelectItem>
                      <SelectItem value="6">Juni</SelectItem>
                      <SelectItem value="7">Juli</SelectItem>
                      <SelectItem value="8">Agustus</SelectItem>
                      <SelectItem value="9">September</SelectItem>
                      <SelectItem value="10">Oktober</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">Desember</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Periode Tahun</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={downloadYear}
                    onChange={(e) => setDownloadYear(Number(e.target.value || new Date().getFullYear()))}
                  />
                </div>
              </div>

              {adminMode && isAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sales</label>
                  <Select value={selectedSalesUserId} onValueChange={setSelectedSalesUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih sales" />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      <SelectItem value="all">Semua Sales</SelectItem>
                      {adminSalesOptions.map((opt) => (
                        <SelectItem key={opt.userId} value={opt.userId}>
                          {opt.salesId ? opt.salesId : opt.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
              <Button 
                variant="outline" 
                className="w-full sm:w-auto h-11 sm:h-9" 
                onClick={() => setDownloadDialogOpen(false)}
              >
                Batal
              </Button>
              <Button 
                className="w-full sm:w-auto h-11 sm:h-9" 
                onClick={handleConfirmDownload}
              >
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Rincian Item</h4>
                <div className="space-y-2">
                  {selectedTransaction.items && selectedTransaction.items.length > 0 ? (
                    selectedTransaction.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex-1">
                          <span className="font-medium">{item.quantity}x</span>
                          <span className="ml-2">{item.productName || item.serviceName}</span>
                        </div>
                        <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada detail item</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatRupiah(selectedTransaction.subtotal ?? 0)}</span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Diskon ({selectedTransaction.discount}%)</span>
                    <span className="text-red-600">-{formatRupiah((selectedTransaction.subtotal ?? 0) * (selectedTransaction.discount / 100))}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-base font-bold pt-2 border-t">
                  <span>Total</span>
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




