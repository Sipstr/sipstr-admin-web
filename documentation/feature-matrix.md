# Sipstr Admin Web - Feature Matrix

Last updated: 2026-05-20

This matrix lists all implemented features in the workspace, including module behavior, feature flags, primary UI files, and backend API integrations.

## 1) Core Platform

| Area | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| App shell | Next.js app-router wrapper around client app | N/A | app/page.tsx, app/layout.tsx, app.tsx | N/A |
| Session handling | In-memory admin session state after login | N/A | app.tsx | /auth/login |
| Token lifecycle | Access token and refresh token storage, clear on logout | N/A | services/api.ts | /auth/login, /auth/refresh-token |
| Auto refresh | Retries on 401/403 via refresh-token flow | N/A | services/api.ts | /auth/refresh-token |
| Static build target | Next export output for static hosting | N/A | next.config.ts | N/A |
| Shared table UI | Reusable CRUD data table for modules | N/A | components/CrudTable.tsx | N/A |

## 2) Authentication

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Admin login form | Email/password login with loading and validation | N/A | components/LoginPage.tsx, app.tsx | /auth/login |
| Auth error UX | Distinguishes wrong credentials vs generic backend failure | N/A | app.tsx | /auth/login |
| Logout | Clears local tokens and returns to login screen | N/A | app.tsx, services/api.ts, services/apiService.ts | N/A |

## 3) Dashboard And Navigation

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Left navigation | Module switcher + collapse/expand sidebar | N/A | components/Sidebar.tsx, components/DashboardLayout.tsx | N/A |
| Module gating | Environment-driven feature visibility using NEXT_PUBLIC_FEATURE_* flags | Module specific | components/Sidebar.tsx, README.md | N/A |
| Dashboard home | Summary cards (currently static values) | NEXT_PUBLIC_FEATURE_DASHBOARD | components/DashboardLayout.tsx | N/A |

## 4) Business Modules

### 4.1 Users

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| User listing | Paginated list with normalization for varied backend response shapes | NEXT_PUBLIC_FEATURE_USERS | components/UsersModule.tsx | GET /users?page=&size= |
| Create user | Create CUSTOMER/STORE_OWNER/ADMIN users | NEXT_PUBLIC_FEATURE_USERS | components/UsersModule.tsx | POST /users |
| Read user | View by UUID | NEXT_PUBLIC_FEATURE_USERS | components/UsersModule.tsx | GET /users/{uuid} |
| Update user | Partial patch update | NEXT_PUBLIC_FEATURE_USERS | components/UsersModule.tsx | PATCH /users/{uuid} |
| Delete user | Delete with confirmation dialog | NEXT_PUBLIC_FEATURE_USERS | components/UsersModule.tsx | DELETE /users/{uuid} |

### 4.2 Roles And Permissions

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Roles CRUD | Create/read/update/delete role entities | NEXT_PUBLIC_FEATURE_ROLES | components/RolesModule.tsx | GET /roles, GET /roles/{id}, POST /roles, PUT /roles/{id}, DELETE /roles/{id} |
| Permission catalog | Loads available permissions from backend | NEXT_PUBLIC_FEATURE_ROLES | components/RolesModule.tsx | GET /roles/permissions |
| Assign permissions | Adds permission set to role | NEXT_PUBLIC_FEATURE_ROLES | components/RolesModule.tsx | POST /roles/{roleId}/permissions |
| Remove permissions | Removes permission set from role | NEXT_PUBLIC_FEATURE_ROLES | components/RolesModule.tsx | DELETE /roles/{roleId}/permissions |

### 4.3 Brands, Categories, Packages

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Brands management | CRUD + search | NEXT_PUBLIC_FEATURE_BRANDS | components/BrandsModule.tsx | GET/POST /brands, PATCH/DELETE /brands/{id} |
| Categories management | CRUD + search | NEXT_PUBLIC_FEATURE_BRANDS | components/BrandsModule.tsx | GET/POST /categories, PUT/DELETE /categories/{id} |
| Package units | Paginated fetch + CRUD | NEXT_PUBLIC_FEATURE_BRANDS | components/BrandsModule.tsx | GET /package-units?page=&size=, POST /package-units, PUT/DELETE /package-units/{id} |

