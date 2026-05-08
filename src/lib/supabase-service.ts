import { supabase } from './supabase';

// Types
export type Product = {
  id?: number;
  userId?: string;
  name: string;
  price: number;
  hpp?: number;
  priceTiers?: { label: string; price: number; hpp?: number }[];
  unit: string;
  isActive: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Customer = {
  id?: number;
  userId?: string;
  code?: string;
  name: string;
  phone?: string;
  address?: string;
  kab?: string;
  kecamatan?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type TransactionItem = {
  productId?: number;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  tierLabel?: string | null;
};

export type Transaction = {
  id?: number;
  userId?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  customerCode?: string;
  customerAddress?: string;
  customerKab?: string;
  customerKecamatan?: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentStatus?: string;
  status?: string;
  periodeMonth?: number;
  periodeYear?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type SalesIdEntry = {
  userId: string;
  salesId: string;
};

export type Order = {
  id?: number;
  userId?: string;
  customerId?: number;
  orderDate: string;
  deliveryDate?: string;
  dueDate?: string;
  status?: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  customerCode?: string;
  customerAddress?: string;
  customerKab?: string;
  customerKecamatan?: string;
  discount?: number;
  items?: string;
  periodeMonth?: number;
  periodeYear?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Setting = {
  key: string;
  value: any;
  userId?: string;
  updated_at?: string;
};

function mapProductRow(row: any): Product {
   return {
     id: row.id,
     userId: row.user_id,
     name: row.name,
     price: row.price,
     hpp: row.hpp ?? 0,
     priceTiers: Array.isArray(row.price_tiers) ? row.price_tiers : undefined,
     unit: row.unit ?? 'pcs',
     isActive: row.is_active ?? row.isActive ?? true,
     created_at: row.created_at,
     updated_at: row.updated_at,
   };
 }

// Products
export async function getProducts(): Promise<Product[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  let query = supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return (data || []).map(mapProductRow);
}

export async function getProductsAdmin(options?: { userId?: string }): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.userId) {
    query = query.or(`user_id.eq.${options.userId},user_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapProductRow);
}

export async function createProduct(data: (Partial<Product> & { global?: boolean })): Promise<Product> {
  const { data: { user } } = await supabase.auth.getUser();
  const userIdToSave = data.global ? null : (user?.id || data.userId);
  const { data: result, error } = await supabase
    .from('products')
    .insert({
      user_id: userIdToSave,
      name: data.name!,
      price: data.price!,
      hpp: data.hpp || 0,
      price_tiers: data.priceTiers ?? null,
      unit: data.unit || 'pcs',
      is_active: data.isActive !== undefined ? data.isActive : true,
    })
    .select()
    .single();

  if (error) throw error;
  return mapProductRow(result);
}

export async function updateProduct(
  id: number,
  data: Partial<Product>,
  options?: { allowGlobal?: boolean }
): Promise<Product> {
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase
    .from('products')
    .update({
      name: data.name,
      price: data.price,
      hpp: data.hpp,
      price_tiers: data.priceTiers,
      unit: data.unit,
      is_active: data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select();

  if (options?.allowGlobal) {
    query = query.or(`user_id.eq.${user?.id},user_id.is.null`);
  } else {
    query = query.eq('user_id', user?.id);
  }

  const { data: result, error } = await query.single();

  if (error) throw error;
  return mapProductRow(result);
}

export async function deleteProduct(id: number, options?: { allowGlobal?: boolean }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (options?.allowGlobal) {
    query = query.or(`user_id.eq.${user?.id},user_id.is.null`);
  } else {
    query = query.eq('user_id', user?.id);
  }

  const { error } = await query;
  
  if (error) throw error;
}

// Customers
export async function getCustomers(search?: string): Promise<Customer[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase
    .from('customers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getCustomersAdmin(options?: { search?: string; userId?: string }): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .eq('user_id', user?.id)
    .limit(1);

  if (error) {
    console.error('Error fetching customer by phone:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const customer = data[0];
  return {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    kab: customer.kab,
    kecamatan: customer.kecamatan,
    notes: customer.notes,
    created_at: customer.created_at,
    updated_at: customer.updated_at,
  };
}

export async function createCustomer(data: Partial<Customer>): Promise<Customer> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('customers')
    .insert({
      user_id: user?.id || data.userId,
      code: data.code,
      name: data.name!,
      phone: data.phone,
      address: data.address,
      kab: data.kab,
      kecamatan: data.kecamatan,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: result.id,
    code: result.code,
    name: result.name,
    phone: result.phone,
    address: result.address,
    kab: result.kab,
    kecamatan: result.kecamatan,
    notes: result.notes,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
}

export async function updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('customers')
    .update({
      code: data.code,
      name: data.name,
      phone: data.phone,
      address: data.address,
      kab: data.kab,
      kecamatan: data.kecamatan,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user?.id)
    .select()
    .single();

  if (error) throw error;
  return {
    id: result.id,
    code: result.code,
    name: result.name,
    phone: result.phone,
    address: result.address,
    kab: result.kab,
    kecamatan: result.kecamatan,
    notes: result.notes,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
}

export async function deleteCustomer(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('user_id', user?.id);

  if (error) throw error;
}

export async function updateCustomerAdmin(id: number, data: Partial<Customer>): Promise<Customer> {
  const { data: result, error } = await supabase
    .from('customers')
    .update({
      code: data.code,
      name: data.name,
      phone: data.phone,
      address: data.address,
      kab: data.kab,
      kecamatan: data.kecamatan,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return {
    id: result.id,
    code: result.code,
    name: result.name,
    phone: result.phone,
    address: result.address,
    kab: result.kab,
    kecamatan: result.kecamatan,
    notes: result.notes,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
}

export async function deleteCustomerAdmin(id: number): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Transactions
export async function getTransactions(params?: {
  startDate?: string;
  endDate?: string;
  customerId?: string,
  userId?: string,
  adminAll?: boolean,
}): Promise<Transaction[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.adminAll) {
      // no user filter
    } else if (params?.userId) {
      query = query.eq('user_id', params.userId);
    } else {
      query = query.eq('user_id', user?.id);
    }

    if (params?.startDate) {
      query = query.gte('created_at', params.startDate);
    }

    if (params?.endDate) {
      query = query.lte('created_at', params.endDate);
    }

    if (params?.customerId) {
      query = query.eq('customer_id', params.customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      customerId: t.customer_id,
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      customerCode: t.customer_code,
      customerAddress: t.customer_address,
      customerKab: t.customer_kab,
      customerKecamatan: t.customer_kecamatan,
      items: t.items,
      subtotal: t.subtotal,
      discount: t.discount,
      total: t.total,
      paymentStatus: t.payment_status,
      status: t.status,
      periodeMonth: t.periode_month,
      periodeYear: t.periode_year,
      notes: t.notes,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));
  } catch (error) {
    console.error('Error in getTransactions:', error);
    throw error;
  }
}

export async function getSalesIdsAdmin(): Promise<SalesIdEntry[]> {
  const { data, error } = await supabase
    .from('settings')
    .select('key,value')
    .like('key', 'user:%:salesId');

  if (error) throw error;

  return (data || [])
    .map((row: any) => {
      const rawKey = String(row?.key ?? '');
      const match = rawKey.match(/^user:([^:]+):salesId$/);
      const userId = match?.[1];
      if (!userId) return null;

      let salesId = '';
      const v = row?.value;
      if (typeof v === 'string') salesId = v;
      else if (v != null) salesId = String(v);

      return { userId, salesId } as SalesIdEntry;
    })
    .filter(Boolean) as SalesIdEntry[];
}

export async function createTransaction(data: Partial<Transaction>): Promise<Transaction> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user?.id || data.userId,
      customer_id: data.customerId,
      customer_name: data.customerName!,
      customer_phone: data.customerPhone,
      customer_code: data.customerCode,
      customer_address: data.customerAddress,
      customer_kab: data.customerKab,
      customer_kecamatan: data.customerKecamatan,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount || 0,
      total: data.total,
      payment_status: data.paymentStatus || 'paid',
      status: data.status || 'completed',
      periode_month: data.periodeMonth,
      periode_year: data.periodeYear,
      notes: data.notes,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: result.id,
    customerId: result.customer_id,
    customerName: result.customer_name,
    customerPhone: result.customer_phone,
    customerCode: result.customer_code,
    customerAddress: result.customer_address,
    customerKab: result.customer_kab,
    customerKecamatan: result.customer_kecamatan,
    items: result.items,
    subtotal: result.subtotal,
    discount: result.discount,
    total: result.total,
    paymentStatus: result.payment_status,
    status: result.status,
    periodeMonth: result.periode_month,
    periodeYear: result.periode_year,
    notes: result.notes,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('transactions')
    .update({
      customer_id: data.customerId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_code: data.customerCode,
      customer_address: data.customerAddress,
      customer_kab: data.customerKab,
      customer_kecamatan: data.customerKecamatan,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      total: data.total,
      payment_status: data.paymentStatus,
      status: data.status,
      periode_month: data.periodeMonth,
      periode_year: data.periodeYear,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user?.id)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: result.id,
    customerId: result.customer_id,
    customerName: result.customer_name,
    customerPhone: result.customer_phone,
    customerCode: result.customer_code,
    customerAddress: result.customer_address,
    customerKab: result.customer_kab,
    customerKecamatan: result.customer_kecamatan,
    items: result.items,
    subtotal: result.subtotal,
    discount: result.discount,
    total: result.total,
    paymentStatus: result.payment_status,
    status: result.status,
    periodeMonth: result.periode_month,
    periodeYear: result.periode_year,
    notes: result.notes,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteTransaction(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user?.id);
  
  if (error) throw error;
}

// Orders (was: Appointments)
export async function getOrders(params?: { startDate?: string; endDate?: string; status?: string }): Promise<Order[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase
      .from('orders')
      .select('*')
      .eq('user_id', user?.id)
      .order('order_date', { ascending: false });

    if (params?.startDate) {
      query = query.gte('order_date', params.startDate);
    }

    if (params?.endDate) {
      query = query.lte('order_date', params.endDate);
    }

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }

    return (data || []).map((a: any) => ({
      id: a.id,
      customerId: a.customer_id,
      orderDate: a.order_date,
      deliveryDate: a.delivery_date,
      dueDate: a.due_date,
      status: a.status,
      notes: a.notes,
      customerName: a.customer_name,
      customerPhone: a.customer_phone,
      customerCode: a.customer_code,
      customerAddress: a.customer_address,
      customerKab: a.customer_kab,
      customerKecamatan: a.customer_kecamatan,
      discount: a.discount,
      items: a.items,
      periodeMonth: a.periode_month,
      periodeYear: a.periode_year,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));
  } catch (error) {
    console.error('Error in getOrders:', error);
    throw error;
  }
}

export async function createOrder(data: Partial<Order>): Promise<Order> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('orders')
    .insert({
      user_id: user?.id || data.userId,
      customer_id: data.customerId,
      order_date: data.orderDate!,
      delivery_date: data.deliveryDate,
      due_date: data.dueDate,
      status: data.status || 'pending',
      notes: data.notes,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_code: data.customerCode,
      customer_address: data.customerAddress,
      customer_kab: data.customerKab,
      customer_kecamatan: data.customerKecamatan,
      discount: data.discount || 0,
      items: data.items,
      periode_month: data.periodeMonth,
      periode_year: data.periodeYear,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: result.id,
    customerId: result.customer_id,
    orderDate: result.order_date,
    deliveryDate: result.delivery_date,
    dueDate: result.due_date,
    status: result.status,
    notes: result.notes,
    customerName: result.customer_name || data.customerName,
    customerPhone: result.customer_phone || data.customerPhone,
    customerCode: result.customer_code || data.customerCode,
    customerAddress: result.customer_address || data.customerAddress,
    customerKab: result.customer_kab || data.customerKab,
    customerKecamatan: result.customer_kecamatan || data.customerKecamatan,
    discount: result.discount ?? data.discount ?? 0,
    items: result.items || data.items,
    periodeMonth: result.periode_month ?? data.periodeMonth,
    periodeYear: result.periode_year ?? data.periodeYear,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function updateOrder(id: number, data: Partial<Order>): Promise<Order> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('orders')
    .update({
      customer_id: data.customerId,
      order_date: data.orderDate,
      delivery_date: data.deliveryDate,
      due_date: data.dueDate,
      status: data.status,
      notes: data.notes,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_code: data.customerCode,
      customer_address: data.customerAddress,
      customer_kab: data.customerKab,
      customer_kecamatan: data.customerKecamatan,
      discount: data.discount,
      items: data.items,
      periode_month: data.periodeMonth,
      periode_year: data.periodeYear,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user?.id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: result.id,
    customerId: result.customer_id,
    orderDate: result.order_date,
    deliveryDate: result.delivery_date,
    dueDate: result.due_date,
    status: result.status,
    notes: result.notes,
    customerName: result.customer_name || data.customerName,
    customerPhone: result.customer_phone || data.customerPhone,
    customerCode: result.customer_code || data.customerCode,
    customerAddress: result.customer_address || data.customerAddress,
    customerKab: result.customer_kab || data.customerKab,
    customerKecamatan: result.customer_kecamatan || data.customerKecamatan,
    discount: result.discount ?? data.discount ?? 0,
    items: result.items || data.items,
    periodeMonth: result.periode_month ?? data.periodeMonth,
    periodeYear: result.periode_year ?? data.periodeYear,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteOrder(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('user_id', user?.id);
  
  if (error) throw error;
}

// Settings
export async function getSetting(key: string): Promise<Setting | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const namespacedKey = `user:${user.id}:${key}`;

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('key', namespacedKey)
    .single();

  if (!error) return data;
  if (error.code === 'PGRST116') return null;
  throw error;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userPrefix = user?.id ? `user:${user.id}:` : "";
  const namespacedKey = userPrefix ? `${userPrefix}${key}` : key;
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: namespacedKey,
      value,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    });
  
  if (error) throw error;
}

export async function getAllSettings(): Promise<Record<string, any>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return {};

  const userPrefix = `user:${user.id}:`;
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .like('key', `${userPrefix}%`);

  if (error) throw error;

  const settings: Record<string, any> = {};
  (data || []).forEach((s: Setting) => {
    const rawKey = String((s as any).key ?? "");
    const mappedKey = rawKey.startsWith(userPrefix) ? rawKey.slice(userPrefix.length) : rawKey;
    settings[mappedKey] = (s as any).value;
  });
  return settings;
}

// Delete all transaction history
export async function deleteAllTransactions(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', user?.id)
    .neq('id', 0); // This deletes all rows by using a condition that's always true

  if (error) {
    console.error('Error deleting transactions:', error);
    throw error;
  }
}
