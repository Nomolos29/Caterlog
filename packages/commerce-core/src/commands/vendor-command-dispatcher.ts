import type { PrismaClient } from "@caterlog/database";
import { formatNaira } from "../domain/money.ts";
import {
  parseVendorWhatsAppCommand,
  type VendorWhatsAppCommand,
} from "./whatsapp-keyword-parser.ts";
import type { AnalyticsSettingsService } from "../services/analytics-settings.service.ts";
import type { CatalogService } from "../services/catalog.service.ts";
import type { OrderPaymentService } from "../services/order-payment.service.ts";
import type { ShippingDiscountService } from "../services/shipping-discount.service.ts";
import type { MessagingChannelPort } from "../ports/index.ts";

export interface DispatchedCommandResult {
  parsedCommand: VendorWhatsAppCommand;
  whatsappReplyText: string;
}

/**
 * Executes a Vendor WhatsApp Keyword command against the exact same headless services
 * used by the Web Dashboard REST API (Principle 10.3).
 */
export class VendorCommandDispatcher {
  private readonly db: PrismaClient;
  private readonly catalogService: CatalogService;
  private readonly shippingDiscountService: ShippingDiscountService;
  private readonly orderPaymentService: OrderPaymentService;
  private readonly analyticsSettingsService: AnalyticsSettingsService;
  private readonly messagingPort: MessagingChannelPort;
  private readonly createMagicDashboardUrl: (vendorId: string) => Promise<string>;

  constructor(
    db: PrismaClient,
    catalogService: CatalogService,
    shippingDiscountService: ShippingDiscountService,
    orderPaymentService: OrderPaymentService,
    analyticsSettingsService: AnalyticsSettingsService,
    messagingPort: MessagingChannelPort,
    createMagicDashboardUrl: (vendorId: string) => Promise<string>
  ) {
    this.db = db;
    this.catalogService = catalogService;
    this.shippingDiscountService = shippingDiscountService;
    this.orderPaymentService = orderPaymentService;
    this.analyticsSettingsService = analyticsSettingsService;
    this.messagingPort = messagingPort;
    this.createMagicDashboardUrl = createMagicDashboardUrl;
  }