### 4.4 Products And Variants

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Product catalog | Full product fetch across paginated backend | NEXT_PUBLIC_FEATURE_PRODUCTS | components/ProductsModule.tsx, services/apiService.ts | GET /products?page=&size= |
| Product CRUD | Add/update/delete products with business attributes | NEXT_PUBLIC_FEATURE_PRODUCTS | components/ProductModal.tsx, components/ProductsModule.tsx | POST /products, PATCH /products/{uuid}, DELETE /products/{uuid} |
| Product filters | Search by product/category/brand + active state filter | NEXT_PUBLIC_FEATURE_PRODUCTS | components/ProductsModule.tsx | N/A |
| Variants CRUD | Add/update/delete product variants | NEXT_PUBLIC_FEATURE_PRODUCTS | components/VariantModal.tsx | POST /products/{productId}/variants, PATCH /products/variants/{variantId}, DELETE /products/variants/{variantId} |

### 4.5 Stores

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Store listing | Lists stores in table | NEXT_PUBLIC_FEATURE_STORES | components/StoresModule.tsx | GET /stores |
| Store detail edit | Loads store by UUID and updates fields | NEXT_PUBLIC_FEATURE_STORES | components/StoresModule.tsx | GET /stores/{uuid}, PATCH /stores/{uuid} |
| Store deletion | Delete store with confirmation | NEXT_PUBLIC_FEATURE_STORES | components/StoresModule.tsx | DELETE /stores/{uuid} |

### 4.6 Orders And Refunds

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Recent orders | Fetches recent order list and shows preview table | NEXT_PUBLIC_FEATURE_ORDERS | components/OrdersModule.tsx | GET /orders/recent/all?limit= |
| Order tracking | Full order details by short id | NEXT_PUBLIC_FEATURE_ORDERS | components/OrdersModule.tsx | GET /orders/track?orderShortId= |
| Full refund | Executes full refund flow | NEXT_PUBLIC_FEATURE_ORDERS | components/OrdersModule.tsx | POST /orders/refund |
| Partial refund | Refund selected items and optional fee/tip | NEXT_PUBLIC_FEATURE_ORDERS | components/OrdersModule.tsx | POST /orders/refund/partial |

### 4.7 Coupons, Offers, Vouchers

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Store offers | Load and manage offers by store id | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | GET /offers?storeId= |
| Global offers | Load and manage global offers | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | GET /offers/global |
| Offer create | Creates offer details (coupon/voucher) | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | POST /offers |
| Offer update | Updates detailed offer payload | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | PUT /update-offer-detail |
| Offer detail view | Fetch detailed offer payload for edit | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | GET /offer-details?offerId= |
| Consumption history | Shows redemption/user usage details | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | GET /consumption-history-detail?offerId= |
| Offer status toggle | Enable/disable offer | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | PATCH /offers/{offerId}/status |
| Offer delete | Delete flow via existing backend contract | NEXT_PUBLIC_FEATURE_COUPON | components/CouponModule.tsx | POST /offers/{offerId} |

### 4.8 Top Picks

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Top picks list | Lists and maps ranking score | NEXT_PUBLIC_FEATURE_TOP_PICKS | components/TopPicksModule.tsx | GET /top-picks |
| Add top pick | Adds product as top pick with rank | NEXT_PUBLIC_FEATURE_TOP_PICKS | components/TopPicksModule.tsx | POST /top-picks/{productUuid}?rankingScore= |
| Update top pick | Updates ranking and feature state | NEXT_PUBLIC_FEATURE_TOP_PICKS | components/TopPicksModule.tsx | PATCH /top-picks/{productUuid} |
| Remove top pick | Deletes top pick entry | NEXT_PUBLIC_FEATURE_TOP_PICKS | components/TopPicksModule.tsx | DELETE /top-picks/{productUuid} |

### 4.9 Delivery Zones

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Zone listing | Fetch zones for selected store | NEXT_PUBLIC_FEATURE_ZONES | components/Delivery.tsx, services/deliveryZone.ts | GET /vendor/zones/{storeUuid} |
| Zone CRUD | Create, update, delete delivery zones | NEXT_PUBLIC_FEATURE_ZONES | components/Delivery.tsx, services/deliveryZone.ts | POST /vendor/zones, PATCH /vendor/zones/{zoneId}, DELETE /vendor/zones/{zoneId} |
| KML import | Parses placemarks and maps metadata to zone fields | NEXT_PUBLIC_FEATURE_ZONES | components/Delivery.tsx | N/A |
| Batch import | Creates multiple zones from imported placemarks | NEXT_PUBLIC_FEATURE_ZONES | components/Delivery.tsx | POST /vendor/zones |
| Map preview | Renders polygons and zone details in Google Maps | NEXT_PUBLIC_FEATURE_ZONES | googlemap/MapPreviewGoogle.tsx | N/A |

