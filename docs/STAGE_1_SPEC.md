# Caterlog — Stage 1 Technical Specification & Database Schema

## 1. Stage 1 Scope & Architectural Guardrails

Stage 1 delivers the **Chat Commerce Core, Smart Co-Pilot Engine, Monnify Virtual Account Reconciliation, and Dual-Access Vendor Management (WhatsApp Keywords + Web Dashboard)**.

### Non-Negotiable Engineering Rules
1. **All Monetary Values in Kobo (`BIGINT` / `Int`):** Never store Naira as floating-point numbers. `₦25,000.00` is stored as `2500000` kobo to prevent rounding errors during discount and partial-payment calculations.
2. **Strict Headless Separation (Principle 10.1 & 10.3):** The `commerce-core` service layer knows nothing about WhatsApp message formatting or HTTP controllers. Both the **WhatsApp Keyword/Bot Adapter** and the **Web Dashboard API** call the exact same domain methods.
3. **Server-Verified State Transitions Only (Principle 10.2):** An order never transitions to `PAID` or `PARTIALLY_PAID` without an HMAC-verified Monnify webhook **plus** an independent server-to-server `GET /transactions/{ref}` confirmation call.
4. **Atomic Inventory & Configurable Time-Bound Reservations:** Generating a payment invoice atomically moves units from available stock into `stock_reserved` for `vendor.reservationTtlMinutes` (default `15` minutes, configurable per vendor via WhatsApp or Dashboard). Payment confirmation permanently decrements stock; expiry releases the lock automatically.
5. **Configurable Smart Co-Pilot Idle Timer:** By default, Co-Pilot waits `vendor.copilotIdleSeconds` (default `60` seconds, configurable per vendor via WhatsApp or Dashboard) for the vendor to reply from their phone before stepping in automatically.
6. **NDPR & Future Layer Readiness (Principle 10.5):** Consent tracking (`vendor_consents`) and an append-only event ledger (`commerce_events`) are included from Day 1 so Stage 2 (KYC), Stage 3 (Auto-Website), and Stage 6 (Financing Data) require zero destructive migrations.

---

## 2. Database Schema (PostgreSQL / Prisma)

See `packages/database/prisma/schema.prisma` for the live schema implementation.

| Table | Purpose |
| :--- | :--- |
| `Vendor` | Business profile, WhatsApp identifiers, Co-Pilot mode & idle timer (`default 60s`), stock reservation TTL (`default 15m`), Monnify subaccount, Stage 2 KYC state, Stage 3 theme JSON. |
| `VendorConsent` | Versioned NDPR consent records (`TERMS_AND_NDPR`, `KYC_VERIFICATION`, `LENDER_DATA_SHARING`). |
| `Product` & `ProductVariant` | SKU code, price in kobo, `stockTotal`, `stockReserved`, and `imagePhash` (64-bit perceptual hash for matching WhatsApp Status replies). |
| `ShippingZone` | Vendor-defined delivery zones & flat rates in kobo, indexed by 1-based short code for WhatsApp keyword management. |
| `Discount` | Percentage (basis points) or flat-kobo promo codes with usage caps and expiry windows. |
| `Customer` | Vendor-scoped buyer profile, default delivery address/zone, order count, and lifetime spend in kobo. |
| `Order` & `OrderItem` | Strict order state machine, financial breakdown (subtotal, shipping, discount, total, amount paid), channel of origin, and dispatch rider metadata. |
| `StockReservation` | Time-bound inventory locks (`ACTIVE`, `CONSUMED`, `RELEASED`) tied to pending orders. |
| `PaymentInvoice` & `PaymentTransaction` | Monnify dynamic 10-digit NUBAN virtual accounts and server-to-server verified payment records (idempotent by `providerTransactionRef`). |
| `ChatSession` | Tracks `lastVendorMessageAt` (via WhatsApp `message_echoes`) for Co-Pilot idle takeover and per-chat bot pause overrides. |
| `CommerceEvent` | Append-only audit & analytics ledger for transactional breakdowns and future Layer 6 underwriting signals. |

---

## 3. Dual-Access Vendor Command & API Mapping

| Domain Service Method | WhatsApp Keyword Syntax (Vendor Chat) | Web Dashboard Endpoint |
| :--- | :--- | :--- |
| `AuthService.createMagicLink(vendorId)` | `dashboard` or `login` | `POST /api/v1/auth/whatsapp-otp` |
| `AnalyticsService.getBreakdown(vendorId, range)` | `sales`, `sales today`, `sales week`, `sales month` | `GET /api/v1/vendor/analytics?range=...` |
| `CatalogService.upsertProduct(vendorId, dto)` | Send Photo + Caption: `Zara Heel, 25000, stock 5` | `POST /api/v1/vendor/products` |
| `CatalogService.updateStock(vendorId, sku, qty)` | `stock SHOE-01 10` *(or reply `stock 10` to photo)* | `PATCH /api/v1/vendor/products/:id/stock` |
| `ShippingService.upsertZone(vendorId, name, fee)` | `shipping add Lekki 3500` / `shipping` / `shipping delete 2` | `PUT /api/v1/vendor/shipping-zones` |
| `DiscountService.createPromo(vendorId, dto)` | `discount add PAYDAY 10%` / `discount end PAYDAY` | `POST /api/v1/vendor/discounts` |
| `OrderService.listByStatus(vendorId, status)` | `pending` / `paid` | `GET /api/v1/vendor/orders?status=...` |
| `OrderService.markDispatched(vendorId, code, rider)` | `dispatch ORD-882 08031112222` *(or tap `[Mark Dispatched]`)* | `POST /api/v1/vendor/orders/:id/dispatch` |
| `CopilotService.updateSettings(vendorId, dto)` | `mode copilot` / `mode copilot 90s` / `mode auto` / `mode off` | `PATCH /api/v1/vendor/settings/copilot` |
| `SettingsService.setReservationTtl(vendorId, mins)` | `hold 20` *(sets stock reservation timer to 20 mins; default 15m)* | `PATCH /api/v1/vendor/settings/reservation-ttl` |

