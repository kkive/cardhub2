const API_BASE = '/api';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CardItem {
  id: string;
  title: string;
  description: string | null;
  content: unknown;
  cardType: string;
  status: string;
  visibility: string;
  price: number;
  downloadCount: number;
  authorId: string;
  tags: string[];
  files?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  _count?: { cards: number };
}

export interface HealthStatus {
  status: string;
  checks: Record<string, { status: string; message?: string }>;
}

export interface AdminBootstrapStatus {
  hasAdmin: boolean;
}

export interface Order {
  id: string;
  userId: string;
  targetType: string;
  cardId: string | null;
  collectionId: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  card?: { id: string; title: string; price: number } | null;
  collection?: { id: string; title: string; price: number } | null;
}

export interface UserItem {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const token = localStorage.getItem('token');
    const isFormData = options?.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      headers,
      ...options,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { data: null, error: `HTTP ${res.status}: ${text}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return { data: json as T, error: null };
    }

    return { data: (await res.text()) as unknown as T, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: message };
  }
}

// --- Cards ---

export function listCards(page = 1, limit = 20) {
  return request<PaginatedResponse<CardItem>>(
    `/cards?page=${page}&limit=${limit}`,
  );
}

export function searchCards(params: {
  q?: string;
  cardType?: string;
  tags?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.cardType) qs.set('cardType', params.cardType);
  if (params.tags) qs.set('tags', params.tags);
  if (params.priceMin !== undefined) qs.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined) qs.set('priceMax', String(params.priceMax));
  if (params.sort) qs.set('sort', params.sort);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<PaginatedResponse<CardItem>>(`/cards/search?${qs.toString()}`);
}

export function getCard(id: string) {
  return request<CardItem>(`/cards/${id}`);
}

export function createCard(data: {
  title: string;
  description?: string;
  content: Record<string, unknown>;
  cardType: string;
  visibility?: string;
  price?: number;
  tags?: string[];
}) {
  return request<CardItem>('/cards', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCard(
  id: string,
  data: {
    title?: string;
    description?: string;
    content?: Record<string, unknown>;
    cardType?: string;
    visibility?: string;
    price?: number;
    tags?: string[];
  },
) {
  return request<CardItem>(`/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCard(id: string) {
  return request<{ deleted: boolean }>(`/cards/${id}`, { method: 'DELETE' });
}

// --- Tags ---

export function listTags() {
  return request<Tag[]>('/tags');
}

export function createTag(data: { name: string; slug?: string }) {
  return request<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Files ---

export function uploadFile(cardId: string, file: File, visibility?: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('cardId', cardId);
  if (visibility) form.append('visibility', visibility);

  return request<{ id: string; filename: string; storageKey: string }>(
    '/files/upload',
    { method: 'POST', body: form, headers: {} },
  );
}

export function exportCard(
  cardId: string,
  format: 'platform_json' | 'sillytavern_v2' | 'tavernai' = 'platform_json',
) {
  return request<{ id: string; format: string; filePath: string }>(
    `/files/${cardId}/export`,
    { method: 'POST', body: JSON.stringify({ format }) },
  );
}

// --- Admin ---

export function getBootstrapStatus() {
  return request<AdminBootstrapStatus>('/admin/bootstrap-status');
}

export function bootstrapAdmin(data: { token?: string; email?: string; password?: string }) {
  return request<{ success: boolean; adminId: string; email: string }>(
    '/admin/bootstrap',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

// --- Health ---

export function getHealth() {
  return request<HealthStatus>('/health');
}

// --- Config ---

export function getConfig() {
  return request<Record<string, string>>('/config');
}

export function updateConfig(data: Record<string, string>) {
  return request<{ success: boolean }>('/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Orders ---

export function createOrder(
  targetId: string,
  targetType: 'card' | 'collection' = 'card',
) {
  return request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId }),
  });
}

/** @deprecated Use createOrder(targetId, 'card') instead */
export function createCardOrder(cardId: string) {
  return createOrder(cardId, 'card');
}

export function getOrder(id: string) {
  return request<Order>(`/orders/${id}`);
}

export function listOrders() {
  return request<Order[]>('/orders');
}

// --- Admin list APIs ---

export function listAdminCards(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  cardType?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  if (params?.cardType) qs.set('cardType', params.cardType);
  return request<PaginatedResponse<CardItem>>(
    `/cards/admin/list?${qs.toString()}`,
  );
}

export function listAdminCollections(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  return request<PaginatedResponse<CollectionItem>>(
    `/collections/admin/list?${qs.toString()}`,
  );
}

export function listAdminOrders(params?: {
  page?: number;
  limit?: number;
  userId?: string;
  status?: string;
  targetType?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.status) qs.set('status', params.status);
  if (params?.targetType) qs.set('targetType', params.targetType);
  return request<PaginatedResponse<Order>>(
    `/orders/admin/list?${qs.toString()}`,
  );
}

// --- Users (admin) ---

export function listUsers(page = 1, limit = 20) {
  return request<PaginatedResponse<UserItem>>(
    `/users?page=${page}&limit=${limit}`,
  );
}

export function updateUserRole(id: string, role: 'user' | 'admin') {
  return request<UserItem>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function deleteUser(id: string) {
  return request<{ deleted: boolean }>(`/users/${id}`, { method: 'DELETE' });
}

export async function downloadExportBlob(
  exportId: string,
): Promise<{ blob: Blob | null; filename: string; error: string | null }> {
  try {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/files/exports/${exportId}/download`, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { blob: null, filename: '', error: `HTTP ${res.status}: ${text}` };
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = match?.[1] || `export-${exportId}.json`;
    const blob = await res.blob();
    return { blob, filename, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return { blob: null, filename: '', error: message };
  }
}

// --- Audit Logs (admin) ---

export interface AuditLogItem {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  target: string | null;
  detail: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditConfigItem {
  id: string;
  key: string;
  enabled: boolean;
}

export function listAuditLogs(params?: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.action) qs.set('action', params.action);
  if (params?.userId) qs.set('userId', params.userId);
  return request<PaginatedResponse<AuditLogItem>>(
    `/audit/logs?${qs.toString()}`,
  );
}

export function getAuditConfig() {
  return request<AuditConfigItem[]>('/audit/config');
}

export function updateAuditConfig(key: string, enabled: boolean) {
  return request<{ id: string; key: string; enabled: boolean }>('/audit/config', {
    method: 'PUT',
    body: JSON.stringify({ key, enabled }),
  });
}

// --- Epay ---

export function createEpayOrder(
  orderId: string,
  type: 'alipay' | 'wxpay' | 'qqpay',
) {
  return request<{ gateway: string; params: Record<string, string> }>(
    '/payments/epay/create',
    {
      method: 'POST',
      body: JSON.stringify({ orderId, type }),
    },
  );
}

// --- Collections ---

export interface CollectionItem {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  coverUrl: string | null;
  status: string;
  price: number;
  downloadCount: number;
  characterCardId: string;
  worldbookCardId: string;
  presetCardId: string;
  characterCard?: CardItem;
  worldbookCard?: CardItem;
  presetCard?: CardItem;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export function listCollections(params?: {
  q?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.priceMin !== undefined) qs.set('priceMin', String(params.priceMin));
  if (params?.priceMax !== undefined) qs.set('priceMax', String(params.priceMax));
  if (params?.sort) qs.set('sort', params.sort);
  qs.set('page', String(params?.page ?? 1));
  qs.set('limit', String(params?.limit ?? 20));
  return request<PaginatedResponse<CollectionItem>>(
    `/collections?${qs.toString()}`,
  );
}

export function getCollection(id: string) {
  return request<CollectionItem>(`/collections/${id}`);
}

export function createCollection(data: {
  title: string;
  description?: string;
  summary?: string;
  coverUrl?: string;
  price?: number;
  characterCardId: string;
  worldbookCardId: string;
  presetCardId: string;
}) {
  return request<CollectionItem>('/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCollection(
  id: string,
  data: {
    title?: string;
    description?: string;
    summary?: string;
    coverUrl?: string;
    price?: number;
    characterCardId?: string;
    worldbookCardId?: string;
    presetCardId?: string;
  },
) {
  return request<CollectionItem>(`/collections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function publishCollection(id: string) {
  return request<CollectionItem>(`/collections/${id}/publish`, { method: 'POST' });
}

export function unpublishCollection(id: string) {
  return request<CollectionItem>(`/collections/${id}/unpublish`, { method: 'POST' });
}

export function publishCard(id: string) {
  return request<CardItem>(`/cards/${id}/publish`, { method: 'POST' });
}

export function unpublishCard(id: string) {
  return request<CardItem>(`/cards/${id}/unpublish`, { method: 'POST' });
}

export function deleteCollection(id: string) {
  return request<{ deleted: boolean }>(`/collections/${id}`, { method: 'DELETE' });
}

export function exportCollection(
  collectionId: string,
  format: 'platform_json' | 'sillytavern_v2' | 'tavernai' = 'platform_json',
) {
  return request<{ id: string; format: string; filePath: string }>(
    `/collections/${collectionId}/export`,
    { method: 'POST', body: JSON.stringify({ format }) },
  );
}

export async function downloadCollectionExportBlob(
  exportId: string,
): Promise<{ blob: Blob | null; filename: string; error: string | null }> {
  try {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/collections/exports/${exportId}/download`, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { blob: null, filename: '', error: `HTTP ${res.status}: ${text}` };
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = match?.[1] || `collection-export-${exportId}.zip`;
    const blob = await res.blob();
    return { blob, filename, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return { blob: null, filename: '', error: message };
  }
}
