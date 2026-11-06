-- CreateEnum
CREATE TYPE "CopilotMode" AS ENUM ('COPILOT', 'FULL_AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('WHATSAPP_CHAT', 'WHATSAPP_STATUS', 'WHATSAPP_CATALOG', 'INSTAGRAM_DM', 'WEB_STOREFRONT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'PROCESSING', 'OUT_FOR_DELIVERY', 'FULFILLED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FLAT_KOBO');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "whatsappPhone" TEXT NOT NULL,
    "whatsappPhoneId" TEXT,
    "wabaId" TEXT,
    "metaCatalogId" TEXT,
    "copilotMode" "CopilotMode" NOT NULL DEFAULT 'COPILOT',
    "copilotIdleSeconds" INTEGER NOT NULL DEFAULT 60,
    "reservationTtlMinutes" INTEGER NOT NULL DEFAULT 15,
    "settlementBankCode" TEXT,
    "settlementAccountNum" TEXT,
    "settlementAccountName" TEXT,
    "monnifySubAccountCode" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "kycIdentityHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "storefrontConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorConsent" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "consentType" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "channel" TEXT NOT NULL,
    "ipOrPhoneRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "skuCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "basePriceKobo" BIGINT NOT NULL,
    "compareAtKobo" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "primaryImageUrl" TEXT NOT NULL,
    "imageGallery" JSONB NOT NULL DEFAULT '[]',
    "imagePhash" TEXT,
    "stockTotal" INTEGER NOT NULL DEFAULT 0,
    "stockReserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "skuSuffix" TEXT NOT NULL,
    "priceKobo" BIGINT,
    "stockTotal" INTEGER NOT NULL DEFAULT 0,
    "stockReserved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "feeKobo" BIGINT NOT NULL,
    "estimatedDays" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" BIGINT NOT NULL,
    "minOrderKobo" BIGINT NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "whatsappPhone" TEXT NOT NULL,
    "name" TEXT,
    "defaultAddress" TEXT,
    "defaultZoneId" UUID,
    "totalOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpendKobo" BIGINT NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOrderAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "shortCode" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL DEFAULT 'WHATSAPP_CHAT',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalKobo" BIGINT NOT NULL,
    "shippingZoneId" UUID,
    "shippingFeeKobo" BIGINT NOT NULL DEFAULT 0,
    "discountId" UUID,
    "discountCode" TEXT,
    "discountAmountKobo" BIGINT NOT NULL DEFAULT 0,
    "totalAmountKobo" BIGINT NOT NULL,
    "amountPaidKobo" BIGINT NOT NULL DEFAULT 0,
    "overpaidAmountKobo" BIGINT NOT NULL DEFAULT 0,
    "reservationReleased" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAddress" TEXT,
    "riderName" TEXT,
    "riderPhone" TEXT,
    "paymentExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "productNameSnap" TEXT NOT NULL,
    "variantNameSnap" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceKobo" BIGINT NOT NULL,
    "lineTotalKobo" BIGINT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInvoice" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MONNIFY',
    "invoiceReference" TEXT NOT NULL,
    "expectedAmountKobo" BIGINT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "providerTransactionRef" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "amountPaidKobo" BIGINT NOT NULL,
    "settlementAmountKobo" BIGINT,
    "payerName" TEXT,
    "payerBankName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "webhookSignatureValid" BOOLEAN NOT NULL DEFAULT false,
    "serverVerifiedAt" TIMESTAMP(3) NOT NULL,
    "rawVerificationJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "buyerWhatsappPhone" TEXT NOT NULL,
    "copilotPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastVendorMessageAt" TIMESTAMP(3),
    "lastBuyerMessageAt" TIMESTAMP(3),
    "activeProductId" UUID,
    "conversationState" TEXT NOT NULL DEFAULT 'IDLE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceEvent" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_whatsappPhone_key" ON "Vendor"("whatsappPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_whatsappPhoneId_key" ON "Vendor"("whatsappPhoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_monnifySubAccountCode_key" ON "Vendor"("monnifySubAccountCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_kycIdentityHash_key" ON "Vendor"("kycIdentityHash");

-- CreateIndex
CREATE INDEX "Vendor_whatsappPhone_idx" ON "Vendor"("whatsappPhone");

-- CreateIndex
CREATE INDEX "VendorConsent_vendorId_consentType_idx" ON "VendorConsent"("vendorId", "consentType");

-- CreateIndex
CREATE INDEX "Product_vendorId_isActive_idx" ON "Product"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "Product_vendorId_imagePhash_idx" ON "Product"("vendorId", "imagePhash");

-- CreateIndex
CREATE UNIQUE INDEX "Product_vendorId_skuCode_key" ON "Product"("vendorId", "skuCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_skuSuffix_key" ON "ProductVariant"("productId", "skuSuffix");

-- CreateIndex
CREATE INDEX "ShippingZone_vendorId_isActive_idx" ON "ShippingZone"("vendorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZone_vendorId_name_key" ON "ShippingZone"("vendorId", "name");

-- CreateIndex
CREATE INDEX "Discount_vendorId_isActive_idx" ON "Discount"("vendorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_vendorId_code_key" ON "Discount"("vendorId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_vendorId_whatsappPhone_key" ON "Customer"("vendorId", "whatsappPhone");

-- CreateIndex
CREATE INDEX "Order_vendorId_status_createdAt_idx" ON "Order"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_vendorId_shortCode_key" ON "Order"("vendorId", "shortCode");

-- CreateIndex
CREATE INDEX "StockReservation_status_expiresAt_idx" ON "StockReservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInvoice_invoiceReference_key" ON "PaymentInvoice"("invoiceReference");

-- CreateIndex
CREATE INDEX "PaymentInvoice_accountNumber_status_idx" ON "PaymentInvoice"("accountNumber", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerTransactionRef_key" ON "PaymentTransaction"("providerTransactionRef");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_vendorId_buyerWhatsappPhone_key" ON "ChatSession"("vendorId", "buyerWhatsappPhone");

-- CreateIndex
CREATE INDEX "CommerceEvent_vendorId_eventType_createdAt_idx" ON "CommerceEvent"("vendorId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "VendorConsent" ADD CONSTRAINT "VendorConsent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingZone" ADD CONSTRAINT "ShippingZone_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingZoneId_fkey" FOREIGN KEY ("shippingZoneId") REFERENCES "ShippingZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInvoice" ADD CONSTRAINT "PaymentInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PaymentInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

