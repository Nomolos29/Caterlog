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
    update: {
      settlementBankCode: "058",
      settlementBankName: "GTBank",
      settlementAccountNum: "0123456789",
      settlementAccountName: "AMAKA LUXURY ENTERPRISES",
      monnifySubAccountCode: "MFY_SUB_AMAKA_001",
      cacNumber: "RC-1849204",
      tinNumber: "24910293-0001",
      instagramHandle: "@amakaluxuryshoes",
      baseState: "Lagos",
      baseCity: "Lekki Phase 1",
    },
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
      settlementBankName: "GTBank",
      settlementAccountNum: "0123456789",
      settlementAccountName: "AMAKA LUXURY ENTERPRISES",
      monnifySubAccountCode: "MFY_SUB_AMAKA_001",
      cacNumber: "RC-1849204",
      tinNumber: "24910293-0001",
      instagramHandle: "@amakaluxuryshoes",
      baseState: "Lagos",
      baseCity: "Lekki Phase 1",
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

  // 7. Seed Product Variants for SHOE-01
  for (const [suffix, label, stock] of [
    ["38-GLD", "Size 38 / Gold", 2],
    ["39-GLD", "Size 39 / Gold", 2],
    ["40-GLD", "Size 40 / Gold", 1],
  ] as const) {
    await prisma.productVariant.upsert({
      where: {
        productId_skuSuffix: {
          productId: zaraHeel.id,
          skuSuffix: suffix,
        },
      },
      update: { stockTotal: stock },
      create: {
        productId: zaraHeel.id,
        name: label,
        skuSuffix: suffix,
        priceKobo: zaraHeel.basePriceKobo,
        stockTotal: stock,
        stockReserved: suffix === "39-GLD" ? 1 : 0,
      },
    });
  }

  // 8. Seed Paid Order ORD-881 + PaymentInvoice + PaymentTransaction
  const mainlandZone = await prisma.shippingZone.findUniqueOrThrow({
    where: { vendorId_name: { vendorId: vendor.id, name: "Mainland" } },
  });
  const hermesSlide = createdProducts[1]!;

  const paidOrder = await prisma.order.upsert({
    where: { vendorId_shortCode: { vendorId: vendor.id, shortCode: "ORD-881" } },
    update: {},
    create: {
      vendorId: vendor.id,
      customerId: customer.id,
      shortCode: "ORD-881",
      channel: SalesChannel.WHATSAPP_CHAT,
      status: OrderStatus.PAID,
      subtotalKobo: nairaToKobo(18500),
      shippingZoneId: mainlandZone.id,
      shippingFeeKobo: mainlandZone.feeKobo,
      totalAmountKobo: nairaToKobo(21000),
      amountPaidKobo: nairaToKobo(21000),
      deliveryAddress: "22 Allen Avenue, Ikeja, Lagos",
      deliveryLandmark: "Opposite Alade Market Gate",
      alternatePhone: "+2348022334455",
      paymentTransactionRef: "MNFY|SEED|ORD881|001",
      paidAt: new Date(Date.now() - 40 * 60 * 1000),
      paymentExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      items: {
        create: {
          productId: hermesSlide.id,
          productNameSnap: hermesSlide.name,
          quantity: 1,
          unitPriceKobo: hermesSlide.basePriceKobo,
          lineTotalKobo: hermesSlide.basePriceKobo,
        },
      },
    },
  });

  const paidInvoice = await prisma.paymentInvoice.upsert({
    where: { invoiceReference: "CAT_INV_881_SEED" },
    update: {},
    create: {
      orderId: paidOrder.id,
      provider: "MONNIFY",
      invoiceReference: "CAT_INV_881_SEED",
      expectedAmountKobo: nairaToKobo(21000),
      accountNumber: "8044556677",
      bankName: "Moniepoint MFB",
      accountName: "CATERLOG / AMAKA LUXURY SHOES",
      status: "PAID",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await prisma.paymentTransaction.upsert({
    where: { providerTransactionRef: "MNFY|SEED|ORD881|001" },
    update: {},
    create: {
      invoiceId: paidInvoice.id,
      providerTransactionRef: "MNFY|SEED|ORD881|001",
      paymentReference: "CAT_INV_881_SEED",
      amountPaidKobo: nairaToKobo(21000),
      settlementAmountKobo: nairaToKobo(20685),
      payerName: "Chidinma Okafor",
      payerBankName: "GTBank",
      paymentMethod: "ACCOUNT_TRANSFER",
      webhookSignatureValid: true,
      serverVerifiedAt: new Date(),
      rawVerificationJson: { paymentStatus: "PAID", seed: true },
    },
  });

  // 9. Seed ChatSession & ChatMessage thread
  const chatSession = await prisma.chatSession.upsert({
    where: {
      vendorId_buyerWhatsappPhone: {
        vendorId: vendor.id,
        buyerWhatsappPhone: customer.whatsappPhone,
      },
    },
    update: { buyerName: customer.name },
    create: {
      vendorId: vendor.id,
      buyerWhatsappPhone: customer.whatsappPhone,
      buyerName: customer.name,
      activeProductId: zaraHeel.id,
      activeOrderId: pendingOrder.id,
      quantity: 1,
      conversationState: "AWAITING_PAYMENT",
      lastBuyerMessageAt: new Date(),
    },
  });

  const existingMsgCount = await prisma.chatMessage.count({ where: { vendorId: vendor.id } });
  if (existingMsgCount === 0) {
    await prisma.chatMessage.createMany({
      data: [
        {
          vendorId: vendor.id,
          chatSessionId: chatSession.id,
          channel: "BUYER_SHOP_WA",
          sender: "BUYER",
          fromPhone: customer.whatsappPhone,
          text: "Hi Amaka! Do you still have Zara Block Heel (Gold) in Size 39?",
        },
        {
          vendorId: vendor.id,
          chatSessionId: chatSession.id,
          channel: "BUYER_SHOP_WA",
          sender: "CATERLOG_BOT",
          fromPhone: vendor.whatsappPhone,
          text: "✅ Yes! Zara Block Heel (Gold) is in stock (₦25,000). Reserved 1 unit under ORD-882 with dedicated Moniepoint account 8092341102.",
        },
      ],
    });
  }

  // 10. Seed CommerceEvent & MediaAsset
  const existingEvents = await prisma.commerceEvent.count({ where: { vendorId: vendor.id } });
  if (existingEvents === 0) {
    await prisma.commerceEvent.create({
      data: {
        vendorId: vendor.id,
        eventType: "ORDER_CREATED",
        actorType: "COPILOT_AUTO",
        entityType: "ORDER",
        entityId: pendingOrder.id,
        payload: { shortCode: pendingOrder.shortCode, totalKobo: "2850000" },
      },
    });
  }

  await prisma.mediaAsset.upsert({
    where: { mediaId: "media-seed-shoe-01" },
    update: {},
    create: {
      mediaId: "media-seed-shoe-01",
      vendorId: vendor.id,
      storageKey: "media/media-seed-shoe-01.jpg",
      bucket: "assets",
      contentType: "image/jpeg",
      sizeBytes: 48210,
      phash: zaraHeel.imagePhash ?? "f8c39a71b2e409d1",
      publicUrl: zaraHeel.primaryImageUrl,
    },
  });

  // 11. Seed MarketBoostListing (Geographic Visibility & Interstate Coverage)
  await prisma.marketBoostListing.upsert({
    where: { vendorId: vendor.id },
    update: {},
    create: {
      vendorId: vendor.id,
      isPublished: true,
      businessName: vendor.businessName,
      category: "Fashion & Footwear",
      baseState: "Lagos",
      baseCity: "Lekki Phase 1",
      shippingScope: "SELECTED_STATES",
      allowInterstate: true,
      coveredStates: ["Lagos", "Ogun", "Oyo", "FCT - Abuja", "Rivers"],
      description:
        "Imported luxury heels, leather slides, and structured mini bags with live WhatsApp inventory reservation.",
      moq: "1 unit",
      startingPriceKobo: nairaToKobo(18500),
      fulfillmentMethod: "Same-day Lagos dispatch & 48h DHL interstate",
      deliveryNote: "Verified escrow split via Monnify upon buyer transfer.",
      featuredTags: ["Footwear", "Luxury Slides", "Mini Bags"],
      subscriptionPlan: "GROWTH",
    },
  });

  // 12. Seed Wholesale SupplierProfile & ResellerCatalogMirror
  const supplier = await prisma.supplierProfile.upsert({
    where: { slug: "aroko-wholesale" },
    update: {},
    create: {
      slug: "aroko-wholesale",
      name: "Aroko Wholesale",
      verified: true,
      cacNumber: "RC-1928401",
      category: "Kitchenware & Home Living",
      location: "Lagos, Nigeria",
      state: "Lagos",
      shippingScope: "LOCAL_STATE",
      allowInterstate: false,
      coveredStates: ["Lagos"],
      warehouseAddress:
        "Warehouse 3B, International Trade Fair Complex, Badagry Expressway, Lagos",
      phone: "+2348028881920",
      whatsapp: "2348028881920",
      rating: 4.9,
      totalFulfilled: 1420,
      subAccountCode: "SUB-AW-001",
      leadTime: "Same day dispatch if ordered before 1:00 PM",
      cutoffTime: "1:00 PM WAT daily",
      wholesaleTerms: {
        moqDropship: 1,
        moqWholesale: 5,
        settlementTerms: "Instant escrow split via Monnify",
        suggestedMargin: "25% - 35%",
      },
      catalogProducts: [
        {
          sku: "AW-FL750",
          name: "Stainless Steel Vacuum Flask · 750ml",
          wholesaleCost: 8000,
          suggestedRetail: 10000,
          stock: 42,
        },
      ],
    },
  });

  await prisma.resellerCatalogMirror.upsert({
    where: {
      resellerVendorId_supplierId: {
        resellerVendorId: vendor.id,
        supplierId: supplier.id,
      },
    },
    update: {},
    create: {
      resellerVendorId: vendor.id,
      supplierId: supplier.id,
      mirroredProductSkus: ["AW-FL750"],
      defaultMarkupBps: 2500,
      status: "ACTIVE",
    },
  });

  // 13. Seed PaymentLink, PayoutWithdrawal, SettlementSplitRule
  await prisma.paymentLink.upsert({
    where: { slug: "amaka-shoes-vip-checkout" },
    update: {},
    create: {
      vendorId: vendor.id,
      slug: "amaka-shoes-vip-checkout",
      customerName: "Chidinma Okafor",
      customerPhone: customer.whatsappPhone,
      productSku: "SHOE-01",
      description: "Express checkout link for Zara Block Heel (Gold)",
      amountKobo: nairaToKobo(25000),
      checkoutUrl: "https://caterlog.store/pay/amaka-shoes?amt=25000",
      isActive: true,
      timesUsed: 1,
    },
  });

  await prisma.payoutWithdrawal.upsert({
    where: { reference: "WTH-881001" },
    update: {},
    create: {
      vendorId: vendor.id,
      reference: "WTH-881001",
      amountKobo: nairaToKobo(50000),
      feeKobo: nairaToKobo(100),
      netAmountKobo: nairaToKobo(49900),
      bankCode: "058",
      bankName: "GTBank",
      accountNumber: "0123456789",
      accountName: "AMAKA LUXURY ENTERPRISES",
      status: "SETTLED",
      verifiedByOtp: true,
      settledAt: new Date(),
    },
  });

  const existingSplitRules = await prisma.settlementSplitRule.count({
    where: { vendorId: vendor.id },
  });
  if (existingSplitRules === 0) {
    await prisma.settlementSplitRule.create({
      data: {
        vendorId: vendor.id,
        name: "Default Wholesale Dropship Split (80/18.5/1.5)",
        supplierSubAccountCode: "SUB-AW-001",
        supplierShareBps: 8000,
        resellerShareBps: 1850,
        platformFeeBps: 150,
        isActive: true,
      },
    });
  }

  // 14. Seed VendorKycSubmission, TeamMember & VendorNotification
  const existingKyc = await prisma.vendorKycSubmission.count({ where: { vendorId: vendor.id } });
  if (existingKyc === 0) {
    await prisma.vendorKycSubmission.create({
      data: {
        vendorId: vendor.id,
        businessName: vendor.businessName,
        cacNumber: "RC-1849204",
        tinNumber: "24910293-0001",
        businessAddress: "14 Admiralty Way, Lekki Phase 1, Lagos",
        businessCategory: "Fashion & Footwear",
        bankCode: "058",
        bankName: "GTBank",
        accountNumber: "0123456789",
        resolvedAccountName: "AMAKA LUXURY ENTERPRISES",
        whatsappPhone: vendor.whatsappPhone,
        instagramHandle: "@amakaluxuryshoes",
        status: VerificationStatus.VERIFIED,
        reviewedAt: new Date(),
      },
    });
  }

  await prisma.teamMember.upsert({
    where: {
      vendorId_email: {
        vendorId: vendor.id,
        email: "owner@amakaluxury.ng",
      },
    },
    update: {},
    create: {
      vendorId: vendor.id,
      name: "Amaka Nwosu (Owner)",
      email: "owner@amakaluxury.ng",
      phone: vendor.whatsappPhone,
      role: "Owner",
      status: "Active",
      canManageOrders: true,
      canManageInventory: true,
      canViewPayouts: true,
      canProcessRefunds: true,
      canOverrideCopilot: true,
      lastActiveAt: new Date(),
    },
  });

  await prisma.vendorNotification.upsert({
    where: {
      vendorId_notificationKey: {
        vendorId: vendor.id,
        notificationKey: "notif-paid-ORD-881",
      },
    },
    update: {},
    create: {
      vendorId: vendor.id,
      notificationKey: "notif-paid-ORD-881",
      title: "Payment Verified: ORD-881",
      message:
        "Monnify verified ₦21,000 transfer from Chidinma Okafor. Escrow split allocated.",
      category: "PAYOUTS",
      isRead: false,
      linkText: "View Settlement",
      targetView: "payments",
      targetRef: "ORD-881",
    },
  });

  console.log("✅ Seeded all extended tables (Variants, Paid Order, Chat, Media, MarketBoost, Supplier Network, PaymentLinks, Payouts, KYC, Team, Notifications)");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