### 4.10 Reports

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Report generation | Store + date-range based report query | NEXT_PUBLIC_FEATURE_REPORTS | components/ReportsModule.tsx | GET /vendor/report?storeUuid=&startDate=&endDate=&page=&size= |
| Report paging | Paged backend response handling | NEXT_PUBLIC_FEATURE_REPORTS | components/ReportsModule.tsx | GET /vendor/report... |
| Validation + UX | Date/store validation and toast-based errors | NEXT_PUBLIC_FEATURE_REPORTS | components/ReportsModule.tsx | N/A |

### 4.11 Substitute

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Substitution workspace | Open recent orders and prepare substitution payload | NEXT_PUBLIC_FEATURE_SUBSTITUTE | components/SubstituteModule.tsx | GET /orders/recent/all, GET /orders/track |
| Inventory lookup | Store-level grouped inventory fetch | NEXT_PUBLIC_FEATURE_SUBSTITUTE | components/SubstituteModule.tsx | GET /stores-inventory/{storeUuid}/products?page=&size= |
| Submit substitutions | Sends substitution actions for order items | NEXT_PUBLIC_FEATURE_SUBSTITUTE | components/SubstituteModule.tsx | POST /orders/substitute |

### 4.12 Reasons

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Cancel reasons CRUD | Create/read/update/delete store cancel reasons | NEXT_PUBLIC_FEATURE_REASONS | components/ReasonsModule.tsx | GET /reasons, GET /reasons/{id}, POST /reasons, PATCH /reasons/{id}, DELETE /reasons/{id} |

### 4.13 Audit Logs

| Feature | Coverage | Flag | Primary Files | API Endpoints |
|---|---|---|---|---|
| Date-range fetch | Fetches logs by datetime interval | NEXT_PUBLIC_FEATURE_AUDIT | components/AuditLogsModule.tsx | GET /api/audit-logs/date-range?start=&end= |
| Search and filter | Client-side filtering by endpoint/user/payload fields | NEXT_PUBLIC_FEATURE_AUDIT | components/AuditLogsModule.tsx | N/A |
| Payload inspection | Expand rows to view request/response body with pretty parse | NEXT_PUBLIC_FEATURE_AUDIT | components/AuditLogsModule.tsx | N/A |

## 5) Domain Typing Coverage

| Area | Coverage | Primary Files |
|---|---|---|
| Typed models | Auth, user, role, product, variants, store, order, offers, report, substitution, reasons, audit | services/types.ts |

## 6) Infrastructure And Deployment

| Area | Coverage | Primary Files |
|---|---|---|
| AWS S3 hosting | Private bucket with versioning and restricted public access | infra/s3.tf |
| CloudFront CDN | OAC-backed S3 origin, TLS, compression, HTTPS redirect | infra/cloudfront.tf |
| ACM TLS | Certificate resources in us-east-1 for CloudFront | infra/acm.tf, infra/providers.tf |
| Environment vars | Project/env/domain/subdomain parametrization | infra/variables.tf, infra/locals.tf |
| Outputs | Site URL, CloudFront, bucket, cert and DNS validation output | infra/outputs.tf |

## 7) Feature Flags In Use

- NEXT_PUBLIC_FEATURE_DASHBOARD
- NEXT_PUBLIC_FEATURE_USERS
- NEXT_PUBLIC_FEATURE_ROLES
- NEXT_PUBLIC_FEATURE_BRANDS
- NEXT_PUBLIC_FEATURE_PRODUCTS
- NEXT_PUBLIC_FEATURE_STORES
- NEXT_PUBLIC_FEATURE_ORDERS
- NEXT_PUBLIC_FEATURE_COUPON
- NEXT_PUBLIC_FEATURE_TOP_PICKS
- NEXT_PUBLIC_FEATURE_ZONES
- NEXT_PUBLIC_FEATURE_REPORTS
- NEXT_PUBLIC_FEATURE_SUBSTITUTE
- NEXT_PUBLIC_FEATURE_REASONS
- NEXT_PUBLIC_FEATURE_AUDIT

## 8) Notes

- The project includes an empty file at services/auth.ts (no active implementation).
- README currently documents key runtime env vars and feature toggles.
- API endpoint contracts listed here are based on services/apiService.ts and services/deliveryZone.ts.
