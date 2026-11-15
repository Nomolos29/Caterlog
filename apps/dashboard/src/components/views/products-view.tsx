"use client";

import React, { useState, useEffect } from "react";
import type { ProductItem, ResellerMirror, SupplierProfile } from "@/lib/types";
import { PlusIcon } from "../icons";
import { ProductEditorModal, buildStructuredSku } from "./product-editor-modal";
import { EmptyState } from "../ui/empty-state";
import { resolveImageUrl } from "@/lib/api";

interface ProductsViewProps {
  products: ProductItem[];
  suppliers?: SupplierProfile[];
  resellerMirrors?: ResellerMirror[];
  workspaceRole?: "reseller" | "supplier";
  initialTab?:
    | "all"
    | "my-inventory"
    | "reselling"
    | "exceptions"
    | "mirror-wizard";
  onAddProduct: (input: {
    skuCode?: string;
    name: string;
    description?: string;
    category?: string;
    priceNaira: number;
    stockTotal: number;
    primaryImageUrl?: string;
    customFields?: Record<string, string>;
    variants?: Array<{
      id?: string;
      name: string;
      skuCode?: string;
      priceNaira?: number;
      stockTotal: number;
    }>;
  }) => Promise<boolean>;
  onUpdateProduct?: (
    sku: string,
    input: {
      name?: string;
      description?: string;
      category?: string;
      priceNaira?: number;
      stockTotal?: number;
      primaryImageUrl?: string;
      customFields?: Record<string, string>;
      variants?: Array<{
        id?: string;
        name: string;
        skuCode?: string;
        priceNaira?: number;
        stockTotal: number;
      }>;
    },
  ) => Promise<boolean>;
  onUpdateStock: (sku: string, stock: number) => Promise<boolean>;
  onDeleteProduct?: (skuCode: string) => Promise<boolean>;
  onNavigateToNetwork?: (tab?: string) => void;
  onNavigateToSettings?: (tab?: string, subId?: string) => void;
  initialEditResellSku?: string | null;
  onConsumeEditResellSku?: () => void;
  onSyncWhatsAppCatalog?: () => Promise<{
    attempted: number;
    upserted: number;
    deleted: number;
    mode: string;
    catalogId: string | null;
    failed?: Array<{ skuCode: string; error?: string }>;
  } | null>;
}

interface ResellingItem {
  id: string;
  name: string;
  sku: string;
  catalogSku?: string;
  supplier: string;
  stock: number;
  cost: number;
  sellingPrice: number;
  status: "Synced" | "Paused";
}

const INITIAL_RESELLING: ResellingItem[] = [];

