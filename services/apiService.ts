// src/services/api.ts (updated)
import { apiCall, setToken,setRefreshToken,clearToken } from "./api";
import { Product, PackageUnit, Role, TopPick, User, Store, StoreItemDTO, StoreReportItemDTO, PageResponse,
 OfferDetailRequest, OfferDetailResponse, Order, LoginResponse, Brand, DeliveryZone, Category,ProductVariant,
 RecentOrder, SubstitutionRequest, GroupedStoreInventoryResponseDTO, StoreCancelReasonRequestDTO, StoreCancelReasonResponseDTO, AuditLog,
 StoreInventoryApprovalDecisionDTO, StoreInventoryApprovalQueueDTO
} from "./types";

// --- API Service ---
export const apiService = {
 // --- Auth ---
 login: async (email: string, password: string) => {
  const res = await apiCall<LoginResponse>("POST", "/auth/login", { identifier: email, password, roleName: process.env.NEXT_PUBLIC_ROLE });
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  return res;
 },
 logout: () => clearToken(),

 // --- Users ---
 createAdmin: async (data: Omit<User,'roleName'>) => apiCall<User>("POST","/users",{...data, roleName:'ADMIN'}),
 getUsers: async (page: number = 0, size: number = 10) => {
  const qs = `?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`;
  return apiCall<User[]>("GET", `/users${qs}`);
 },
 getUserByUuid: async (uuid: string) => apiCall<User>("GET", `/users/${uuid}`),
 createUser: async (
  data: Omit<User, "roleName">,
  roleName: "CUSTOMER" | "STORE_OWNER" | "ADMIN" = "CUSTOMER"
 ) => apiCall<User>("POST", "/users", { ...data, roleName }),
 updateUser: async (uuid: string, data: Partial<User>) => {
  const response = await apiCall<any>("PATCH", `/users/${uuid}`, data);
  return response?.data ?? response;
 },
 deleteUser: async (uuid: string) => apiCall<void>("DELETE", `/users/${uuid}`),

 // --- Orders ---
 getTrackedOrder: async (orderShortId: string) => apiCall<Order>("GET", `/orders/track?${new URLSearchParams({ orderShortId })}`),
 refundOrderFull: async (shortId: string) => apiCall<void>("POST","/orders/refund",{orderShortId:shortId}),
 refundOrderPartial: async (
  shortId: string, 
  itemIds: number[], 
  deliveryfee: boolean,
  tip: boolean
 ) => apiCall<void>("POST", "/orders/refund/partial", { 
  orderShortId: shortId, 
  itemIds,
  deliveryFee: deliveryfee,
  tip
 }),
 getRecentOrders: async (limit: number = 45, storeUuid?: string): Promise<RecentOrder[]> => {
     const params = new URLSearchParams({ limit: String(limit) });
     const res = await apiCall<any>("GET", `/orders/recent/all?${params.toString()}`);

     const arr = Array.isArray(res) ? res : (res?.content ?? res?.data ?? res?.orders ?? []);
     return (arr || []).map((r: any) => {
      const toNumber = (v: any) => {
       if (v == null) return undefined;
       if (typeof v === "number") return v;
       const n = Number(v);
       return isNaN(n) ? undefined : n;
      };

      const shortId = r.orderShortId ?? r.orderShortIdLegacy ?? r.shortId ?? r.orderId ?? r.orderUuid ?? (r.orderUuid ? String(r.orderUuid).slice(0, 8) : "");

      let storeTotal: number | undefined = toNumber(r.storeTotal);
      if ((storeTotal === undefined || storeTotal === null) && Array.isArray(r.stores) && r.stores.length > 0) {
       if (storeUuid) {
        const matched = r.stores.find((s: any) => (s.storeUuid ?? s.uuid ?? s.id) === storeUuid);
        if (matched) {
         storeTotal = toNumber(matched.adjustedStoreTotal ?? matched.originalStoreTotal ?? matched.storeTotal ?? matched.storeTotalString);
        }
       }
       if (storeTotal === undefined) {
        const first = r.stores[0];
        storeTotal = toNumber(first?.adjustedStoreTotal ?? first?.originalStoreTotal ?? first?.storeTotal ?? first?.storeTotalString);
       }
      }

      if (storeTotal === undefined) {
       storeTotal = toNumber(r.originalTotal ?? r.adjustedTotal ?? r.total ?? r.orderTotal);
      }

      return {
       orderShortId: String(shortId ?? ""),
       customerName: r.userName ?? r.customerName ?? r.userFullName ?? r.name ?? "",
       address: r.address ?? r.deliveryAddress ?? undefined,
       storeTotal: storeTotal,
       updatedAt: r.updatedAt ?? r.orderInitiatedAt ?? r.createdAt ?? undefined,
       deliveryTime: r.estimatedDeliveryTime ?? r.deliveryTime ?? undefined,
       orderStatus: r.orderStatus ?? r.storeStatus ?? undefined,
       originalTotal: toNumber(r.originalTotal ?? r.orderTotal ?? r.total),
       storeUuid: storeUuid ?? r.storeUuid ?? (Array.isArray(r.stores) && r.stores[0] ? (r.stores[0].storeUuid ?? r.stores[0].uuid) : undefined),
       __raw: r
      } as RecentOrder;
     });
  },




 // --- Products ---
 getProducts: async (): Promise<Product[]> => {
  let allProducts: Product[] = [];
  let page = 0;
  const size = 50;
  let totalPages = 1;

  do {
   const raw = await apiCall<any>("GET", `/products?page=${page}&size=${size}`);
   console.debug(`apiService.getProducts raw page ${page}:`, raw);

   const content: Product[] = Array.isArray(raw) ? raw : raw?.content ?? [];
   allProducts = allProducts.concat(content);

   totalPages = raw?.totalPages ?? 1;
   page++;
  } while (page < totalPages);

  return allProducts;
 },

 getProductById: async (uuid: string) => apiCall<Product>("GET", `/products/${uuid}`),
 createProduct: async (data: Partial<Product>) =>
  apiCall<Product>("POST", "/products", {
   productName: data.productName,
   description: data.description ?? "",
   brand: data.brand,
   categoryName: data.categoryName,
   taxCategory: data.taxCategory ?? "General",
      isAlcoholic: data.isAlcoholic ?? false,
      isGlutenFree: data.isGlutenFree ?? false,
      isKosher: data.isKosher ?? false,
      isWine: data.isWine ?? false,
      hasTobacco: data.hasTobacco ?? false,
      hasCannabis: data.hasCannabis ?? false,
      isReturnable: data.isReturnable ?? true,
      isPerishable: data.isPerishable ?? false,
      allergenInfo: data.allergenInfo ?? "",
      nutritionalInfo: data.nutritionalInfo ?? "",
      active: data.isActive ?? true,
    }),

  updateProduct: async (uuid: string, data: Partial<Product>) =>
    apiCall<Product>("PATCH", `/products/${uuid}`, {
      productName: data.productName,
      description: data.description ?? "",
      brand: data.brand,
      categoryName: data.categoryName,
      taxCategory: data.taxCategory ?? "General",
      isAlcoholic: data.isAlcoholic ?? false,
      isGlutenFree: data.isGlutenFree ?? false,
      isKosher: data.isKosher ?? false,
      isWine: data.isWine ?? false,
      hasTobacco: data.hasTobacco ?? false,
      hasCannabis: data.hasCannabis ?? false,
      isReturnable: data.isReturnable ?? true,
      isPerishable: data.isPerishable ?? false,
      allergenInfo: data.allergenInfo ?? "",
      nutritionalInfo: data.nutritionalInfo ?? "",
      active: data.isActive ?? true,
    }),

  deleteProduct: async (uuid: string) => apiCall<void>("DELETE", `/products/${uuid}`),

  createVariant: async (productId: string, data: unknown) =>
    apiCall<ProductVariant>("POST", `/products/${productId}/variants`, data),

  updateVariant: async (variantId: string, data: unknown) => 
 apiCall<ProductVariant>("PATCH", `/products/variants/${variantId}`, data),
 
deleteVariant: async (variantId: string) => 
 apiCall<void>("DELETE", `/products/variants/${variantId}`),

 // --- Brands ---
 getBrands: async () => apiCall<Brand[]>("GET","/brands"),
 createBrand: async (data: Partial<Brand>) => apiCall<Brand>("POST","/brands",data),
 updateBrand: async (id: string, data: Partial<Brand>) => apiCall("PATCH", `/brands/${id}`, data),
 deleteBrand: async (id: string) => apiCall<void>("DELETE", `/brands/${id}`),

 // --- Categories ---
 getCategories: async () => apiCall<Category[]>("GET","/categories"),
 createCategory: async (data: Partial<Category>) => apiCall<Category>("POST","/categories",data),
 updateCategory: async (id: string, data: Partial<Category>) => apiCall<Category>("PUT", `/categories/${id}`, data),
 deleteCategory: async (id: string) => apiCall<void>("DELETE", `/categories/${id}`),

 // --- Package-Unit
 getPackageUnits: async (page = 0, size = 50): Promise<PackageUnit[]> => {
  let all: PackageUnit[] = []
  let currentPage = page
  let totalPages = 1

  do {
   const res = await apiCall<{ content: PackageUnit[]; totalPages: number }>(
    "GET",
    `/package-units?page=${currentPage}&size=${size}`
   )
   all = all.concat(res.content)
   totalPages = res.totalPages
   currentPage++
  } while (currentPage < totalPages)

  return all
 },
 createPackageUnit: async (data: Partial<PackageUnit>) => apiCall<PackageUnit>("POST", "/package-units", data),
 updatePackageUnit: async (id: number, data: Partial<PackageUnit>) => apiCall<PackageUnit>("PUT", `/package-units/${id}`, data),
 deletePackageUnit: async (id: number) => apiCall<void>("DELETE", `/package-units/${id}`),

 // --- Stores & Zones ---
 getStores: async (filters?: {
  storeName?: string;
  corporationName?: string;
  isActive?: boolean;
  isCurrentlyAcceptingOrders?: boolean;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  size?: number;
 }) => {
  const params = new URLSearchParams();

  if (filters?.storeName) params.append("storeName", filters.storeName);
  if (filters?.corporationName) params.append("corporationName", filters.corporationName);
  if (typeof filters?.isActive === "boolean") params.append("isActive", String(filters.isActive));
  if (typeof filters?.isCurrentlyAcceptingOrders === "boolean") params.append("isCurrentlyAcceptingOrders", String(filters.isCurrentlyAcceptingOrders));
  if (filters?.createdFrom) params.append("createdFrom", filters.createdFrom);
  if (filters?.createdTo) params.append("createdTo", filters.createdTo);
  params.append("page", String(filters?.page ?? 0));
  params.append("size", String(filters?.size ?? 200));

  const endpoint = `/stores?${params.toString()}`;
  const res = await apiCall<any>("GET", endpoint);
  return Array.isArray(res) ? res : (res?.content ?? []);
 },
 getStoreByUuid: async (uuid: string): Promise<Store> => apiCall("GET", `/stores/${uuid}`),
 updateStore: async (storeUuid: string, updateData: Partial<Store>): Promise<Store> => {
  console.log(`API: Updating store ${storeUuid}`);
  return apiCall<Store>("PATCH", `/stores/${storeUuid}`, updateData);
 },
 deleteStore: async (storeUuid: string): Promise<void> => {
  console.log(`API: Deleting store ${storeUuid}`);
  return apiCall<void>("DELETE", `/stores/uuid/${storeUuid}`);
 },
 createZone: async (data: DeliveryZone) => apiCall<DeliveryZone>("POST","/vendor/zones",data),
 updateZone: async (zoneId: string, data: Partial<DeliveryZone>) => apiCall<DeliveryZone>("PATCH", `/vendor/zones/${zoneId}`, data),
 deleteZone: async (zoneId: string) => apiCall<void>("DELETE", `/vendor/zones/${zoneId}`),
 getZonesByStoreUuid: async (storeUuid: string) => apiCall<DeliveryZone[]>("GET", `/vendor/zones/${storeUuid}`),
 getStoreOperatingHours: async (storeUuid: string) => apiCall<any[]>("GET", `/stores/operating-hours/${storeUuid}`),
 addStoreOperatingHours: async (storeUuid: string, data: any) => apiCall<any>("POST", `/stores/operating-hours/${storeUuid}`, data),
 updateStoreOperatingHours: async (storeUuid: string, data: any[]) => apiCall<any[]>("PATCH", `/stores/operating-hours/${storeUuid}`, data),
 deleteStoreOperatingHours: async (storeUuid: string, dayOfWeek: string) => apiCall<void>("DELETE", `/stores/operating-hours/${storeUuid}?dayOfWeek=${encodeURIComponent(dayOfWeek)}`),
 getStoreHolidayHours: async (storeUuid: string) => apiCall<any[]>("GET", `/stores/holiday-hours/${storeUuid}`),
 addStoreHolidayHours: async (data: any) => apiCall<any>("POST", `/stores/holiday-hours`, data),
 updateStoreHolidayHours: async (id: number, data: any) => apiCall<any>("PATCH", `/stores/holiday-hours/${id}`, data),
 deleteStoreHolidayHours: async (id: number) => apiCall<void>("DELETE", `/stores/holiday-hours/${id}`),

 // --- Store Inventory ---
 addStoreInventory: async (data: any) => apiCall<any>("POST", `/stores-inventory/products`, data),
 updateStoreInventoryItems: async (storeUuid: string, data: any[]) => apiCall<any>("PATCH", `/stores-inventory/${storeUuid}/products`, data),
 deleteStoreInventoryItem: async (storeUuid: string, variantId: number) => apiCall<void>("DELETE", `/stores-inventory/${storeUuid}/products/${variantId}`),

 // --- Store Inventory Approval ---
 getPendingInventoryApprovals: async (page = 0, size = 20, storeUuid?: string): Promise<PageResponse<StoreInventoryApprovalQueueDTO>> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (storeUuid) params.append("storeUuid", storeUuid);
  return apiCall<PageResponse<StoreInventoryApprovalQueueDTO>>("GET", `/stores-inventory/approvals/pending?${params.toString()}`);
 },

 reviewInventoryApproval: async (storeInventoryId: number, decision: StoreInventoryApprovalDecisionDTO): Promise<string> => {
  const res = await apiCall<any>("PATCH", `/stores-inventory/approvals/${storeInventoryId}`, decision);
  return res?.message ?? res?.data ?? res ?? "Updated";
 },

 // --- Bulk Upload History ---
 getUploadHistory: async (page = 0, size = 20, storeUuid?: string): Promise<PageResponse<any>> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (storeUuid) params.append("storeUuid", storeUuid);
  return apiCall<PageResponse<any>>("GET", `/stores-inventory/upload-history?${params.toString()}`);
 },

 uploadBulkInventory: async (file: File, storeUuid: string): Promise<any> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("storeUuid", storeUuid);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const token = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("session") || "{}")?.token : "";
  const res = await fetch(`${baseUrl}/stores-inventory/upload`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Upload failed with status ${res.status}`);
  }
  return res.json();
 },

 // --- Roles ---
 getRoles: async () => apiCall<Role[]>("GET","/roles"),
 getRoleById: async (id: string) => apiCall<Role>("GET", `/roles/${id}`),
 addRole: async (role: { name: string; description: string; permissions: string[] }) => apiCall<Role>("POST", "/roles", role),
 updateRole: async (id: string, role: { name: string; description: string; permissions: string[] }) => apiCall<Role>("PUT", `/roles/${id}`, role),

 deleteRole: async (id: string) => apiCall<void>("DELETE", `/roles/${id}`),

 //Role-permission
getRolePermissions: async () => apiCall<string[]>("GET","/roles/permissions"),
 addRolePermissions: async (roleId: string, permissions: string[]) =>
 apiCall( "POST",`/roles/${roleId}/permissions`,{ permissions }),
 removeRolePermission: async (roleId: string, permissions: string[]) =>
 apiCall<void>("DELETE", `/roles/${roleId}/permissions`, { permissions }),

 

 // --- Top Picks ---
 getTopPicks: async () => {
  const data = await apiCall<TopPick[]>("GET", "/top-picks");
  return data.map(tp => ({ ...tp, rank: tp.rankingScore }));
 },
 addTopPick: async (productUuid: string, rank: number) =>
  apiCall<TopPick>("POST", `/top-picks/${productUuid}?rankingScore=${encodeURIComponent(rank)}`),
 updateTopPick: async (productUuid: string, rank: number, isFeatured?: boolean) =>
  apiCall<TopPick>("PATCH", `/top-picks/${productUuid}`, {
   rankingScore: rank,
   ...(isFeatured !== undefined ? { isFeatured } : {}),
  }),
 removeTopPick: async (productUuid: string) =>
  apiCall<void>("DELETE", `/top-picks/${productUuid}`),

 // ---Coupon and Offer---
  createOffer: async (offer: OfferDetailRequest): Promise<number> => {
  const res = await apiCall<any>("POST", "/offers", offer);
  return (res?.data ?? res?.offerId ?? res?.id ?? res) as number;
 },

 updateOffer: async (offer: OfferDetailRequest): Promise<void> => {
  await apiCall<any>("PUT", "/update-offer-detail", offer);
 },

getConsumptionHistory: async (offerId: number): Promise<OfferDetailResponse> => {
 const raw = await apiCall<any>(
  "GET",
  `/consumption-history-detail?offerId=${encodeURIComponent(String(offerId))}`
 );

 const normalizeDate = (dt: any): string => {
  if (dt == null) return "";
  if (typeof dt === "string") return dt;
  if (typeof dt === "number") return new Date(dt).toISOString();
  try {
   const d = new Date(dt);
   if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
  }
  return String(dt);
 };

 const users = (raw?.usedUser ?? raw?.users ?? []).map((u: any) => ({
  id: u?.userId ?? u?.id ?? undefined,
  uuid: u?.uuid ?? u?.userUuid ?? undefined,
  fullName: u?.fullName ?? u?.name ?? undefined,
  mobileNumber: u?.phoneNumber ?? u?.mobileNumber ?? u?.mobile ?? undefined,
  phoneNumber: u?.phoneNumber ?? u?.mobileNumber ?? undefined,
  email: u?.emailId ?? u?.email ?? undefined,
  usedAt: (u?.couponPurchaseDateTime ?? u?.usedAt ?? []).map((dt: any) => normalizeDate(dt)),
 }));

 return {
  offerId: raw?.offerId ?? 0,
  storeId: raw?.storeId ?? 0,
  couponId: raw?.couponId ?? 0,
  couponCode: raw?.offerCode ?? raw?.couponCode ?? "",
  users,
 };
},


 deleteOffer: async (offerId: number): Promise<void> => {
  await apiCall<any>("POST", `/offers/${encodeURIComponent(String(offerId))}`);
 },

 toggleOfferStatus: async (offerId: number): Promise<void> => {
  await apiCall<any>("PATCH", `/offers/${encodeURIComponent(String(offerId))}/status`);
 },
 getAllOffers: async (storeId: number) => {
  return apiCall<any[]>("GET", `/offers?storeId=${encodeURIComponent(String(storeId))}`);
 },
  getAllGlobalOffers: async () => {
    return apiCall<any[]>("GET", `/offers/global`);
  },
 getOfferDetailView: async (offerId: number): Promise<any> => {
 return apiCall<any>("GET", `/offer-details?offerId=${encodeURIComponent(String(offerId))}`);
},



 // --- Reports ---
getReports: async (
  storeUuid?: string,
  startDate?: string,
  endDate?: string,
  page: number = 0,
  size: number = 10
 ): Promise<PageResponse<StoreReportItemDTO>> => {
  const params = new URLSearchParams();
  if (storeUuid) params.append("storeUuid", storeUuid);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  params.append("page", String(page));
  params.append("size", String(size));

  const endpoint = `/vendor/report${params.toString() ? `?${params.toString()}` : ""}`;
  return apiCall<PageResponse<StoreReportItemDTO>>("GET", endpoint);
 },

 //Substitution
 substituteItems: async (request: SubstitutionRequest) => {
  return apiCall<void>("POST", "/orders/substitute", request);
 },
 getStoreInventory: async (storeUuid: string, page = 0, size = 50) => {
  const qs = `?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`;
  return apiCall<PageResponse<GroupedStoreInventoryResponseDTO>>(
   "GET",
   `/stores-inventory/${storeUuid}/products${qs}`
  );
 },

  // --- Store Cancel Reasons ---
  getCancelReasons: async (): Promise<StoreCancelReasonResponseDTO[]> =>
    apiCall<StoreCancelReasonResponseDTO[]>("GET", "/reasons"),

  getCancelReason: async (id: number): Promise<StoreCancelReasonResponseDTO> =>
    apiCall<StoreCancelReasonResponseDTO>("GET", `/reasons/${id}`),

  createCancelReason: async (data: StoreCancelReasonRequestDTO): Promise<StoreCancelReasonResponseDTO> =>
    apiCall<StoreCancelReasonResponseDTO>("POST", "/reasons", data),

  updateCancelReason: async (id: number, data: StoreCancelReasonRequestDTO): Promise<StoreCancelReasonResponseDTO> =>
    apiCall<StoreCancelReasonResponseDTO>("PATCH", `/reasons/${id}`, data),

  deleteCancelReason: async (id: number): Promise<void> =>
    apiCall<void>("DELETE", `/reasons/${id}`),


  // Fetch audit logs by date range (admin endpoint already present on backend)
  getAuditLogsByDateRange: async (startIso: string, endIso: string): Promise<AuditLog[]> => {
    const qs = `?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
    // backend returns an array of AuditLog objects
    return apiCall<AuditLog[]>("GET", `/api/audit-logs/date-range${qs}`);
  },

};
