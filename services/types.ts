// src/services/types.ts
export interface LoginResponse { 
  token: string; 
  refreshToken: string; 
  id: string; 
  email: string; role: string 
}

export interface User {
  id?: number;
  uuid?: string;
  email: string
  password?: string
  fullName: string
  mobileNumber?: string
  dob?: string // Use ISO string when sending to backend (e.g., "2003-05-21")
  roleName: "CUSTOMER" | "STORE_OWNER" | "ADMIN"
}

export interface ProductPage {
  content: Product[];
  totalElements: number;
  totalPages: number;
  number: number; // current page
  size: number;
}


export interface ProductVariant {
  packageName?: string;
  thumbnailImageUrl?: string;
  fullSizeImageUrl?: string;
  upc?: string;
  unitPrice: number;
  shelfLifeDays?: number;
  alcoholByVolume?: number;
  weightGrams?: number;
  calories?: number;
  carbs?: number;
  ibuValue?: number;
  sugars?: number;
  addedSugars?: number;
  dimensionsCm?: string;
  storageInstructions?: string;
  variantId: number;
}

export interface Product {
  productName: string;
  description: string;
  brand: string;
  categoryName: string;
  taxCategory?: string;
  isAlcoholic?: boolean;
  isGlutenFree?: boolean;
  isKosher?: boolean;
  isWine?: boolean;
  hasTobacco?: boolean;
  hasCannabis?: boolean;
  isReturnable?: boolean;
  isPerishable?: boolean;
  allergenInfo?: string;
  nutritionalInfo?: string;
  isActive?: boolean;
  productId: number;
  uuid: string;
  variantsDTO?: ProductVariant[];
}


export interface Brand { 
  id: string; 
  name: string 
}

export interface Category { 
  id: string; 
  name: string; 
  description: string 
}


export interface Store {
  uuid: string;
  storeName: string;
  corporationName?: string;
  ein?: number;
  licenseNumber?: string;
  liquorLicenseUrl?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  deliveryRadiusKm?: number;
  minimumOrderAmount?: number;
  averagePreparationTime?: number;
  isCurrentlyAcceptingOrders?: boolean;
  rating?: number;
  taxRate?: number;
  commissionRate?: number;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface Role {
  id: string;
  name: string;
  description:string;
  permissions: string[];
}

export interface RolePermissionsResponse {
  roleId: number;
  roleName: string;
  permissions: string[];
}

export interface TopPick {
  id: number
  productId: number
  uuid?: string
  productName: string
  rankingScore: number
  isFeatured: boolean
  updatedAt?: string
  thumbnailImageUrl?: string
}


export interface Report { 
  store: string; 
  orders: number; 
  revenue: number; 
  date: string 
}

export interface DeliveryZone { 
  zoneId:number; 
  zoneName: string; 
  baseDeliveryFee: number;
  perMileFee: number; 
  minOrderAmount: number; 
  estimatedPreparationTime: number; 
  restricted: boolean; 
  coordinates: number[][]; 
  storeUuid: string 
}


export interface CreateDeliveryZoneRequest {
  zoneName: string;
  baseDeliveryFee: number;
  perMileFee: number;
  minOrderAmount: number;
  estimatedPreparationTime: number;
  restricted: boolean;
  coordinates: [number, number][]; // array of [lat, lng] tuples
  storeUuid: string;
}


export interface StoreItemDTO {
  storeUuid: string
  storeName: string
  storeAddress: string
  storePhone: string
  storeEmail?: string
  storeDeliveryFee?: number
  items?: {
    itemId: number
    itemName: string
    quantity: number
    price: number
    finalPrice: number
    isRefunded: boolean
    status: string
  }[]
}

export interface OrderItem {
  id: number
  name: string
  price: number
}

export interface Order {
  // --- IDENTIFICATION & LOGISTICS (UPDATED) ---
  orderUuid: string // The primary UUID (derived from something else, or implicitly present)
  orderShortId: string // Matches the entity's 'shortId'
  
  // --- USER/ADDRESS (DERIVED) ---
  userUuid: string 
  userName: string
  userEmail: string
  address: string
  mobileNumber: string

  // --- STATUS ---
  orderStatus: string
  paymentStatus: string // Payment status comes from the Payment entity/service, not the Order entity
  refundStatus?: string // Matches the entity field

  // --- FINANCIALS ---
  subtotal: number
  totalTax: number
  totalStoreDiscount: number
  totalSipstrDiscount: number
  totalDeliveryFee: number
  serviceFee: number
  tip: number
  totalCheckoutBagFee: number
  totalBottleDepositFee: number
  refundAmount: number
  originalTotal: number
  adjustedTotal: number
  differenceTotal: number

  // --- DETAILS ---
  itemOrderedCount: number
  totalQuantity: number
  specialInstructions: string
  
  // --- TIMING & SCHEDULING (UPDATED) ---
  createdAt: string // Matches the entity's 'createdAt'
  estimatedDeliveryTime: string
  actualDeliveryTime?: string
  isScheduled: boolean
  scheduledTime?: string // Matches the entity field
  deliveredAt?: string // Matches the entity field
  refundedAt?: string // Matches the entity field

  // --- FULFILLMENT ---
  deliveryOtp?: string // Matches the entity field
  // NOTE: You still need to derive 'paymentMethod' and 'deliveryType' from the payments/services layers if needed for the UI.