export function ProductsView({
  products,
  suppliers = [],
  resellerMirrors = [],
  workspaceRole = "reseller",
  initialTab = "my-inventory",
  initialEditResellSku = null,
  onConsumeEditResellSku,
  onAddProduct,
  onUpdateProduct,
  onUpdateStock,
  onDeleteProduct,
  onNavigateToNetwork,
  onNavigateToSettings,
  onSyncWhatsAppCatalog,
}: ProductsViewProps) {
  // Tabs: 'all' | 'my-inventory' | 'reselling' | 'exceptions' | 'mirror-wizard'
  const [activeTab, setActiveTab] = useState<
    "all" | "my-inventory" | "reselling" | "exceptions" | "mirror-wizard"
  >(initialTab);
  const [resellingList, setResellingList] =
    useState<ResellingItem[]>(INITIAL_RESELLING);

  useEffect(() => {
    if (workspaceRole === "supplier" && activeTab === "reselling") {
      setActiveTab("my-inventory");
    }
  }, [workspaceRole, activeTab]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!initialEditResellSku || resellingList.length === 0) return;
    const upperTarget = initialEditResellSku.toUpperCase();
    const match =
      resellingList.find(
        (item) =>
          item.sku.toUpperCase() === upperTarget ||
          item.catalogSku?.toUpperCase() === upperTarget
      ) ?? resellingList[0];
    if (match) {
      setActiveTab("reselling");
      setEditingResellItem(match);
      setEditingResellPrice(String(match.sellingPrice));
      onConsumeEditResellSku?.();
    }
  }, [initialEditResellSku, resellingList, onConsumeEditResellSku]);

  // Sync resellingList from database ResellerCatalogMirror + SupplierProfile + live mirrored products
  useEffect(() => {
    const mapped: ResellingItem[] = [];
    const seenSkus = new Set<string>();

    for (const mirror of resellerMirrors || []) {
      const sup = suppliers.find(
        (s) => s.id === mirror.supplierId || s.slug === mirror.supplierSlug,
      );
      if (!sup) continue;
      for (const prod of sup.catalogProducts) {
        if (
          mirror.mirroredProductSkus.length === 0 ||
          mirror.mirroredProductSkus.includes(prod.sku)
        ) {
          const raw = prod as unknown as Record<string, unknown>;
          const mirroredInCatalog = products.find(
            (p) =>
              p.customFields?.supplierSku === prod.sku ||
              p.name.toLowerCase() === prod.name.toLowerCase(),
          );
          const cost = Number(
            prod.wholesalePriceNaira ??
              raw.wholesaleCost ??
              mirroredInCatalog?.customFields?.wholesalePriceNaira ??
              0,
          );
          const fallbackRetail = Number(
            prod.suggestedRetailNaira ??
              raw.suggestedRetail ??
              (cost > 0 ? Math.round(cost * 1.25) : 0),
          );
          const sellingPrice =
            mirroredInCatalog?.basePriceNaira || fallbackRetail;

          seenSkus.add(prod.sku);
          mapped.push({
            id: `${mirror.id}-${prod.sku}`,
            name: mirroredInCatalog?.name || prod.name,
            sku: prod.sku,
            catalogSku: mirroredInCatalog?.skuCode,
            supplier: sup.name,
            stock: mirroredInCatalog
              ? mirroredInCatalog.availableStock
              : prod.stock,
            cost,
            sellingPrice,
            status: mirror.status === "PAUSED" ? "Paused" : "Synced",
          });
        }
      }
    }

    // Also include any mirrored catalog products not matched above
    for (const p of products) {
      const supSku = p.customFields?.supplierSku;
      if (!supSku || seenSkus.has(supSku)) continue;
      const cost = Number(
        p.customFields?.wholesalePriceNaira ??
          Math.round(p.basePriceNaira * 0.8),
      );
      mapped.push({
        id: `cat-${p.id}`,
        name: p.name,
        sku: supSku,
        catalogSku: p.skuCode,
        supplier: p.customFields?.supplierName || "Wholesale Supplier",
        stock: p.availableStock,
        cost,
        sellingPrice: p.basePriceNaira,
        status: p.availableStock > 0 ? "Synced" : "Paused",
      });
    }

    setResellingList(mapped);
  }, [resellerMirrors, suppliers, products]);

  // Reselling state
  const [searchReselling, setSearchReselling] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("All linked products");
  const [editingResellItem, setEditingResellItem] =
    useState<ResellingItem | null>(null);
  const [editingResellPrice, setEditingResellPrice] = useState("");
  const [savingResellPrice, setSavingResellPrice] = useState(false);

  // Catalog filter state for All products / My inventory
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("ALL");

  // Mirror & Set Margins Wizard state
  const [flaskPrice, setFlaskPrice] = useState("10000");
  const [lunchBoxPrice, setLunchBoxPrice] = useState("7500");
  const [jarPrice, setJarPrice] = useState("4000");
  const [storefrontChannel, setStorefrontChannel] = useState(true);
  const [whatsappChannel, setWhatsappChannel] = useState(true);
  const [instagramChannel, setInstagramChannel] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(false);

  // Exceptions Workbench state
  const [exceptionFilter, setExceptionFilter] = useState<
    "all" | "price" | "stock" | "automation"
  >("all");
  const [proposedPrice, setProposedPrice] = useState("10500");
  const [exception1Resolved, setException1Resolved] = useState(false);
  const [stockRechecked, setStockRechecked] = useState(false);
  const [customerNotified, setCustomerNotified] = useState(false);
  const [supplierMsgModal, setSupplierMsgModal] = useState(false);
  const [supplierMsgText, setSupplierMsgText] = useState(
    "Hi Aroko Wholesale, can you confirm if same-day delivery to Lekki before 4pm is feasible for Order CT-1042?",
  );
  const [supplierMsgSent, setSupplierMsgSent] = useState(false);
  const [internalNote, setInternalNote] = useState(
    "Awaiting supplier delivery confirmation",
  );

  // Product Editor & Add Modal
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(
    null,
  );

  // Standard product add modal
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setSaving(true);
    try {
      const ok = await onAddProduct({
        name,
        priceNaira: Number(price),
        stockTotal: Number(stock) || 1,
        skuCode: sku.trim() || undefined,
        primaryImageUrl: imageUrl.trim() || undefined,
      });
      if (ok) {
        setShowAddForm(false);
        setName("");
        setPrice("");
        setSku("");
        setImageUrl("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublishWizard = () => {
    setWizardSuccess(true);
    setResellingList((prev) =>
      prev.map((item) => {
        if (item.sku === "AW-FL750")
          return {
            ...item,
            sellingPrice: Number(flaskPrice) || item.sellingPrice,
          };
        if (item.sku === "AW-LB1200")
          return {
            ...item,
            sellingPrice: Number(lunchBoxPrice) || item.sellingPrice,
          };
        if (item.sku === "AW-SJ1000")
          return {
            ...item,
            sellingPrice: Number(jarPrice) || item.sellingPrice,
          };
        return item;
      }),
    );
    setTimeout(() => {
      setActiveTab("reselling");
      setWizardSuccess(false);
    }, 1200);
  };

  const handleToggleListingPause = (sku: string) => {
    setResellingList((prev) =>
      prev.map((item) =>
        item.sku === sku
          ? { ...item, status: item.status === "Synced" ? "Paused" : "Synced" }
          : item,
      ),
    );
  };

  const handleSaveResellPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResellItem) return;
    const nextPrice = Number(editingResellPrice);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;

    setSavingResellPrice(true);
    try {
      if (editingResellItem.catalogSku && onUpdateProduct) {
        await onUpdateProduct(editingResellItem.catalogSku, {
          priceNaira: nextPrice,
        });
      }
      setResellingList((prev) =>
        prev.map((item) =>
          item.id === editingResellItem.id
            ? { ...item, sellingPrice: nextPrice }
            : item,
        ),
      );
      setEditingResellItem(null);
    } finally {
      setSavingResellPrice(false);
    }
  };

  // Real-time Selling Exceptions (low/zero stock or zero/negative margin)
  const sellingExceptions = React.useMemo(() => {
    const list: Array<{
      id: string;
      sku: string;
      name: string;
      kind: "LOW_STOCK" | "OUT_OF_STOCK" | "LOW_MARGIN";
      title: string;
      detail: string;
      product?: ProductItem;
      resellItem?: ResellingItem;
    }> = [];

    for (const p of products) {
      if (p.availableStock <= 0) {
        list.push({
          id: `oos-${p.id}`,
          sku: p.skuCode,
          name: p.name,
          kind: "OUT_OF_STOCK",
          title: `${p.name} is out of stock`,
          detail: `SKU ${p.skuCode} has 0 available units. WhatsApp checkout will pause until restocked.`,
          product: p,
        });
      } else if (p.availableStock <= 5) {
        list.push({
          id: `low-${p.id}`,
          sku: p.skuCode,
          name: p.name,
          kind: "LOW_STOCK",
          title: `Low stock alert: ${p.name}`,
          detail: `Only ${p.availableStock} unit(s) remaining on SKU ${p.skuCode}.`,
          product: p,
        });
      }
    }

    for (const r of resellingList) {
      if (r.sellingPrice <= r.cost) {
        list.push({
          id: `margin-${r.id}`,
          sku: r.sku,
          name: r.name,
          kind: "LOW_MARGIN",
          title: `Margin alert on ${r.name}`,
          detail: `Selling price (₦${r.sellingPrice.toLocaleString()}) is at or below supplier cost (₦${r.cost.toLocaleString()}).`,
          resellItem: r,
        });
      }
    }

    return list;
  }, [products, resellingList]);

  /* -------------------------------------------------------------------------- */
  /* Screen 5: Products · Mirror and set margins (Wizard)                        */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "mirror-wizard") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-24">
        <div>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 cursor-pointer"
          >
            ← Back to products
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Mirror Products &amp; Set Margins
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Link products from verified wholesale suppliers and set your custom
            retail markup.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
            🤝
          </div>
          <h3 className="text-base font-bold text-gray-900">
            No Supplier Products Selected
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Visit the Supplier Network directory to select items from verified
            wholesale importers before configuring retail markup.
          </p>
          {onNavigateToNetwork && (
            <button
              onClick={() => onNavigateToNetwork("find-suppliers")}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              Browse Verified Suppliers →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 6: Products · Selling exceptions workbench                          */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "exceptions") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full pb-16">
        {/* Header */}
        <div className="min-h-[52px]">
          <div className="text-xs text-gray-500 mb-1">
            Products / Reselling / Selling exceptions
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Selling exceptions
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Resolve stock and margin changes that affect linked listings,
            checkout and automated selling.
          </p>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
          <button
            onClick={() => setActiveTab("all")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            All products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            My inventory (
            {products.filter((p) => !p.customFields?.supplierSku).length})
          </button>
          {workspaceRole !== "supplier" && (
            <button
              onClick={() => setActiveTab("reselling")}
              className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              Reselling ({resellingList.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab("exceptions")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer"
          >
            Selling exceptions ({sellingExceptions.length})
          </button>
        </div>

        {sellingExceptions.length === 0 ? (
          <EmptyState
            badge="In Sync"
            icon="✓"
            title="No Selling Exceptions"
            description="All catalog products, wholesale margins, and WhatsApp stock guardrails are in sync. When a supplier updates pricing or items run low, action items will appear here."
            action={{
              label: "Manage Inventory",
              onClick: () => setActiveTab("my-inventory"),
            }}
          />
        ) : (
          <div className="space-y-3">
            {sellingExceptions.map((ex) => (
              <div
                key={ex.id}
                className="bg-white rounded-2xl border border-amber-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        ex.kind === "OUT_OF_STOCK"
                          ? "bg-rose-100 text-rose-800"
                          : ex.kind === "LOW_MARGIN"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {ex.kind.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[11px] text-gray-400">
                      {ex.sku}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {ex.title}
                  </h3>
                  <p className="text-xs text-gray-500">{ex.detail}</p>
                </div>
                {ex.product && (
                  <button
                    onClick={() => {
                      setEditingProduct(ex.product!);
                      setEditorModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                  >
                    Fix in Editor
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <ProductEditorModal
          isOpen={editorModalOpen}
          product={editingProduct}
          existingProducts={products}
          onClose={() => {
            setEditorModalOpen(false);
            setEditingProduct(null);
          }}
          onDelete={onDeleteProduct}
          onSave={async (data) => {
            if (editingProduct && onUpdateProduct) {
              await onUpdateProduct(editingProduct.skuCode, {
                name: data.name,
                description: data.description,
                category: data.category,
                priceNaira: data.priceNaira,
                stockTotal: data.stockTotal,
                primaryImageUrl: data.primaryImageUrl,
                variants: data.variants,
                customFields: data.customFields,
              });
            } else if (editingProduct) {
              await onUpdateStock(editingProduct.skuCode, data.stockTotal);
            } else {
              await onAddProduct({
                name: data.name,
                skuCode: data.skuCode,
                description: data.description,
                category: data.category,
                priceNaira: data.priceNaira,
                stockTotal: data.stockTotal,
                primaryImageUrl: data.primaryImageUrl,
                variants: data.variants,
                customFields: data.customFields,
              });
            }
            return true;
          }}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 4: Products · Reselling                                             */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "reselling") {
    const uniqueResellSuppliers = Array.from(
      new Set(resellingList.map((i) => i.supplier)),
    );
    const filteredReselling = resellingList.filter((item) => {
      if (searchReselling.trim()) {
        const q = searchReselling.toLowerCase();
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.sku.toLowerCase().includes(q) &&
          !(item.catalogSku || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (selectedSupplier !== "ALL" && item.supplier !== selectedSupplier)
        return false;
      if (selectedStatus === "In stock" && item.stock <= 0) return false;
      if (selectedStatus === "Paused" && item.status !== "Paused") return false;
      return true;
    });

    const totalProfitSum = resellingList.reduce(
      (acc, i) => acc + (i.sellingPrice - i.cost),
      0,
    );
    const totalSellingSum = resellingList.reduce(
      (acc, i) => acc + (i.sellingPrice || 0),
      0,
    );
    const avgMarginPct =
      totalSellingSum > 0
        ? Math.round((totalProfitSum / totalSellingSum) * 100)
        : 0;
    const avgProfitNaira =
      resellingList.length > 0
        ? Math.round(totalProfitSum / resellingList.length)
        : 0;
    const syncedCount = resellingList.filter(
      (i) => i.status === "Synced",
    ).length;
    const pausedCount = resellingList.length - syncedCount;
    const lowStockOrMarginAlerts = resellingList.filter(
      (i) => i.stock <= 5 || i.sellingPrice <= i.cost,
    );

    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Reselling
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Your retail prices, wholesale supplier inventory, and live margin
              tracking.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/80 border border-emerald-200/60 rounded-lg text-emerald-800 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Sync Active</span>
            </div>
            <button
              onClick={() => {
                if (onNavigateToNetwork) onNavigateToNetwork("find-suppliers");
                else setActiveTab("mirror-wizard");
              }}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-medium text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Find more products</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
          <button
            onClick={() => setActiveTab("all")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            All products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            My inventory (
            {products.filter((p) => !p.customFields?.supplierSku).length})
          </button>
          <button
            onClick={() => setActiveTab("reselling")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer"
          >
            Reselling ({resellingList.length})
          </button>
          <button
            onClick={() => setActiveTab("exceptions")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            Selling exceptions ({sellingExceptions.length})
          </button>
        </div>

        {resellingList.length === 0 ? (
          <EmptyState
            badge="Wholesale Network"
            icon="🤝"
            title="No Supplier Products Mirrored Yet"
            description="You haven't connected with wholesale suppliers yet. Browse the Network directory to discover verified Nigerian importers and mirror their products with zero inventory capital."
            action={
              onNavigateToNetwork
                ? {
                    label: "Explore Supplier Directory",
                    onClick: () => onNavigateToNetwork("find-suppliers"),
                  }
                : undefined
            }
          />
        ) : (
          <>
            {/* 3 Real-Time Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
                <div className="text-xs text-emerald-100 font-medium">
                  Linked products
                </div>
                <div className="text-3xl font-extrabold mt-1">
                  {resellingList.length}
                </div>
                <div className="text-[11px] text-emerald-200 mt-2">
                  Across {uniqueResellSuppliers.length} supplier
                  {uniqueResellSuppliers.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="text-xs text-gray-500 font-medium">
                  Average gross margin
                </div>
                <div className="text-3xl font-extrabold text-gray-900 mt-1">
                  {avgMarginPct}%
                </div>
                <div className="text-[11px] text-gray-400 mt-2">
                  ₦{avgProfitNaira.toLocaleString()} avg profit / unit
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="text-xs text-gray-500 font-medium">
                  Inventory sync
                </div>
                <div className="text-3xl font-extrabold text-gray-900 mt-1">
                  Live
                </div>
                <div className="text-[11px] text-gray-400 mt-2">
                  {syncedCount} active · {pausedCount} paused
                </div>
              </div>
            </div>

            {/* Linked listings table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">
                  Linked listings
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Supplier wholesale cost is locked; you control your retail
                  selling price and margin.
                </p>

                {/* Filter Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <input
                    type="text"
                    placeholder="Search name or SKU"
                    value={searchReselling}
                    onChange={(e) => setSearchReselling(e.target.value)}
                    className="text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="ALL">
                      All suppliers ({uniqueResellSuppliers.length})
                    </option>
                    {uniqueResellSuppliers.map((supName) => (
                      <option key={supName} value={supName}>
                        {supName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>All linked products</option>
                    <option>In stock</option>
                    <option>Paused</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Listing</th>
                      <th className="px-4 py-3">Source / Stock</th>
                      <th className="px-4 py-3">Wholesale Cost</th>
                      <th className="px-4 py-3">Your Price</th>
                      <th className="px-4 py-3">Profit / Unit</th>
                      <th className="px-5 py-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredReselling.map((item) => {
                      const profit = item.sellingPrice - item.cost;
                      const marginPct =
                        item.sellingPrice > 0
                          ? Math.round((profit / item.sellingPrice) * 100)
                          : 0;
                      const supInfo = suppliers.find(
                        (s) => s.name === item.supplier,
                      );
                      const inheritedShipping = supInfo
                        ? `${supInfo.shippingScope === "NATIONWIDE" ? "Nationwide" : supInfo.coveredStates?.join(", ") || supInfo.state} · ${supInfo.leadTime || "Standard dispatch"}`
                        : "Inherited from supplier";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-gray-900">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              {item.catalogSku
                                ? `${item.catalogSku} · Sup: ${item.sku}`
                                : item.sku}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-gray-900 font-medium">
                              {item.supplier}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              🚚 {inheritedShipping}
                            </div>
                            <div
                              className={`text-[11px] font-medium ${
                                item.status === "Paused"
                                  ? "text-amber-700"
                                  : item.stock <= 5
                                    ? "text-rose-600"
                                    : "text-emerald-700"
                              }`}
                            >
                              {item.stock} in stock · {item.status}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium">
                            ₦{item.cost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-900">
                            ₦{item.sellingPrice.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5">
                            <div
                              className={`font-semibold ${profit > 0 ? "text-emerald-700" : "text-rose-600"}`}
                            >
                              ₦{profit.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {marginPct}% margin
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingResellItem(item);
                                setEditingResellPrice(
                                  String(item.sellingPrice),
                                );
                              }}
                              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg cursor-pointer"
                            >
                              Edit price
                            </button>
                            <button
                              onClick={() => handleToggleListingPause(item.sku)}
                              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg cursor-pointer"
                            >
                              {item.status === "Paused" ? "Resume" : "Pause"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400">
                Showing {filteredReselling.length} of {resellingList.length}{" "}
                linked products · Published to storefront and WhatsApp
              </div>
            </div>

            {/* Bottom 2 Columns: Live Guardrails & Inventory Ownership */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900">
                    Stock &amp; margin guardrails
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      lowStockOrMarginAlerts.length > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {lowStockOrMarginAlerts.length > 0
                      ? `${lowStockOrMarginAlerts.length} attention needed`
                      : "All healthy"}
                  </span>
                </div>

                {lowStockOrMarginAlerts.length === 0 ? (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    All mirrored supplier products have healthy wholesale
                    margins and sufficient stock levels.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lowStockOrMarginAlerts.map((alertItem) => (
                      <div
                        key={alertItem.id}
                        className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-amber-900">
                            {alertItem.name}
                          </div>
                          <div className="text-[11px] text-amber-800">
                            {alertItem.sellingPrice <= alertItem.cost
                              ? `Retail ₦${alertItem.sellingPrice.toLocaleString()} is not above cost ₦${alertItem.cost.toLocaleString()}`
                              : `Low supplier stock: ${alertItem.stock} units remaining`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingResellItem(alertItem);
                            setEditingResellPrice(
                              String(alertItem.sellingPrice),
                            );
                          }}
                          className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Adjust
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setActiveTab("exceptions")}
                    className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Review selling exceptions ({sellingExceptions.length}) →
                  </button>
                </div>
              </div>

              {/* Inventory ownership */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
                <h3 className="text-xs font-bold text-gray-900">
                  Inventory ownership
                </h3>

                <div className="divide-y divide-gray-100">
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Stock owner</span>
                    <span className="font-semibold text-gray-900">
                      {uniqueResellSuppliers[0] || "Wholesale Supplier"}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Stock editing</span>
                    <span className="font-semibold text-gray-900">
                      Supplier only
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Reseller control</span>
                    <span className="font-semibold text-gray-900">
                      Retail price &amp; channels
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400">
                  Pausing your listing stops new checkouts; it does not cancel
                  confirmed orders.
                </p>

                <button
                  onClick={() => {
                    if (onNavigateToNetwork)
                      onNavigateToNetwork("my-suppliers");
                    else setActiveTab("mirror-wizard");
                  }}
                  className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  View supplier catalog
                </button>
              </div>
            </div>
          </>
        )}

        {/* Per-Item Retail Price Editor Modal */}
        {editingResellItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <form
              onSubmit={handleSaveResellPrice}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Edit Reselling Price
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {editingResellItem.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingResellItem(null)}
                  className="text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 space-y-1.5 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier wholesale cost</span>
                  <span className="font-semibold text-gray-900">
                    ₦{editingResellItem.cost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Projected profit / unit</span>
                  <span
                    className={`font-bold ${
                      (Number(editingResellPrice) || 0) -
                        editingResellItem.cost >
                      0
                        ? "text-emerald-700"
                        : "text-rose-600"
                    }`}
                  >
                    ₦
                    {(
                      (Number(editingResellPrice) || 0) - editingResellItem.cost
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Your Retail Selling Price (₦)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editingResellPrice}
                  onChange={(e) => setEditingResellPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingResellItem(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResellPrice}
                  className="px-5 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white rounded-lg font-semibold cursor-pointer"
                >
                  {savingResellPrice ? "Saving..." : "Save Price"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen: All Products / My Inventory (Original Catalog with tabs)           */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Products
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your digital inventory and live WhatsApp catalog.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50/80 border border-emerald-200/60 rounded-lg text-emerald-800 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>WhatsApp Catalog Live Sync</span>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              setEditorModalOpen(true);
            }}
            className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Product &amp; Variants</span>
          </button>
        </div>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 cursor-pointer ${activeTab === "all" ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold" : "text-gray-500 hover:text-gray-900"}`}
        >
          All products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("my-inventory")}
          className={`pb-2.5 cursor-pointer ${activeTab === "my-inventory" ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold" : "text-gray-500 hover:text-gray-900"}`}
        >
          My inventory (
          {products.filter((p) => !p.customFields?.supplierSku).length})
        </button>
        {workspaceRole !== "supplier" && (
          <button
            onClick={() => setActiveTab("reselling")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            Reselling ({resellingList.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab("exceptions")}
          className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
        >
          Selling exceptions ({sellingExceptions.length})
        </button>
      </div>

      {/* Add New Product Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-900">Add New Product</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Create a new item in your digital catalog for customers to browse
              and order.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. 750ml Stainless Flask"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Auto-Generated SKU
                  </label>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    Structured
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={buildStructuredSku(name, "General", products)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-4 py-2 text-xs font-mono font-bold text-emerald-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Price (NGN)
                </label>
                <input
                  type="number"
                  placeholder="10000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold py-2 px-5 rounded-lg"
            >
              {saving ? "Saving..." : "Save Product"}
            </button>
          </form>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      {products.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            className="flex-1 text-xs px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600"
          />
          <select
            value={catalogCategory}
            onChange={(e) => setCatalogCategory(e.target.value)}
            className="text-xs px-3.5 py-2 bg-white border border-gray-200 rounded-xl sm:w-52"
          >
            <option value="ALL">All Categories</option>
            {Array.from(
              new Set(products.map((p) => p.category || "General")),
            ).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Products Grid */}
      {(() => {
        const baseList =
          activeTab === "my-inventory"
            ? products.filter((p) => !p.customFields?.supplierSku)
            : products;
        const displayedProducts = baseList.filter((p) => {
          if (catalogSearch.trim()) {
            const q = catalogSearch.toLowerCase();
            if (
              !p.name.toLowerCase().includes(q) &&
              !p.skuCode.toLowerCase().includes(q)
            ) {
              return false;
            }
          }
          if (
            catalogCategory !== "ALL" &&
            (p.category || "General") !== catalogCategory
          ) {
            return false;
          }
          return true;
        });

        if (baseList.length === 0) {
          return (
            <EmptyState
              badge="Product Catalog"
              icon="📦"
              title={
                activeTab === "my-inventory"
                  ? "No Own Inventory Products Yet"
                  : "Your Product Catalog is Empty"
              }
              description="Add products with prices and inventory to begin selling. Your AI Sales Co-Pilot will automatically reference them during WhatsApp conversations, invoice generation, and status checkouts."
              action={{
                label: "Add Your First Product",
                icon: <PlusIcon className="w-4 h-4" />,
                onClick: () => {
                  setEditingProduct(null);
                  setEditorModalOpen(true);
                },
              }}
              secondaryAction={
                onNavigateToNetwork
                  ? {
                      label: "Explore Wholesale Suppliers",
                      onClick: () => onNavigateToNetwork("find-suppliers"),
                    }
                  : undefined
              }
            />
          );
        }

        if (displayedProducts.length === 0) {
          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-xs text-gray-500">
              No products match your search or category filter.
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setEditingProduct(p);
                  setEditorModalOpen(true);
                }}
                className="bg-white rounded-2xl border border-gray-100 hover:border-gray-300 overflow-hidden shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="h-44 bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden relative">
                  {p.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(p.primaryImageUrl)}
                      alt={p.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="text-3xl">📦</div>
                  )}
                  {p.customFields?.supplierSku && (
                    <span className="absolute top-2.5 right-2.5 bg-emerald-900/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      Mirrored · {p.customFields.supplierName || "Supplier"}
                    </span>
                  )}
                  {p.variants && p.variants.length > 0 && (
                    <span className="absolute top-2.5 left-2.5 bg-gray-900/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <span>🎛️</span>
                      <span>{p.variants.length} Variants</span>
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm group-hover:text-emerald-700 transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] font-mono text-gray-400">
                          {p.skuCode}
                        </span>
                        {p.category && (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {p.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-emerald-800 text-sm">
                        {(() => {
                          const variantPrices =
                            p.variants
                              ?.map((v) => v.priceNaira)
                              .filter(
                                (pr): pr is number =>
                                  typeof pr === "number" && pr > 0,
                              ) || [];
                          if (variantPrices.length > 0) {
                            const minP = Math.min(...variantPrices);
                            const maxP = Math.max(...variantPrices);
                            if (minP !== maxP) {
                              return `₦${minP.toLocaleString()} - ₦${maxP.toLocaleString()}`;
                            }
                          }
                          return (
                            p.basePriceFormatted ||
                            `₦${p.basePriceNaira.toLocaleString()}`
                          );
                        })()}
                      </div>
                      {onDeleteProduct && (
                        <button
                          type="button"
                          title="Delete product"
                          onClick={(e) => {
                            e.stopPropagation();
                            const confirmed = window.confirm(
                              `Delete product "${p.name}" (${p.skuCode})?\n\nThis will remove it from Caterlog and sync it off your WhatsApp Catalog.`,
                            );
                            if (confirmed) {
                              void onDeleteProduct(p.skuCode);
                            }
                          }}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Variable Products Breakdown Chips with Individual Prices */}
                  {p.variants && p.variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.variants.map((v) => (
                        <span
                          key={v.id || v.sku}
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200"
                        >
                          <span className="font-semibold">{v.name}</span>
                          <span className="text-gray-400">·</span>
                          <span className="font-bold text-gray-900">
                            {v.priceFormatted ||
                              `₦${(v.priceNaira ?? p.basePriceNaira).toLocaleString()}`}
                          </span>
                          <span className="text-gray-400">·</span>
                          <span className="font-mono text-emerald-700 font-bold">
                            {v.availableStock !== undefined
                              ? v.availableStock
                              : v.stock}{" "}
                            left
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom Fields / Attributes Chips */}
                  {p.customFields && Object.keys(p.customFields).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(p.customFields).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-gray-50 text-gray-700 border border-gray-200"
                        >
                          <span className="font-semibold text-gray-500">
                            {key}:
                          </span>
                          <span className="font-medium text-gray-900">
                            {val}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                    <span className="text-gray-500">
                      Total stock available:
                    </span>
                    <span className="font-bold text-gray-900">
                      {p.availableStock} units
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Full Product & Variant Editor Modal */}
      <ProductEditorModal
        isOpen={editorModalOpen}
        product={editingProduct}
        existingProducts={products}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingProduct(null);
        }}
        onDelete={onDeleteProduct}
        onSave={async (data) => {
          if (editingProduct && onUpdateProduct) {
            await onUpdateProduct(editingProduct.skuCode, {
              name: data.name,
              description: data.description,
              category: data.category,
              priceNaira: data.priceNaira,
              stockTotal: data.stockTotal,
              primaryImageUrl: data.primaryImageUrl,
              variants: data.variants,
              customFields: data.customFields,
            });
          } else if (editingProduct) {
            await onUpdateStock(editingProduct.skuCode, data.stockTotal);
          } else {
            await onAddProduct({
              name: data.name,
              skuCode: data.skuCode,
              description: data.description,
              category: data.category,
              priceNaira: data.priceNaira,
              stockTotal: data.stockTotal,
              primaryImageUrl: data.primaryImageUrl,
              variants: data.variants,
              customFields: data.customFields,
            });
          }
          return true;
        }}
      />
    </div>
  );
}
