import { useMutation, useQuery } from "@tanstack/react-query";
import * as supabaseService from "./supabase-service";

// Re-export types from supabase-service
export type {
  Product,
  Customer,
  TransactionItem,
  Transaction,
  Order,
} from "./supabase-service";

// Dashboard types (placeholder for now)
export type DashboardSummary = {
  revenue: number;
  transactionCount: number;
  customerCount: number;
  orderCount: number;
  newCustomers: number;
};

export type RevenueChartPoint = {
  label: string;
  revenue: number;
  fullDate?: string;
};

export type TopProduct = {
  productName: string;
  count: number;
  revenue: number;
};

export type RecentTransaction = {
  id: number;
  customerName: string;
  total: number;
  createdAt: string;
};

let baseUrl: string | null = null;

export function setBaseUrl(url: string | null) {
  baseUrl = url;
}

export function getListProductsQueryKey() {
  return ["products"] as const;
}

export function useListProducts(options?: { userId?: string; adminAll?: boolean }) {
  return useQuery({
    queryKey: ["products", options],
    queryFn: async () => {
      if (options?.userId || options?.adminAll) {
        return supabaseService.getProductsAdmin({ 
          userId: options.userId 
        });
      }
      return supabaseService.getProducts();
    },
  });
}

export function useCreateProduct() {
  return useMutation({
    mutationFn: ({ data }: { data: any }) => supabaseService.createProduct(data),
  });
}

export function useUpdateProduct() {
  return useMutation({
    mutationFn: ({ id, data, allowGlobal }: { id: number; data: any; allowGlobal?: boolean }) =>
      supabaseService.updateProduct(id, data, { allowGlobal }),
  });
}

export function useDeleteProduct() {
  return useMutation({
    mutationFn: ({ id, allowGlobal }: { id: number; allowGlobal?: boolean }) =>
      supabaseService.deleteProduct(id, { allowGlobal }),
  });
}

export function getListCustomersQueryKey(search?: string) {
  return ["customers", search] as const;
}

export function useListCustomers(options?: { search?: string; userId?: string; adminAll?: boolean }) {
  return useQuery({
    queryKey: ["customers", options],
    queryFn: () => {
      if (options?.userId || options?.adminAll) {
        return supabaseService.getCustomersAdmin({ 
          search: options.search, 
          userId: options.userId 
        });
      }
      return supabaseService.getCustomers(options?.search);
    },
  });
}

export function useGetCustomerByPhone(phone: string) {
  return useQuery({
    queryKey: ["customerByPhone", phone],
    queryFn: () => supabaseService.getCustomerByPhone(phone),
    enabled: !!phone,
  });
}

export function useCreateCustomer() {
  return useMutation({
    mutationFn: ({ data }: { data: any }) => supabaseService.createCustomer(data),
  });
}

export function useUpdateCustomer() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => supabaseService.updateCustomer(id, data),
  });
}

export function useDeleteCustomer() {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => supabaseService.deleteCustomer(id),
  });
}

export function getListTransactionsQueryKey(params?: { startDate?: string; endDate?: string; customerId?: string; userId?: string; adminAll?: boolean }) {
  return ["transactions", params ?? {}] as const;
}

export function useListTransactions(params?: { startDate?: string; endDate?: string; customerId?: string; userId?: string; adminAll?: boolean }) {
  return useQuery({
    queryKey: getListTransactionsQueryKey(params),
    queryFn: () => supabaseService.getTransactions(params),
  });
}

export function useCreateTransaction() {
  return useMutation({
    mutationFn: ({ data }: { data: any }) => supabaseService.createTransaction(data),
  });
}

export function useUpdateTransaction() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => supabaseService.updateTransaction(id, data),
  });
}

export function useDeleteTransaction() {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => supabaseService.deleteTransaction(id),
  });
}

export function getListOrdersQueryKey(params?: { startDate?: string; endDate?: string; status?: string }) {
  return ["orders", params ?? {}] as const;
}

export function useListOrders(params?: { startDate?: string; endDate?: string; status?: string }) {
  return useQuery({
    queryKey: getListOrdersQueryKey(params),
    queryFn: () => supabaseService.getOrders(params),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: ({ data }: { data: any }) => supabaseService.createOrder(data),
  });
}

export function useUpdateOrder() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => supabaseService.updateOrder(id, data),
  });
}

export function useDeleteOrder() {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => supabaseService.deleteOrder(id),
  });
}

// Dashboard functions (placeholder implementations)
export function useGetDashboardSummary(params: { period: "today" | "week" | "month" | "year"; startDate?: string; endDate?: string; userId?: string }) {
  return useQuery({
    queryKey: ["dashboard", "summary", params] as const,
    staleTime: 0,
    queryFn: async () => {
      const transactions = await supabaseService.getTransactions({
        startDate: params.startDate,
        endDate: params.endDate,
        userId: params.userId,
        adminAll: !params.userId && !!(params as any).adminAll,
      });
      const customers = await supabaseService.getCustomersAdmin({
        userId: params.userId
      });
      const products = await supabaseService.getProductsAdmin({
        userId: params.userId
      });
      const orders = await supabaseService.getOrders({
        startDate: params.startDate,
        endDate: params.endDate,
      });

      // Filter out completed orders
      const activeOrders = orders.filter(o => o.status !== 'completed');

      const revenue = transactions.reduce((sum, t) => sum + t.total, 0);

      // Calculate new customers (created within the period)
      const newCustomers = customers.filter(c => {
        if (!params.startDate && !params.endDate) return false;
        const createdDate = new Date(c.created_at);
        if (params.startDate && createdDate < new Date(params.startDate)) return false;
        if (params.endDate && createdDate > new Date(params.endDate)) return false;
        return true;
      }).length;

      return {
        revenue,
        transactionCount: transactions.length,
        customerCount: customers.length,
        productCount: products.length,
        orderCount: activeOrders.length,
        newCustomers,
      };
    },
  });
}