  // --- RELATIONS ---
  stores: StoreItemDTO[] // Details from OrderStore/OrderStoreItem
  items?: OrderItem[] // Flat list of all items (derived for the Partial Refund UI)
}

export const ORDER_STATUSES = [
  "CREATED",
  "PAYMENT_PENDING",
  "ACCEPTED_BY_STORE",
  "PARTIALLY_ACCEPTED_BY_STORE",
  "SCHEDULED",
  "READY_TO_PICKUP",
  "CANCELLED_BY_CUSTOMER",
  "OUT_FOR_DELIVERY",
  "PARTIAL_DELIVERED",
  "CANCELLED_BY_STORE",
  "PARTIALLY_CANCELLED",
  "DAMAGED",
  "DELIVERED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export interface PackageUnit {
  packageId: number;
  packageName: string;
  description?: string;
  packageType: "CAN" | "GLASS_BOTTLE" | "KEG" | "PLASTIC_BOTTLE" | "TETRA_PAK" | "OTHER";
}

export interface StoreReportItemDTO {
  storeName: string;
  orderUuid: string;
  subtotal: string; // backend BigDecimal -> string in JSON
  deliveryFee: string;
  checkoutBagFee: string;
  bottleDepositFee: string;
  tax: string;
  tip: string;
  storeTotal: string;
  refundedAmount: string;
  paymentGatewayFee: string;
  withheldTax: string;
  targetedPromotion: string;
  netTotal: string;
  storeStatus: string; // OrderStatusEnum as string
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-indexed)
  size: number;
}

export interface OfferDetailResponse {
  offerId: number;
  storeId: number;
  couponId: number;
  couponCode: string;
  users: Array<{
    id: number;
    uuid: string;
    fullName?: string;
    mobileNumber?: string;
    email?: string;
    usedAt?: string[]; // list of timestamps
  }>;
}

export interface OfferDetailRequest {
  offerId?: number | null;
  storeId?: number | null;
  name: string;
  type?:"FLAT" | "PERCENTAGE"
  method: "COUPON" | "VOUCHER" | string;
  startDateTime?: string;
  endDateTime?: string;
  discount?: number;
  allowedMaxDiscount?: number;
  minSpendAmount?: number;
  maxTotalUsage?: number;
  requiredVoucherCount?: number;
  description?: string;
  couponDetail?: CouponDetailDTO | null;
}

export interface CouponDetailDTO {
  id?: number;
  offerId?: number;
  code?: string;
  websiteDisplayMessage?: string;
  maxUsagePerUser?: number;
  totalUsabilityCount?: number;
  usabilityOption?: "MONTH" | "QUARTER" | "HALF_YEAR" | "YEAR";
}


export interface OfferListItem {
  offerId: number;
  storeId?: number | null;
  name: string;
  type?: string;
  method?: string;
  startDateTime?: string;
  endDateTime?: string;
  discount?: number;
  allowedMaxDiscount?: number;
  minSpendAmount?: number;
  maxTotalUsage?: number;
  requiredVoucherCount?: number;
  description?: string;
  isActive?: boolean;
  status?: string;
  coupons?: CouponDetailDTO | null;
}

export interface RecentOrder {
  orderShortId: string;     
  customerName: string;     
  address?: string;         
  storeTotal?: number;      
  updatedAt?: string;       
  deliveryTime?: string;    
  orderStatus?: string;     
  originalTotal?:number;
  storeUuid?: string;
  __raw?: any;
}

export interface SubstitutionItemRequest {
    originalOrderItemId: number;
    substituteStoreInventoryId: number;
    substituteQuantity: number;
}

export interface SubstitutionRequest {
    orderShortId: string;
    storeUuid: string;
    substitutions: SubstitutionItemRequest[];
}

export interface StoreInventory {
    id: number;
    productName: string;
    variantName?: string;
    inventoryCount: number;
    supplierPrice: number;
}

// Grouped inventory DTOs returned by GET /{storeUUID}/products
export interface StoreInventoryVariantDTO {
  storeInventoryId: number;
  variantId: number;
  packageName?: string;
  price?: number | string;   // backend BigDecimal often appears as string
  quantity: number;          // available inventory count
  thumbnailImageUrl?: string;
}

export interface SelectedInventoryPick {
        storeInventoryId: number;
        variant: StoreInventoryVariantDTO; // Using your type for variant data
        productName: string;
        qty: number;
        storeUuid?: string;
    }

export interface GroupedStoreInventoryResponseDTO {
  productName: string;
  productId: number;
  variants: StoreInventoryVariantDTO[];
}

// types.ts (add)
export type StoreCancelReasonRequestDTO = {
  reason: string;
  description?: string;
};

export type StoreCancelReasonResponseDTO = {
  id: number;
  reason: string;
  description?: string;
  deleted?: boolean;
};

export interface AuditLogStoreInfo {
  storeUuid?: string;
  storeName?: string;
  // keep flexible: backend shape may vary
  [k: string]: any;
}

export interface AuditLog {
  id: number;
  userId?: number;
  userUuid?: string;
  userEmail?: string;
  httpMethod?: string;
  endpoint?: string;
  queryParams?: string | null;
  requestBody?: string | object | null;
  responseBody?: string | object | null;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  responseTimeMs?: number;
  errorMessage?: string | null;
  createdAt?: string; // ISO
  // keep raw shape for flexibility
  [k: string]: any;
}