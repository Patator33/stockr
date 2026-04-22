import { Preferences } from '@capacitor/preferences';

const SERVER_KEY = 'stockr_server_url';
const TOKEN_KEY = 'stockr_token';

export async function getServerUrl(): Promise<string> {
  const { value } = await Preferences.get({ key: SERVER_KEY });
  return value || 'http://localhost:3009';
}

export async function setServerUrl(url: string) {
  await Preferences.set({ key: SERVER_KEY, value: url.replace(/\/$/, '') });
}

export async function getToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value;
}

export async function setToken(token: string) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearToken() {
  await Preferences.remove({ key: TOKEN_KEY });
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = await getServerUrl();
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${base}${path}`, { ...options, headers });
}

async function get<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

async function del(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    let message = `${res.status}`;
    try { const data = await res.json(); if (data.error) message = data.error; } catch { /* ignore */ }
    throw new Error(message);
  }
}

// Auth
export const api = {
  setup: {
    status: () => get<{ needsSetup: boolean }>('/api/setup/status'),
    create: (email: string, password: string) => post<{ token: string }>('/api/setup', { email, password }),
  },
  auth: {
    login: (email: string, password: string) => post<{ token: string; email: string; role: string }>('/api/auth/login', { email, password }),
    logout: () => post('/api/auth/logout', {}),
    me: () => get<{ id: string; email: string; role: string }>('/api/auth/me'),
  },
  users: {
    list: () => get<UserProfile[]>('/api/users'),
    create: (email: string, password: string, role?: string) => post<UserProfile>('/api/users', { email, password, role }),
    setRole: (id: string, role: string) => patch<UserProfile>(`/api/users/${id}`, { role }),
    delete: (id: string) => del(`/api/users/${id}`),
  },
  logs: {
    list: (limit?: number, offset?: number) => {
      const q = new URLSearchParams();
      if (limit) q.set('limit', String(limit));
      if (offset) q.set('offset', String(offset));
      return get<{ logs: AuditLog[]; total: number }>(`/api/logs?${q}`);
    },
  },
  products: {
    list: () => get<Product[]>('/api/products'),
    get: (id: string) => get<ProductDetail>(`/api/products/${id}`),
    create: (data: { name: string; description?: string }) => post<Product>('/api/products', data),
    update: (id: string, data: { name: string; description?: string; defaultLocationId?: string | null }) => put<Product>(`/api/products/${id}`, data),
    delete: (id: string) => del(`/api/products/${id}`),
  },
  variants: {
    list: (productId?: string) => get<Variant[]>(`/api/variants${productId ? `?productId=${productId}` : ''}`),
    findByBarcode: (barcode: string) => get<Variant & { product: { id: string; name: string } }>(`/api/variants?barcode=${encodeURIComponent(barcode)}`),
    create: (data: VariantInput) => post<Variant>('/api/variants', data),
    update: (id: string, data: Omit<VariantInput, 'productId'> & { barcode?: string | null; supplierRef?: string | null; lowStockThreshold?: number | null }) => put<Variant>(`/api/variants/${id}`, data),
    delete: (id: string) => del(`/api/variants/${id}`),
  },
  promotions: {
    list: (variantId: string) => get<Promotion[]>(`/api/promotions?variantId=${variantId}`),
    create: (data: { variantId: string; price: number; startDate: string; endDate?: string | null; supplierId?: string | null }) => post<Promotion>('/api/promotions', data),
    delete: (id: string) => del(`/api/promotions/${id}`),
  },
  suppliers: {
    list: () => get<Supplier[]>('/api/suppliers'),
    create: (data: { name: string; description?: string | null }) => post<Supplier>('/api/suppliers', data),
    update: (id: string, data: { name: string; description?: string | null }) => put<Supplier>(`/api/suppliers/${id}`, data),
    delete: (id: string) => del(`/api/suppliers/${id}`),
  },
  supplierPrices: {
    list: (supplierId: string) => get<SupplierPrice[]>(`/api/supplier-prices?supplierId=${supplierId}`),
    upsert: (data: { variantId: string; supplierId: string; salePrice?: number; costPrice?: number; shippingCost?: number; vatRate?: number; supplierRef?: string | null }) => post<SupplierPrice>('/api/supplier-prices', data),
    delete: (id: string) => del(`/api/supplier-prices/${id}`),
  },
  locations: {
    list: () => get<Location[]>('/api/locations'),
    create: (data: { name: string; description?: string }) => post<Location>('/api/locations', data),
    update: (id: string, data: { name: string; description?: string }) => put<Location>(`/api/locations/${id}`, data),
    setDefault: (id: string) => patch<Location>(`/api/locations/${id}`, { isDefault: true }),
    delete: (id: string) => del(`/api/locations/${id}`),
  },
  stocks: {
    byProduct: (productId?: string) => get<StockByLocation[]>(`/api/stocks${productId ? `?productId=${productId}` : ''}`),
    adjust: (data: { variantId: string; locationId: string; quantity: number; mode?: 'add' | 'set' }) =>
      post('/api/stocks/adjust', data),
    transfer: (data: TransferInput) => post('/api/stocks/transfer', data),
  },
  sales: {
    list: (params?: { productId?: string; from?: string; to?: string; page?: number; supplierId?: string }) => {
      const q = new URLSearchParams();
      if (params?.productId) q.set('productId', params.productId);
      if (params?.from) q.set('from', params.from);
      if (params?.to) q.set('to', params.to);
      if (params?.page) q.set('page', String(params.page));
      if (params?.supplierId) q.set('supplierId', params.supplierId);
      return get<SalesPage>(`/api/sales?${q}`);
    },
    create: (data: SaleInput) => post<Sale>('/api/sales', data),
    delete: (id: string) => del(`/api/sales/${id}`),
  },
  returns: {
    create: (data: { saleId: string; quantity: number; reason?: string; notes?: string }) =>
      post('/api/returns', data),
    delete: (id: string) => del(`/api/returns/${id}`),
  },
  stockReturns: {
    bulk: (items: { variantId: string; quantity: number }[], locationId?: string) =>
      post<{ ok: boolean; locationId: string; count: number }>('/api/stock-returns', { items, locationId }),
  },
  orders: {
    list: (status?: string) => get<Order[]>(`/api/orders${status ? `?status=${status}` : ''}`),
    get: (id: string) => get<Order>(`/api/orders/${id}`),
    updateStatus: (id: string, status: string, trackingRef?: string | null) => patch<Order>(`/api/orders/${id}`, { status, ...(trackingRef !== undefined ? { trackingRef } : {}) }),
    updateItemScanned: (orderId: string, itemId: string, scanned: number) =>
      patch<OrderItem>(`/api/orders/${orderId}`, { itemId, scanned }),
    updateLocation: (orderId: string, locationId: string) =>
      patch<Order>(`/api/orders/${orderId}`, { locationId }),
    delete: (id: string) => del(`/api/orders/${id}`),
  },
  stats: {
    get: (productId?: string, period?: number, supplierId?: string) => {
      const q = new URLSearchParams();
      if (productId)  q.set('productId',  productId);
      if (period)     q.set('period',     String(period));
      if (supplierId) q.set('supplierId', supplierId);
      return get<Stats>(`/api/stats?${q}`);
    },
  },
  stockMovements: {
    list: (params?: { variantId?: string; locationId?: string; type?: string; page?: number }) => {
      const q = new URLSearchParams();
      if (params?.variantId) q.set('variantId', params.variantId);
      if (params?.locationId) q.set('locationId', params.locationId);
      if (params?.type) q.set('type', params.type);
      if (params?.page) q.set('page', String(params.page));
      return get<StockMovementsPage>(`/api/stock-movements?${q}`);
    },
  },
  settings: {
    get: () => get<Record<string, string>>('/api/settings'),
    update: (data: Record<string, string | number>) => patch<Record<string, string>>('/api/settings', data),
  },
};

// Types
export interface Product {
  id: string;
  name: string;
  description?: string;
  defaultLocationId?: string | null;
  _count?: { variants: number };
  createdAt: string;
}

export interface ProductDetail extends Product {
  variants: VariantWithStocks[];
}

export interface Attribute {
  key: string;
  value: string;
}

export interface Supplier {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface SupplierPrice {
  id: string;
  variantId: string;
  supplierId: string;
  supplierRef?: string | null;
  salePrice: number;
  costPrice: number;
  shippingCost: number;
  vatRate: number;
  supplier: Supplier;
}

export interface Promotion {
  id: string;
  variantId: string;
  price: number;
  startDate: string;
  endDate?: string | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  createdAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  attributes: string; // JSON string
  costPrice: number;
  salePrice: number;
  shippingCost: number;
  vatRate: number;
  barcode?: string | null;
  supplierRef?: string | null;
  lowStockThreshold?: number | null;
  stocks?: StockEntry[];
  activePromotion?: Promotion | null;
  supplierPrices?: SupplierPrice[];
  createdAt: string;
}

export interface VariantWithStocks extends Variant {
  stocks: StockEntry[];
}

export interface VariantInput {
  productId: string;
  name: string;
  attributes: Attribute[];
  costPrice: number;
  salePrice: number;
  shippingCost: number;
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface StockEntry {
  variantId: string;
  locationId: string;
  quantity: number;
  location: Location;
}

export interface StockByLocation {
  location: Location;
  items: StockItem[];
}

export interface StockItem {
  variantId: string;
  variantName: string;
  productId: string;
  productName: string;
  quantity: number;
  attributes: Attribute[];
  costPrice: number;
  salePrice: number;
  shippingCost: number;
}

export interface TransferInput {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  notes?: string;
}

export interface Sale {
  id: string;
  variantId: string;
  locationId: string;
  supplierId?: string | null;
  quantity: number;
  unitSalePrice: number;
  unitCostPrice: number;
  unitShippingCost: number;
  vatRate: number;
  notes?: string;
  createdAt: string;
  variant?: { name: string; product: { id: string; name: string } };
  location?: Location;
  supplier?: { id: string; name: string } | null;
  returns?: Return[];
}

export interface SaleInput {
  variantId: string;
  locationId: string;
  supplierId?: string | null;
  quantity: number;
  unitSalePrice?: number;
  unitCostPrice?: number;
  unitShippingCost?: number;
  notes?: string;
}

export interface Return {
  id: string;
  saleId: string;
  quantity: number;
  reason?: string;
  notes?: string;
  createdAt: string;
}

export interface SalesPage {
  sales: Sale[];
  total: number;
  page: number;
  pages: number;
}

export interface LowStockAlert {
  variantId: string;
  variantName: string;
  productName: string;
  totalQty: number;
  threshold: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
}

export interface Stats {
  period: number;
  totalRevenue: number;
  totalCost: number;
  totalShipping: number;
  grossMargin: number;
  netMargin: number;
  totalVat: number;
  totalSoldQty: number;
  totalReturnedQty: number;
  totalStock: number;
  topVariants: TopVariant[];
  dailyRevenue?: DailyRevenue[];
  lowStockAlerts?: LowStockAlert[];
  overdueOrders?: number;
}

export interface StockMovement {
  id: string;
  variantId: string;
  locationId: string;
  type: string;
  delta: number;
  userId?: string | null;
  ref?: string | null;
  notes?: string | null;
  createdAt: string;
  variant: { name: string; product: { name: string } };
  location: { name: string };
}

export interface StockMovementsPage {
  movements: StockMovement[];
  total: number;
  page: number;
  pages: number;
}

export interface TopVariant {
  name: string;
  productName: string;
  sold: number;
  returned: number;
  revenue: number;
  margin: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId?: string | null;
  barcode?: string | null;
  variantName: string;
  quantity: number;
  scanned: number;
  variant?: { id: string; name: string; barcode?: string | null; product: { id: string; name: string } } | null;
}

export interface Order {
  id: string;
  source: string;
  customerName?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  status: string; // pending | confirmed | prepared | shipped
  shippingDate?: string | null;
  trackingRef?: string | null;
  locationId?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  details?: string | null;
  createdAt: string;
}
