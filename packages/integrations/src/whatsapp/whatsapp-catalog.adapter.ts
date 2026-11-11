import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  WHATSAPP_GRAPH_BASE_URL,
  type CatalogMode,
  type WhatsAppCatalogIntegrationConfig,
} from "../config.ts";

/** Vendor product shape required to build a Meta catalog item. */
export interface CatalogProductInput {
  skuCode: string;
  name: string;
  description?: string;
  basePriceKobo: bigint;
  stockAvailable: number;
  primaryImageUrl?: string;
  category?: string;
  brand?: string;
  itemGroupId?: string;
}

/** Meta Graph `POST /{catalog_id}/products` request body. */
export interface MetaCatalogProductItem {
  retailer_id: string;
  item_group_id?: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  availability: "in stock" | "out of stock";
  condition: "new" | "refurbished" | "used";
  image_url?: string;
  url?: string;
  brand?: string;
}

export interface CatalogSyncItemResult {
  skuCode: string;
  retailerId: string;
  productItemId?: string;
}

export interface CatalogSyncFailure {
  skuCode: string;
  error: string;
}

export interface CatalogSyncResult {
  mode: CatalogMode;
  catalogId: string | null;
  syncedAt: string;
  attempted: number;
  upserted: number;
  deleted: number;
  failed: CatalogSyncFailure[];
  items: CatalogSyncItemResult[];
}

export interface CatalogAdapterConfig {
  mode?: CatalogMode;
  catalogId: string;
  businessAccountId: string;
  accessToken: string;
  graphApiVersion?: string;
  requestTimeoutMs?: number;
  /** Prefix used to build the product detail URL Meta shows in the PDP. */
  productUrlBase?: string;
  currency?: string;
  brand?: string;
}

/**
 * WhatsApp Business Catalog sync adapter.
 *
 * Products are upserted into the Meta catalog with `retailer_id = SKU`, and the
 * price is the kobo amount as an int64 (Meta expects the smallest currency unit,
 * matching the plan's `price = kobo integer, currency = NGN` mapping).
 *
 * In `mock` mode the adapter keeps an in-memory published catalog so the local
 * dashboard can demonstrate sync without Meta credentials.
 */
export class WhatsAppCatalogAdapter {
  private readonly mode: CatalogMode;
  private readonly config: Required<
    Pick<
      CatalogAdapterConfig,
      "catalogId" | "businessAccountId" | "accessToken" | "graphApiVersion" | "requestTimeoutMs" | "currency"
    >
  > &
    Pick<CatalogAdapterConfig, "productUrlBase" | "brand">;

  /** Mock-mode published catalog: retailerId -> item. */
  private readonly mockCatalog = new Map<string, MetaCatalogProductItem>();
  /** Tracks Meta product item IDs so items can be deleted later. */
  private readonly productItemIds = new Map<string, string>();
  private lastSyncedAt: string | null = null;

  constructor(config: CatalogAdapterConfig) {
    this.mode = config.mode ?? "mock";
    this.config = {
      catalogId: config.catalogId,
      businessAccountId: config.businessAccountId,
      accessToken: config.accessToken,
      graphApiVersion: config.graphApiVersion ?? "v21.0",
      requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      currency: config.currency ?? "NGN",
      productUrlBase: config.productUrlBase,
      brand: config.brand,
    };
  }

  public static fromConfig(
    config: WhatsAppCatalogIntegrationConfig,
    extras: Pick<CatalogAdapterConfig, "productUrlBase" | "brand" | "currency"> = {}
  ): WhatsAppCatalogAdapter {
    return new WhatsAppCatalogAdapter({ ...config, ...extras });
  }

  public getMode(): CatalogMode {
    return this.mode;
  }

  public isMockMode(): boolean {
    return this.mode === "mock";
  }

  public getIntegrationStatus() {
    return {
      provider: "WHATSAPP_CATALOG" as const,
      mode: this.mode,
      catalogId: this.config.catalogId || null,
      businessAccountId: this.config.businessAccountId || null,
      credentialsConfigured: Boolean(this.config.accessToken),
      lastSyncedAt: this.lastSyncedAt,
      publishedItems: this.isMockMode() ? this.mockCatalog.size : this.productItemIds.size,
    };
  }

  public getMockCatalog(): MetaCatalogProductItem[] {
    return Array.from(this.mockCatalog.values());
  }

