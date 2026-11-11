import {
  prisma,
  CopilotMode,
  VerificationStatus,
  DiscountType,
  SalesChannel,
  OrderStatus,
  nairaToKobo,
} from "./index.js";

async function main() {
  console.log("🌱 Seeding Caterlog Stage 1 database...");

  // 1. Upsert Demo Nigerian Vendor: Amaka Luxury Shoes (Lagos)
  const vendor = await prisma.vendor.upsert({
    where: { slug: "amaka-shoes" },
    update: {},
    create: {
      slug: "amaka-shoes",
      businessName: "Amaka Luxury Shoes",
      whatsappPhone: "+2348031234567",
      whatsappPhoneId: "105992837465001",
      wabaId: "waba_amaka_001",
      copilotMode: CopilotMode.FULL_AUTO,
      copilotIdleSeconds: 60,      // Configurable default: 60s
      reservationTtlMinutes: 15,   // Configurable default: 15 mins
      settlementBankCode: "058",   // GTBank
      settlementAccountNum: "0123456789",
      settlementAccountName: "AMAKA LUXURY ENTERPRISES",
      monnifySubAccountCode: "MFY_SUB_AMAKA_001",
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  // 2. Record NDPR Consent from Day 1
  await prisma.vendorConsent.create({
    data: {
      vendorId: vendor.id,
      consentType: "TERMS_AND_NDPR",
      policyVersion: "v1.0",
      granted: true,
      channel: "WHATSAPP",
      ipOrPhoneRef: vendor.whatsappPhone,
    },
  });

  // 3. Seed Shipping Zones (Lagos Mainland, Island/Lekki, Interstate, Pickup)
  const shippingZonesData = [
    { code: 1, name: "Mainland", feeKobo: nairaToKobo(2500), estimatedDays: "Same day" },
    { code: 2, name: "Lekki", feeKobo: nairaToKobo(3500), estimatedDays: "Same day" },
    { code: 3, name: "Abuja / Interstate", feeKobo: nairaToKobo(5000), estimatedDays: "2-3 days" },
    { code: 4, name: "Pickup (Yaba Store)", feeKobo: nairaToKobo(0), estimatedDays: "Ready in 1 hr" },
  ];

  for (const zone of shippingZonesData) {
    await prisma.shippingZone.upsert({
      where: { vendorId_name: { vendorId: vendor.id, name: zone.name } },
      update: { code: zone.code, feeKobo: zone.feeKobo, estimatedDays: zone.estimatedDays, isActive: true },
      create: { vendorId: vendor.id, ...zone },
    });
  }

  // 4. Seed Discounts (PAYDAY 10% and VIP ₦5,000 flat)
  await prisma.discount.upsert({
    where: { vendorId_code: { vendorId: vendor.id, code: "PAYDAY" } },
    update: {},
    create: {
      vendorId: vendor.id,
      code: "PAYDAY",
      type: DiscountType.PERCENTAGE,
      value: 1000n, // 10.00%
      minOrderKobo: nairaToKobo(20000),
      maxUses: 50,
      usedCount: 4,
    },
  });

  await prisma.discount.upsert({
    where: { vendorId_code: { vendorId: vendor.id, code: "VIP5000" } },
    update: {},
    create: {
      vendorId: vendor.id,
      code: "VIP5000",
      type: DiscountType.FLAT_KOBO,
      value: nairaToKobo(5000),
      minOrderKobo: nairaToKobo(40000),
      maxUses: 20,
      usedCount: 1,
    },
  });

  // 5. Seed Catalog Products with Perceptual Image Hashes (`imagePhash`) for WhatsApp Status matching
  const productsData = [
    {
      skuCode: "SHOE-01",
      name: "Zara Block Heel (Gold)",
      description: "Imported gold strap block heel, sizes 38-41 available.",
      category: "fashion",
      basePriceKobo: nairaToKobo(25000),
      compareAtKobo: nairaToKobo(30000),
      primaryImageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80",
      imagePhash: "f8c39a71b2e409d1",
      stockTotal: 5,
      stockReserved: 1,
    },
    {
      skuCode: "SHOE-02",
      name: "Hermes Oran Leather Slide",
      description: "Classic tan flat leather sandal for everyday luxury.",
      category: "fashion",
      basePriceKobo: nairaToKobo(18500),
      compareAtKobo: null,
      primaryImageUrl: "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=800&q=80",
      imagePhash: "a1b2c3d4e5f60718",
      stockTotal: 8,
      stockReserved: 0,
    },
    {
      skuCode: "BAG-01",
      name: "Jacquemus Le Chiquito Mini Bag",
      description: "Structured mini top-handle bag with gold hardware.",
      category: "fashion",
      basePriceKobo: nairaToKobo(42000),
      compareAtKobo: nairaToKobo(48000),
      primaryImageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80",
      imagePhash: "9988776655443322",
      stockTotal: 3,
      stockReserved: 0,
    },
  ];

  const createdProducts = [];
  for (const prod of productsData) {
    const record = await prisma.product.upsert({
      where: { vendorId_skuCode: { vendorId: vendor.id, skuCode: prod.skuCode } },
      update: {
        stockTotal: prod.stockTotal,
        stockReserved: prod.stockReserved,
        basePriceKobo: prod.basePriceKobo,
      },
      create: { vendorId: vendor.id, ...prod },
    });
    createdProducts.push(record);
  }

  // 6. Seed Sample Customer & Active Pending Order (with 15m Monnify Virtual Account)
  const lekkiZone = await prisma.shippingZone.findUniqueOrThrow({
    where: { vendorId_name: { vendorId: vendor.id, name: "Lekki" } },
  });

  const customer = await prisma.customer.upsert({
    where: { vendorId_whatsappPhone: { vendorId: vendor.id, whatsappPhone: "+2348099887766" } },
    update: {},
    create: {
      vendorId: vendor.id,
      whatsappPhone: "+2348099887766",
      name: "Chidinma Okafor",
      defaultAddress: "14 Admiralty Way, Lekki Phase 1, Lagos",
      defaultZoneId: lekkiZone.id,
      totalOrdersCount: 1,
      lifetimeSpendKobo: nairaToKobo(21000),
    },
  });

  const expiresAt = new Date(Date.now() + vendor.reservationTtlMinutes * 60 * 1000);
  const zaraHeel = createdProducts[0]!;

  const pendingOrder = await prisma.order.upsert({
    where: { vendorId_shortCode: { vendorId: vendor.id, shortCode: "ORD-882" } },
    update: { paymentExpiresAt: expiresAt },
    create: {
      vendorId: vendor.id,
      customerId: customer.id,
      shortCode: "ORD-882",
      channel: SalesChannel.WHATSAPP_STATUS,
      status: OrderStatus.PENDING_PAYMENT,
      subtotalKobo: nairaToKobo(25000),
      shippingZoneId: lekkiZone.id,
      shippingFeeKobo: lekkiZone.feeKobo,
      totalAmountKobo: nairaToKobo(28500),
      amountPaidKobo: 0n,
      deliveryAddress: customer.defaultAddress,
      paymentExpiresAt: expiresAt,
      items: {
        create: {
          productId: zaraHeel.id,
          productNameSnap: zaraHeel.name,
          quantity: 1,
          unitPriceKobo: zaraHeel.basePriceKobo,
          lineTotalKobo: zaraHeel.basePriceKobo,
        },
      },
      reservations: {
        create: {
          productId: zaraHeel.id,
          quantity: 1,
          status: "ACTIVE",
          expiresAt,
        },
      },
      invoices: {
        create: {
          provider: "MONNIFY",
          invoiceReference: "CAT_INV_882_SEED",
          expectedAmountKobo: nairaToKobo(28500),
          accountNumber: "8092341102",
          bankName: "Moniepoint MFB",
          accountName: "CATERLOG / AMAKA LUXURY SHOES",
          status: "ACTIVE",
          expiresAt,
        },
      },
    },
  });

  console.log(`✅ Seeded vendor "${vendor.businessName}" (${vendor.whatsappPhone})`);
  console.log(`✅ Seeded ${createdProducts.length} products, ${shippingZonesData.length} shipping zones, 2 discounts`);
  console.log(`✅ Seeded active pending order ${pendingOrder.shortCode} (NUBAN: 8092341102, Total: ₦28,500)`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

