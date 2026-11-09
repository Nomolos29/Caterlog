import crypto from "node:crypto";
import type { MessagingChannelPort } from "@caterlog/commerce-core";
import {
  DEFAULT_WHATSAPP_GRAPH_VERSION,
  WHATSAPP_GRAPH_BASE_URL,
  type WhatsAppIntegrationConfig,
  type WhatsAppMode,
} from "../config.ts";

export interface WhatsAppCloudConfig {
  accessToken: string;
  defaultPhoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  /** Explicit mode. Takes precedence over the legacy `sandboxMock` flag. */
  mode?: WhatsAppMode;
  /** Legacy flag retained for existing call sites: `true` means local mock. */
  sandboxMock?: boolean;
  graphApiVersion?: string;
}

export type WhatsAppOutboxKind =
  | "TEXT"
  | "IMAGE"
  | "INTERACTIVE_BUTTONS"
  | "INTERACTIVE_LIST"
  | "CATALOG_MESSAGE"
  | "PRODUCT_MESSAGE"
  | "PRODUCT_LIST";

export interface SentWhatsAppMessageLog {
  id: string;
  toPhone: string;
  text: string;
  vendorPhoneId: string;
  sentAt: Date;
  kind?: WhatsAppOutboxKind;
  /** Raw interactive payload, useful for assertions in local tests. */
  payload?: Record<string, unknown>;
}

export interface CatalogProductListSection {
  title: string;
  productRetailerIds: string[];
}

/**
 * Meta WhatsApp Cloud API & Coexistence Adapter (Implements `MessagingChannelPort`).
 *
 * Key UX feature for Nigerian Mobile Banking:
 * When sending a Virtual Account invoice, it sends two sequential bubbles:
 * 1. The structured Invoice Summary with Verified Seller badge and countdown timer.
 * 2. A second bubble containing ONLY the 10-digit NUBAN (`8092341102`) for 1-tap copy-paste.
 *
 * In `mock` mode every message is appended to an in-memory outbox instead of
 * hitting the Graph API, so the dashboard and tests can run without credentials.
 */
export class WhatsAppCloudAdapter implements MessagingChannelPort {
  private readonly sandboxOutbox: SentWhatsAppMessageLog[] = [];
  private readonly mode: WhatsAppMode;
  private readonly config: Required<
    Pick<WhatsAppCloudConfig, "accessToken" | "defaultPhoneNumberId" | "appSecret" | "verifyToken" | "graphApiVersion">
  >;

  constructor(config: WhatsAppCloudConfig) {
    this.mode = config.mode ?? (config.sandboxMock === false ? "live" : "mock");
    this.config = {
      accessToken: config.accessToken,
      defaultPhoneNumberId: config.defaultPhoneNumberId,
      appSecret: config.appSecret,
      verifyToken: config.verifyToken,
      graphApiVersion: config.graphApiVersion ?? DEFAULT_WHATSAPP_GRAPH_VERSION,
    };
  }

  public static fromConfig(config: WhatsAppIntegrationConfig): WhatsAppCloudAdapter {
    return new WhatsAppCloudAdapter({
      mode: config.mode,
      accessToken: config.accessToken,
      defaultPhoneNumberId: config.defaultPhoneNumberId,
      appSecret: config.appSecret,
      verifyToken: config.verifyToken,
      graphApiVersion: config.graphApiVersion,
    });
  }

  public getMode(): WhatsAppMode {
    return this.mode;
  }

  public isMockMode(): boolean {
    return this.mode === "mock";
  }

  public getIntegrationStatus() {
    return {
      provider: "WHATSAPP" as const,
      mode: this.mode,
      phoneNumberId: this.config.defaultPhoneNumberId || null,
      graphApiVersion: this.config.graphApiVersion,
      credentialsConfigured: Boolean(this.config.accessToken) && Boolean(this.config.appSecret),
    };
  }