  /**
   * Maps a vendor product to Meta's catalog item contract.
   */
  public mapProduct(product: CatalogProductInput): MetaCatalogProductItem {
    const description =
      product.description?.trim() ||
      `${product.name} — sold by a verified Caterlog vendor.`;
    const item: MetaCatalogProductItem = {
      retailer_id: product.skuCode.toUpperCase(),
      name: product.name.slice(0, 200),
      description: description.slice(0, 9_000),
      price: Number(product.basePriceKobo),
      currency: this.config.currency,
      availability: product.stockAvailable > 0 ? "in stock" : "out of stock",
      condition: "new",
    };

    let imageUrl = product.primaryImageUrl?.trim();
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl) || /localhost|127\.0\.0\.1/i.test(imageUrl)) {
      imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80";
    }
    item.image_url = imageUrl;
    if (this.config.productUrlBase) {
      item.url = `${this.config.productUrlBase.replace(/\/+$/, "")}/${encodeURIComponent(
        product.skuCode.toUpperCase()
      )}`;
    }
    if (product.itemGroupId) {
      item.item_group_id = product.itemGroupId.toUpperCase();
    }
    const brand = product.brand ?? this.config.brand;
    if (brand) item.brand = brand;

    return item;
  }

  /**
   * Links the catalog to the WhatsApp Business Account (idempotent on Meta's side).
   */
  public async linkCatalogToBusinessAccount(): Promise<void> {
    if (this.isMockMode()) return;
    this.assertConfigured(["catalogId", "businessAccountId"]);
    await this.request(`/${this.config.businessAccountId}/product_catalogs`, {
      method: "POST",
      body: { catalog_id: this.config.catalogId },
    });
  }

  /**
   * Enables/disables the catalog and cart for a business phone number.
   */
  public async setCommerceSettings(params: {
    phoneNumberId: string;
    isCatalogVisible: boolean;
    isCartEnabled: boolean;
  }): Promise<void> {
    if (this.isMockMode()) return;
    const query = new URLSearchParams({
      is_catalog_visible: String(params.isCatalogVisible),
      is_cart_enabled: String(params.isCartEnabled),
    });
    await this.request(
      `/${params.phoneNumberId}/whatsapp_commerce_settings?${query.toString()}`,
      { method: "POST" }
    );
  }

  /**
   * Upserts every product into the Meta catalog and optionally deletes items
   * that no longer exist in the vendor's inventory.
   */
  public async syncProducts(
    products: CatalogProductInput[],
    options: { deleteMissing?: boolean; existingSkus?: string[] } = {}
  ): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = {
      mode: this.mode,
      catalogId: this.config.catalogId || null,
      syncedAt: new Date().toISOString(),
      attempted: products.length,
      upserted: 0,
      deleted: 0,
      failed: [],
      items: [],
    };

    if (this.isMockMode()) {
      const seen = new Set<string>();
      for (const product of products) {
        const item = this.mapProduct(product);
        seen.add(item.retailer_id);
        this.mockCatalog.set(item.retailer_id, item);
        result.upserted += 1;
        result.items.push({
          skuCode: product.skuCode,
          retailerId: item.retailer_id,
          productItemId: `mock-item-${item.retailer_id}`,
        });
      }
      if (options.deleteMissing) {
        const keep = new Set((options.existingSkus ?? products.map((p) => p.skuCode)).map((s) => s.toUpperCase()));
        for (const retailerId of Array.from(this.mockCatalog.keys())) {
          if (!keep.has(retailerId)) {
            this.mockCatalog.delete(retailerId);
            result.deleted += 1;
          }
        }
      }
      this.lastSyncedAt = result.syncedAt;
      return result;
    }

    this.assertConfigured(["catalogId", "accessToken"]);
    await this.linkCatalogToBusinessAccount();

    for (const product of products) {
      const item = this.mapProduct(product);
      try {
        const response = await this.request<{ id?: string; product_item_id?: string }>(
          `/${this.config.catalogId}/products`,
          { method: "POST", body: item }
        );
        const productItemId = response.id ?? response.product_item_id;
        if (productItemId) this.productItemIds.set(item.retailer_id, productItemId);
        result.upserted += 1;
        result.items.push({
          skuCode: product.skuCode,
          retailerId: item.retailer_id,
          productItemId,
        });
      } catch (err) {
        result.failed.push({
          skuCode: product.skuCode,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (options.deleteMissing) {
      const keep = new Set((options.existingSkus ?? products.map((p) => p.skuCode)).map((s) => s.toUpperCase()));
      try {
        const metaItems = await this.fetchCatalogProducts();
        for (const item of metaItems) {
          const retailerId = item.retailer_id.toUpperCase();
          if (keep.has(retailerId)) continue;
          try {
            await this.request(`/${item.id}`, { method: "DELETE" });
            this.productItemIds.delete(retailerId);
            result.deleted += 1;
          } catch (err) {
            result.failed.push({
              skuCode: retailerId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        console.warn("Could not query Meta catalog for orphaned items during sync:", err);
      }
    }

    this.lastSyncedAt = result.syncedAt;
    return result;
  }

  /**
   * Fetches all current items directly from the Meta Commerce Catalog.
   * Updates the internal retailerId -> Meta product item ID mapping.
   */
  public async fetchCatalogProducts(): Promise<
    Array<{ id: string; retailer_id: string; name: string; price?: string; availability?: string }>
  > {
    if (this.isMockMode()) {
      return Array.from(this.mockCatalog.entries()).map(([retailer_id, item]) => ({
        id: `mock-item-${retailer_id}`,
        retailer_id,
        name: item.name,
      }));
    }

    this.assertConfigured(["catalogId", "accessToken"]);
    const items: Array<{ id: string; retailer_id: string; name: string; price?: string; availability?: string }> = [];
    let nextPath: string | null = `/${this.config.catalogId}/products?fields=id,retailer_id,name,price,availability&limit=100`;

    while (nextPath) {
      interface MetaProductPage {
        data?: Array<{ id: string; retailer_id?: string; name: string; price?: string; availability?: string }>;
        paging?: { next?: string };
      }
      const response: MetaProductPage = await this.request<MetaProductPage>(nextPath, { method: "GET" });

      if (response.data && Array.isArray(response.data)) {
        for (const item of response.data) {
          if (item.retailer_id) {
            items.push({
              id: item.id,
              retailer_id: item.retailer_id,
              name: item.name,
              price: item.price,
              availability: item.availability,
            });
            this.productItemIds.set(item.retailer_id.toUpperCase(), item.id);
          }
        }
      }

      nextPath = response.paging?.next ?? null;
    }

    return items;
  }

  /**
   * Deletes a single product from the Meta Commerce Catalog by its SKU / retailer_id.
   */
  public async deleteProduct(skuCode: string): Promise<boolean> {
    const cleanSku = skuCode.trim().toUpperCase();
    if (this.isMockMode()) {
      return this.mockCatalog.delete(cleanSku);
    }

    this.assertConfigured(["catalogId", "accessToken"]);
    let itemId = this.productItemIds.get(cleanSku);
    if (!itemId) {
      try {
        const items = await this.fetchCatalogProducts();
        const match = items.find((i) => i.retailer_id.toUpperCase() === cleanSku);
        if (match) {
          itemId = match.id;
        }
      } catch (err) {
        console.warn(`Failed to look up Meta item ID for SKU "${cleanSku}":`, err);
      }
    }

    if (!itemId) {
      return false;
    }

    try {
      await this.request(`/${itemId}`, { method: "DELETE" });
      this.productItemIds.delete(cleanSku);
      return true;
    } catch (err) {
      console.error(`Failed to delete Meta catalog product item "${cleanSku}" (${itemId}):`, err);
      return false;
    }
  }

  private assertConfigured(fields: Array<"catalogId" | "businessAccountId" | "accessToken">) {
    const labels: Record<(typeof fields)[number], string> = {
      catalogId: "WHATSAPP_CATALOG_ID",
      businessAccountId: "WHATSAPP_BUSINESS_ACCOUNT_ID",
      accessToken: "WHATSAPP_ACCESS_TOKEN",
    };
    const missing = fields.filter((field) => !this.config[field]);
    if (missing.length > 0) {
      throw new Error(
        `WhatsApp catalog is in live mode but missing: ${missing.map((f) => labels[f]).join(", ")}.`
      );
    }
  }

  private async request<T = Record<string, unknown>>(
    path: string,
    init: { method: string; body?: unknown }
  ): Promise<T & { id?: string; product_item_id?: string }> {
    let response: Response;
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${WHATSAPP_GRAPH_BASE_URL}/${this.config.graphApiVersion}${path}`;
    try {
      response = await fetch(
        url,
        {
          method: init.method,
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            Accept: "application/json",
            ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        }
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`WhatsApp catalog request ${init.method} ${path} failed: ${reason}`);
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `WhatsApp catalog request ${init.method} ${path} failed (${response.status}): ${raw.slice(0, 500)}`
      );
    }

    if (!raw) return {} as T & { id?: string; product_item_id?: string };
    try {
      return JSON.parse(raw) as T & { id?: string; product_item_id?: string };
    } catch {
      throw new Error(
        `WhatsApp catalog returned non-JSON for ${init.method} ${path}: ${raw.slice(0, 200)}`
      );
    }
  }
}