export function useGetRecentTransactions(params: { limit: number; startDate?: string; endDate?: string; userId?: string }) {
  return useQuery({
    queryKey: ["dashboard", "recent-transactions", params] as const,
    queryFn: async () => {
      const transactions = await supabaseService.getTransactions({
        startDate: params.startDate,
        endDate: params.endDate,
        userId: params.userId,
        adminAll: !params.userId && !!(params as any).adminAll,
      });
      return transactions.slice(0, params.limit).map(t => ({
        id: t.id!,
        customerName: t.customerName,
        total: t.total,
        createdAt: t.createdAt,
        items: t.items,
        subtotal: t.subtotal,
        discount: t.discount,
      }));
    },
  });
}

export function useGetRevenueChart(params: { period: "today" | "week" | "month" | "year"; startDate?: string; endDate?: string; userId?: string }) {
  return useQuery({
    queryKey: ["dashboard", "revenue-chart", params] as const,
    queryFn: async () => {
      const transactions = await supabaseService.getTransactions({
        startDate: params.startDate,
        endDate: params.endDate,
        userId: params.userId,
        adminAll: !params.userId && !!(params as any).adminAll,
      });
      const now = new Date();
      const chartData: RevenueChartPoint[] = [];

      if (params.period === "today") {
        // Daily data for last 12 days (sama dengan week)
        for (let i = 11; i >= 0; i--) {
          const dateStart = new Date(now);
          dateStart.setDate(dateStart.getDate() - i);
          dateStart.setHours(0, 0, 0, 0);
          const dateEnd = new Date(dateStart);
          dateEnd.setHours(23, 59, 59, 999);

          const dayRevenue = transactions
            .filter(t => {
              const txDate = new Date(t.createdAt);
              return txDate >= dateStart && txDate <= dateEnd;
            })
            .reduce((sum, t) => sum + t.total, 0);

          chartData.push({
            label: String(dateStart.getDate()).padStart(2, '0'),
            revenue: dayRevenue,
            fullDate: dateStart.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          });
        }
      } else if (params.period === "week") {
        // Daily data for last 12 days
        for (let i = 11; i >= 0; i--) {
          const dateStart = new Date(now);
          dateStart.setDate(dateStart.getDate() - i);
          dateStart.setHours(0, 0, 0, 0);
          const dateEnd = new Date(dateStart);
          dateEnd.setHours(23, 59, 59, 999);

          const dayRevenue = transactions
            .filter(t => {
              const txDate = new Date(t.createdAt);
              return txDate >= dateStart && txDate <= dateEnd;
            })
            .reduce((sum, t) => sum + t.total, 0);

          chartData.push({
            label: String(dateStart.getDate()).padStart(2, '0'),
            revenue: dayRevenue,
            fullDate: dateStart.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          });
        }
      } else if (params.period === "month") {
        // Monthly data for this year (Jan-Dec)
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        const year = params.startDate ? new Date(params.startDate).getFullYear() : now.getFullYear();
        
        for (let i = 0; i < 12; i++) {
          const monthStart = new Date(year, i, 1);
          const monthEnd = new Date(year, i + 1, 0, 23, 59, 59, 999);

          const monthRevenue = transactions
            .filter(t => {
              const txDate = new Date(t.createdAt);
              return txDate >= monthStart && txDate <= monthEnd;
            })
            .reduce((sum, t) => sum + t.total, 0);

          chartData.push({
            label: monthLabels[i],
            revenue: monthRevenue,
          });
        }
      } else if (params.period === "year") {
        // Yearly data for 12 years starting from 2026 (left to right)
        for (let i = 0; i < 12; i++) {
          const year = 2026 + i;
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

          const yearRevenue = transactions
            .filter(t => {
              const txDate = new Date(t.createdAt);
              return txDate >= yearStart && txDate <= yearEnd;
            })
            .reduce((sum, t) => sum + t.total, 0);

          chartData.push({
            label: String(year),
            revenue: yearRevenue,
            fullDate: String(year),
          });
        }
      } else if (params.startDate && params.endDate) {
        // Group by date in the given range
        const startDate = new Date(params.startDate);
        const endDate = new Date(params.endDate);
        const dateMap = new Map<string, number>();

        transactions.forEach(t => {
          const txDate = new Date(t.createdAt);
          const dateKey = txDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
          dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + t.total);
        });

        // Generate all dates in range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = currentDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
          chartData.push({
            label: dateKey,
            revenue: dateMap.get(dateKey) || 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      return chartData;
    },
  });
}

export function useGetTopProducts(params?: { startDate?: string; endDate?: string; userId?: string }) {
  return useQuery({
    queryKey: ["dashboard", "top-products", params ?? {}] as const,
    queryFn: async () => {
      const transactions = await supabaseService.getTransactions({
        ...params,
        adminAll: !params?.userId && !!(params as any)?.adminAll,
      });
      const productMap = new Map<string, { count: number; revenue: number }>();

      transactions.forEach(t => {
        t.items.forEach(item => {
          const existing = productMap.get(item.productName) || { count: 0, revenue: 0 };
          productMap.set(item.productName, {
            count: existing.count + item.quantity,
            revenue: existing.revenue + (item.price * item.quantity),
          });
        });
      });

      return Array.from(productMap.entries())
        .map(([productName, data]) => ({
          productName,
          count: data.count,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });
}