  /**
   * Verifies Meta's `x-hub-signature-256` header (`sha256=<hex>`).
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", this.config.appSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  public getSandboxOutbox(): readonly SentWhatsAppMessageLog[] {
    return this.sandboxOutbox;
  }

  /**
   * Retrieves the temporary download URL for a WhatsApp media ID from Meta Graph API.
   */
  public async getMediaUrl(mediaId: string): Promise<string | null> {
    if (this.isMockMode() || !this.config.accessToken) {
      return null;
    }
    try {
      const url = `https://graph.facebook.com/${this.config.graphApiVersion}/${encodeURIComponent(mediaId)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { url?: string };
      return data.url ?? null;
    } catch {
      return null;
    }
  }

  public clearSandboxOutbox(): void {
    this.sandboxOutbox.length = 0;
  }

  public async sendTextMessage(params: {
    toPhone: string;
    text: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "TEXT",
      text: params.text,
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "text",
        text: { preview_url: true, body: params.text },
      },
    });
  }

  /**
   * Sends a media image message with optional caption.
   */
  public async sendImageMessage(params: {
    toPhone: string;
    imageUrl: string;
    caption?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "IMAGE",
      text: params.caption ?? "",
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "image",
        image: {
          link: params.imageUrl,
          ...(params.caption ? { caption: params.caption } : {}),
        },
      },
    });
  }

  /**
   * Sends an interactive message with up to 3 quick-reply buttons.
   * Can include a header image when provided.
   */
  public async sendInteractiveButtonsMessage(params: {
    toPhone: string;
    bodyText: string;
    buttons: Array<{ id: string; title: string }>;
    headerImageUrl?: string;
    footerText?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const formattedButtons = params.buttons.slice(0, 3).map((b) => ({
      type: "reply",
      reply: {
        id: b.id.slice(0, 200),
        title: b.title.slice(0, 20),
      },
    }));

    const isPublicHeaderImage = Boolean(
      params.headerImageUrl &&
      /^https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(params.headerImageUrl)
    );

    const interactivePayload: Record<string, unknown> = {
      type: "button",
      body: { text: params.bodyText.slice(0, 1024) },
      action: { buttons: formattedButtons },
    };

    if (isPublicHeaderImage) {
      interactivePayload.header = {
        type: "image",
        image: { link: params.headerImageUrl },
      };
    }

    if (params.footerText) {
      interactivePayload.footer = { text: params.footerText.slice(0, 60) };
    }

    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "INTERACTIVE_BUTTONS",
      text: params.bodyText,
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "interactive",
        interactive: interactivePayload,
      },
    });
  }

  /**
   * Sends an interactive list message (4 to 10 options) that opens a selection sheet.
   */
  public async sendInteractiveListMessage(params: {
    toPhone: string;
    bodyText: string;
    buttonText?: string;
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
    headerText?: string;
    footerText?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const formattedSections = params.sections.map((sec) => ({
      title: sec.title.slice(0, 24),
      rows: sec.rows.slice(0, 10).map((r) => ({
        id: r.id.slice(0, 200),
        title: r.title.slice(0, 24),
        ...(r.description ? { description: r.description.slice(0, 72) } : {}),
      })),
    }));

    const interactivePayload: Record<string, unknown> = {
      type: "list",
      body: { text: params.bodyText.slice(0, 1024) },
      action: {
        button: (params.buttonText ?? "View Options").slice(0, 20),
        sections: formattedSections,
      },
    };

    if (params.headerText) {
      interactivePayload.header = {
        type: "text",
        text: params.headerText.slice(0, 60),
      };
    }

    if (params.footerText) {
      interactivePayload.footer = { text: params.footerText.slice(0, 60) };
    }

    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "INTERACTIVE_LIST",
      text: params.bodyText,
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "interactive",
        interactive: interactivePayload,
      },
    });
  }

  /**
   * High-level unified dispatcher that automatically selects the appropriate
   * Meta WhatsApp message type (Image, Interactive Buttons, Interactive List, or Text),
   * ensuring real phones render identically to the web dashboard simulator.
   */
  public async sendWhatsAppMessage(params: {
    toPhone: string;
    text: string;
    imageUrl?: string;
    quickReplies?: Array<{ label: string; replyText: string }>;
    headerText?: string;
    footerText?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const isPublicImage = Boolean(
      params.imageUrl &&
      /^https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(params.imageUrl)
    );

    // 1. Interactive Buttons (1 to 3 quick-reply options)
    if (params.quickReplies && params.quickReplies.length > 0 && params.quickReplies.length <= 3) {
      try {
        await this.sendInteractiveButtonsMessage({
          toPhone: params.toPhone,
          bodyText: params.text,
          buttons: params.quickReplies.map((qr) => ({
            id: qr.replyText,
            title: qr.label,
          })),
          headerImageUrl: isPublicImage ? params.imageUrl : undefined,
          footerText: params.footerText,
          vendorPhoneId: params.vendorPhoneId,
        });
        return;
      } catch (err) {
        console.warn("[caterlog:whatsapp] Failed to send interactive buttons, falling back:", err);
      }
    }

    // 2. Interactive List (4 to 10 options)
    if (params.quickReplies && params.quickReplies.length > 3) {
      try {
        if (isPublicImage && params.imageUrl) {
          try {
            await this.sendImageMessage({
              toPhone: params.toPhone,
              imageUrl: params.imageUrl,
              vendorPhoneId: params.vendorPhoneId,
            });
          } catch {
            // Ignore image send failure, proceed with list
          }
        }

        await this.sendInteractiveListMessage({
          toPhone: params.toPhone,
          headerText: params.headerText,
          bodyText: params.text,
          buttonText: "View Options",
          sections: [
            {
              title: "Options",
              rows: params.quickReplies.slice(0, 10).map((qr) => ({
                id: qr.replyText,
                title: qr.label,
              })),
            },
          ],
          footerText: params.footerText,
          vendorPhoneId: params.vendorPhoneId,
        });
        return;
      } catch (err) {
        console.warn("[caterlog:whatsapp] Failed to send interactive list, falling back:", err);
      }
    }

    // 3. Standalone Image with Caption
    if (isPublicImage && params.imageUrl) {
      try {
        await this.sendImageMessage({
          toPhone: params.toPhone,
          imageUrl: params.imageUrl,
          caption: params.text,
          vendorPhoneId: params.vendorPhoneId,
        });
        return;
      } catch (err) {
        console.warn("[caterlog:whatsapp] Failed to send image message, falling back:", err);
      }
    }

    // 4. Default Text Message
    await this.sendTextMessage({
      toPhone: params.toPhone,
      text: params.text,
      vendorPhoneId: params.vendorPhoneId,
    });
  }

  /**
   * Opens the vendor's full WhatsApp catalog inside the chat.
   * Interactive messages do not require template pre-approval.
   */
  public async sendCatalogMessage(params: {
    toPhone: string;
    bodyText?: string;
    footerText?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const text = params.bodyText ?? "Browse our catalog and order directly in WhatsApp.";
    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "CATALOG_MESSAGE",
      text,
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "interactive",
        interactive: {
          type: "catalog_message",
          body: { text },
          ...(params.footerText ? { footer: { text: params.footerText } } : {}),
          action: { name: "catalog_message" },
        },
      },
    });
  }

  /**
   * Sends a single-product card (Product Detail Page) from the catalog.
   */
  public async sendProductMessage(params: {
    toPhone: string;
    catalogId: string;
    productRetailerId: string;
    bodyText?: string;
    footerText?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const text = params.bodyText ?? "Tap to view this product.";
    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "PRODUCT_MESSAGE",
      text,
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "interactive",
        interactive: {
          type: "product",
          body: { text },
          ...(params.footerText ? { footer: { text: params.footerText } } : {}),
          action: {
            catalog_id: params.catalogId,
            product_retailer_id: params.productRetailerId,
          },
        },
      },
    });
  }

  /**
   * Sends a multi-product list grouped into sections.
   */
  public async sendProductListMessage(params: {
    toPhone: string;
    headerText: string;
    bodyText: string;
    catalogId: string;
    sections: CatalogProductListSection[];
    footerText?: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    if (params.sections.length === 0) {
      throw new Error("A WhatsApp product list needs at least one section.");
    }
    await this.postMessage({
      toPhone: params.toPhone,
      vendorPhoneId: params.vendorPhoneId,
      kind: "PRODUCT_LIST",
      text: params.bodyText,
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "interactive",
        interactive: {
          type: "product_list",
          header: { type: "text", text: params.headerText },
          body: { text: params.bodyText },
          ...(params.footerText ? { footer: { text: params.footerText } } : {}),
          action: {
            catalog_id: params.catalogId,
            sections: params.sections.map((section) => ({
              title: section.title.slice(0, 24),
              product_items: section.productRetailerIds.map((id) => ({
                product_retailer_id: id,
              })),
            })),
          },
        },
      },
    });
  }

  public async sendVirtualAccountInvoice(params: {
    toBuyerPhone: string;
    vendorBusinessName: string;
    isVendorVerified: boolean;
    orderShortCode: string;
    productSummary: string;
    totalAmountFormatted: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresInMinutes: number;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const trustBadge = params.isVendorVerified
      ? "✓ *Verified Caterlog Seller*"
      : "🏪 *Caterlog Seller*";

    const invoiceBubble = [
      `🧾 *Order Invoice ${params.orderShortCode}*`,
      `${params.vendorBusinessName} (${trustBadge})`,
      `────────────────────`,
      `📦 *Item:* ${params.productSummary}`,
      `💰 *Exact Amount:* *${params.totalAmountFormatted}*`,
      `🏦 *Bank:* ${params.bankName}`,
      `🔢 *Account No:* *${params.accountNumber}*`,
      `👤 *Account Name:* ${params.accountName}`,
      `⏳ *Stock Reserved For:* ${params.expiresInMinutes} mins`,
      `────────────────────`,
      `_Copy the account number in the next message to transfer. This chat will update automatically once your transfer clears!_`,
    ].join("\n");

    // 1. Send formatted Invoice Summary
    await this.sendTextMessage({
      toPhone: params.toBuyerPhone,
      text: invoiceBubble,
      vendorPhoneId: params.vendorPhoneId,
    });

    // 2. Immediately send a standalone bubble with ONLY the 10-digit NUBAN for 1-tap copy on mobile
    await this.sendTextMessage({
      toPhone: params.toBuyerPhone,
      text: params.accountNumber,
      vendorPhoneId: params.vendorPhoneId,
    });
  }

  private async postMessage(params: {
    toPhone: string;
    vendorPhoneId?: string | null;
    kind: WhatsAppOutboxKind;
    text: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const phoneId = params.vendorPhoneId ?? this.config.defaultPhoneNumberId;

    if (this.isMockMode()) {
      this.sandboxOutbox.push({
        id: `wamid.mock.${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        toPhone: params.toPhone,
        text: params.text,
        vendorPhoneId: phoneId,
        sentAt: new Date(),
        kind: params.kind,
        payload: params.payload,
      });
      return;
    }

    const response = await fetch(
      `${WHATSAPP_GRAPH_BASE_URL}/${this.config.graphApiVersion}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params.payload),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      // If Meta rejects the message because of Sandbox Developer limitations (code 131030: recipient not in allowed list)
      // or unverified sandbox number, safely capture in the outbox so simulated customer checkout never crashes.
      if (
        errText.includes("131030") ||
        errText.includes("Recipient phone number not in allowed list") ||
        errText.includes("OAuthException")
      ) {
        console.warn(
          `[caterlog:whatsapp] Meta Sandbox notice: ${errText.slice(0, 120)}... Captured in simulator outbox for ${params.toPhone}.`
        );
        this.sandboxOutbox.push({
          id: `wamid.simulated.${Date.now()}`,
          toPhone: params.toPhone,
          text: params.text,
          vendorPhoneId: phoneId,
          sentAt: new Date(),
          kind: params.kind,
          payload: params.payload,
        });
        return;
      }
      throw new Error(`WhatsApp Cloud API send failed (${response.status}): ${errText}`);
    }
  }
}