  public async executeRawTextCommand(params: {
    vendorId: string;
    rawText: string;
    attachedImageUrl?: string;
    attachedImagePhash?: string;
  }): Promise<DispatchedCommandResult> {
    const cmd = parseVendorWhatsAppCommand(params.rawText);
    const actor = "VENDOR_WA_KEYWORD" as const;

    switch (cmd.type) {
      case "OPEN_DASHBOARD": {
        const magicUrl = await this.createMagicDashboardUrl(params.vendorId);
        return {
          parsedCommand: cmd,
          whatsappReplyText: `🔐 *Your 1-Tap Dashboard Login Link:*\n${magicUrl}\n\n⏳ _Valid for 15 minutes. Do not share this link._`,
        };
      }

      case "HELP_MENU": {
        return {
          parsedCommand: cmd,
          whatsappReplyText: [
            "🛠️ *Caterlog Vendor Command Menu*",
            "• *products* / *catalog* — List all products & stock",
            "• *sales* / *sales week* / *sales month* — Revenue breakdown",
            "• *pending* / *paid* — View active transfers & paid orders",
            "• *dispatch ORD-882 0803...* — Mark order out for delivery",
            "• *shipping* / *ship Ibadan #6000* / *shipping delete 2*",
            "• *discount* / *discount add PAYDAY 10%* / *discount end PAYDAY*",
            "• *stock SHOE-01 10* — Update inventory count",
            "• *mode copilot 60s* / *mode auto* / *mode off* — Co-Pilot switch",
            "• *hold 15* — Set buyer transfer reservation window (mins)",
            "• *dashboard* — Get 1-tap login link to Web Dashboard",
          ].join("\n"),
        };
      }

      case "LIST_PRODUCTS": {
        const products = await this.catalogService.listProducts(params.vendorId);
        if (products.length === 0) {
          return {
            parsedCommand: cmd,
            whatsappReplyText:
              "📦 Your catalog is empty. Send a photo with caption *Name, #Price, stock Qty* to add an item.",
          };
        }
        const lines = products.map((p) => {
          const avail = Math.max(0, p.stockTotal - p.stockReserved);
          return `• *${p.skuCode}* — ${p.name}: *${formatNaira(p.basePriceKobo)}* (${avail} avail, ${p.stockReserved} locked)`;
        });
        return {
          parsedCommand: cmd,
          whatsappReplyText: `📦 *Your Catalog (${products.length} items):*\n${lines.join("\n")}`,
        };
      }

      case "SALES_SUMMARY": {
        const summary = await this.analyticsSettingsService.getTransactionalBreakdown(
          params.vendorId,
          cmd.range
        );
        const label =
          cmd.range === "today" ? "Today" : cmd.range === "week" ? "Last 7 Days" : "Last 30 Days";
        return {
          parsedCommand: cmd,
          whatsappReplyText: [
            `📊 *Transactional Breakdown (${label})*`,
            `• Paid Orders: *${summary.paidOrdersCount} (${formatNaira(summary.paidGrossKobo)})*`,
            `• Pending Transfers: *${summary.pendingOrdersCount} (${formatNaira(summary.pendingAmountKobo)})*`,
            `• Shipping Collected: *${formatNaira(summary.shippingCollectedKobo)}*`,
            `• Discounts Given: *${formatNaira(summary.discountsGivenKobo)}*`,
            `• Net Product Revenue: *${formatNaira(summary.netProductRevenueKobo)}*`,
          ].join("\n"),
        };
      }

      case "LIST_SHIPPING": {
        const zones = await this.shippingDiscountService.listShippingZones(params.vendorId);
        if (zones.length === 0) {
          return {
            parsedCommand: cmd,
            whatsappReplyText:
              "🚚 No delivery zones configured yet.\nReply *shipping add Lekki 3500* to add one.",
          };
        }
        const lines = zones.map((z) => `${z.code}. ${z.name}: *${formatNaira(z.feeKobo)}*`);
        return {
          parsedCommand: cmd,
          whatsappReplyText: `🚚 *Your Delivery Zones:*\n${lines.join("\n")}\n\n_Reply "shipping add <Zone> <Amount>" or "shipping delete <No>"_`,
        };
      }

      case "UPSERT_SHIPPING": {
        const zone = await this.shippingDiscountService.upsertShippingZone(
          params.vendorId,
          cmd.name,
          cmd.feeKobo,
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: `✅ *Shipping Zone Updated:*\n#${zone.code} *${zone.name}* → *${formatNaira(zone.feeKobo)}*`,
        };
      }

      case "DELETE_SHIPPING": {
        const deleted = await this.shippingDiscountService.deleteShippingZoneByCode(
          params.vendorId,
          cmd.code,
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: deleted
            ? `🗑️ Removed delivery zone #${deleted.code} (*${deleted.name}*).`
            : `⚠️ Delivery zone #${cmd.code} not found.`,
        };
      }

      case "LIST_DISCOUNTS": {
        const discounts = await this.shippingDiscountService.listDiscounts(params.vendorId);
        if (discounts.length === 0) {
          return {
            parsedCommand: cmd,
            whatsappReplyText:
              "🏷️ No active discount codes.\nReply *discount add PAYDAY 10%* or *discount add VIP 5000* to create one.",
          };
        }
        const lines = discounts.map((d) => {
          const valStr =
            d.type === "PERCENTAGE"
              ? `${Number(d.value) / 100}% off`
              : `${formatNaira(d.value)} off`;
          return `• *${d.code}* — ${valStr} (${d.usedCount}${d.maxUses ? `/${d.maxUses}` : ""} used)`;
        });
        return {
          parsedCommand: cmd,
          whatsappReplyText: `🏷️ *Active Discount Codes:*\n${lines.join("\n")}`,
        };
      }

      case "CREATE_DISCOUNT": {
        const discount = await this.shippingDiscountService.upsertDiscount(
          params.vendorId,
          {
            code: cmd.code,
            type: cmd.discountType,
            value: cmd.value,
          },
          actor
        );
        const label =
          discount.type === "PERCENTAGE"
            ? `${Number(discount.value) / 100}% off`
            : `${formatNaira(discount.value)} off`;
        return {
          parsedCommand: cmd,
          whatsappReplyText: `✅ *Discount Code Active:* *${discount.code}* (${label})`,
        };
      }

      case "DEACTIVATE_DISCOUNT": {
        const deactivated = await this.shippingDiscountService.deactivateDiscount(
          params.vendorId,
          cmd.code,
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: deactivated
            ? `🛑 Discount code *${deactivated.code}* has been deactivated.`
            : `⚠️ Discount code *${cmd.code}* not found.`,
        };
      }

      case "UPDATE_STOCK": {
        const product = await this.catalogService.updateStock(
          params.vendorId,
          cmd.skuCode,
          cmd.stockTotal,
          actor
        );
        const available = Math.max(0, product.stockTotal - product.stockReserved);
        return {
          parsedCommand: cmd,
          whatsappReplyText: `📦 *Inventory Updated:*\n*${product.name}* (${product.skuCode})\nTotal Stock: *${product.stockTotal}* (${available} available, ${product.stockReserved} reserved)`,
        };
      }

      case "QUICK_ADD_PRODUCT": {
        const product = await this.catalogService.upsertProduct(
          params.vendorId,
          {
            name: cmd.name,
            basePriceKobo: cmd.priceKobo,
            stockTotal: cmd.stockTotal,
            primaryImageUrl: params.attachedImageUrl,
            imagePhash: params.attachedImagePhash,
          },
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: `✅ *Product Saved to Catalog:*\n📦 *${product.name}*\n🏷️ SKU: *${product.skuCode}*\n💰 Price: *${formatNaira(product.basePriceKobo)}*\n🔢 Stock: *${product.stockTotal}*`,
        };
      }

      case "DELETE_PRODUCT": {
        const deleted = await this.catalogService.deleteProduct(
          params.vendorId,
          cmd.skuCode,
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: deleted
            ? `🗑️ *Product Deleted:* \`${cmd.skuCode}\` has been removed from your store and WhatsApp catalog.`
            : `⚠️ Product with SKU \`${cmd.skuCode}\` was not found.`,
        };
      }

      case "LIST_ORDERS": {
        const orders = await this.orderPaymentService.listOrdersByStatus(
          params.vendorId,
          cmd.status
        );
        if (orders.length === 0) {
          return {
            parsedCommand: cmd,
            whatsappReplyText:
              cmd.status === "PENDING_PAYMENT"
                ? "🟡 No pending bank transfers right now."
                : "🟢 No paid orders awaiting dispatch.",
          };
        }
        const header =
          cmd.status === "PENDING_PAYMENT"
            ? `🟡 *${orders.length} Pending Transfer(s):*`
            : `🟢 *${orders.length} Paid Order(s) Ready to Pack:*`;
        const lines = orders.slice(0, 10).map((o) => {
          const itemSummary = o.items.map((i) => `${i.productNameSnap} x${i.quantity}`).join(", ");
          return `• *${o.shortCode}* — ${o.customer.name ?? o.customer.whatsappPhone} (${itemSummary}) — *${formatNaira(o.totalAmountKobo)}*`;
        });
        return {
          parsedCommand: cmd,
          whatsappReplyText: `${header}\n${lines.join("\n")}`,
        };
      }

      case "DISPATCH_ORDER": {
        const updated = await this.orderPaymentService.markOrderDispatched(
          params.vendorId,
          cmd.shortCode,
          cmd.riderPhone,
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: `🚚 Order *${updated.shortCode}* marked Out for Delivery! Buyer has been notified on WhatsApp.`,
        };
      }

      case "REMIND_ORDER": {
        const order = await this.db.order.findUnique({
          where: {
            vendorId_shortCode: { vendorId: params.vendorId, shortCode: cmd.shortCode },
          },
          include: { customer: true, invoices: true, vendor: true },
        });
        if (!order) {
          return {
            parsedCommand: cmd,
            whatsappReplyText: `⚠️ Order *${cmd.shortCode}* not found.`,
          };
        }

        if (order.status !== "PENDING_PAYMENT" && order.status !== "PARTIALLY_PAID") {
          return {
            parsedCommand: cmd,
            whatsappReplyText: `ℹ️ Order *${order.shortCode}* is already *${order.status}* — no payment reminder is needed.`,
          };
        }

        const inv = order.invoices.find((invoice) => invoice.status === "ACTIVE") ?? order.invoices[0];
        const balanceKobo =
          order.totalAmountKobo > order.amountPaidKobo
            ? order.totalAmountKobo - order.amountPaidKobo
            : 0n;

        await this.messagingPort.sendTextMessage({
          toPhone: order.customer.whatsappPhone,
          vendorPhoneId: order.vendor.whatsappPhoneId,
          text: [
            `⏰ *Payment Reminder — ${order.shortCode}*`,
            `🏪 ${order.vendor.businessName}`,
            `💰 Amount due: *${formatNaira(balanceKobo)}*`,
            inv
              ? `🏦 ${inv.bankName} • Account: *${inv.accountNumber}*\n👤 ${inv.accountName}`
              : "",
            `\n_Your reserved item is released automatically if payment is not completed before the hold expires._`,
          ]
            .filter(Boolean)
            .join("\n"),
        });

        return {
          parsedCommand: cmd,
          whatsappReplyText: `🔔 Payment reminder sent to *${order.customer.whatsappPhone}* for *${order.shortCode}* (${formatNaira(balanceKobo)} due${inv ? ` • ${inv.bankName} ${inv.accountNumber}` : ""}).`,
        };
      }

      case "SET_COPILOT_MODE": {
        const vendor = await this.analyticsSettingsService.updateCopilotSettings(
          params.vendorId,
          { mode: cmd.mode, idleSeconds: cmd.idleSeconds },
          actor
        );
        const modeDesc =
          vendor.copilotMode === "COPILOT"
            ? `🟢 *Co-Pilot Active* (steps in after *${vendor.copilotIdleSeconds}s* of inactivity)`
            : vendor.copilotMode === "FULL_AUTO"
              ? "⚡ *Full Auto-Pilot* (instant <2s replies)"
              : "⏸️ *Manual Mode* (Co-Pilot paused)";
        return {
          parsedCommand: cmd,
          whatsappReplyText: `🤖 *Co-Pilot Updated:* ${modeDesc}`,
        };
      }

      case "SET_RESERVATION_TTL": {
        const vendor = await this.analyticsSettingsService.updateReservationTtl(
          params.vendorId,
          cmd.minutes,
          actor
        );
        return {
          parsedCommand: cmd,
          whatsappReplyText: `⏳ *Stock Reservation Hold Timer Updated:* Buyers now have *${vendor.reservationTtlMinutes} minutes* to complete transfers before stock is released.`,
        };
      }

      case "UNKNOWN_COMMAND": {
        return {
          parsedCommand: cmd,
          whatsappReplyText: `❓ Unrecognized command: "${cmd.rawInput}".\nReply *help* to see all Caterlog vendor commands.`,
        };
      }
    }
  }
}

