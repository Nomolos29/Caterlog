"use client";

import React, { useState } from "react";
import type { ProductItem } from "@/lib/types";
import { PlusIcon } from "../icons";
import { ProductEditorModal } from "./product-editor-modal";
import { EmptyState } from "../ui/empty-state";
import { resolveImageUrl } from "@/lib/api";

interface ProductsViewProps {
  products: ProductItem[];
  initialTab?: "all" | "my-inventory" | "reselling" | "exceptions" | "mirror-wizard";
  onAddProduct: (input: {
    skuCode?: string;
    name: string;
    priceNaira: number;
    stockTotal: number;
    primaryImageUrl?: string;
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
      priceNaira?: number;
      stockTotal?: number;
      primaryImageUrl?: string;
      variants?: Array<{
        id?: string;
        name: string;
        skuCode?: string;
        priceNaira?: number;
        stockTotal: number;
      }>;
    }
  ) => Promise<boolean>;
  onUpdateStock: (sku: string, stock: number) => Promise<boolean>;
  onDeleteProduct?: (skuCode: string) => Promise<boolean>;
  onNavigateToNetwork?: (tab?: string) => void;
  onNavigateToSettings?: (tab?: string, subId?: string) => void;
  onSyncWhatsAppCatalog?: () => Promise<{
    attempted: number;
    upserted: number;
    deleted: number;
    mode: string;
    catalogId: string | null;
  } | null>;
}

interface ResellingItem {
  id: string;
  name: string;
  sku: string;
  supplier: string;
  stock: number;
  cost: number;
  sellingPrice: number;
  status: "Synced" | "Paused";
}

const INITIAL_RESELLING: ResellingItem[] = [];

export function ProductsView({
  products,
  initialTab = "my-inventory",
  onAddProduct,
  onUpdateProduct,
  onUpdateStock,
  onDeleteProduct,
  onNavigateToNetwork,
  onNavigateToSettings,
  onSyncWhatsAppCatalog,
}: ProductsViewProps) {
  // Tabs: 'all' | 'my-inventory' | 'reselling' | 'exceptions' | 'mirror-wizard'
  const [activeTab, setActiveTab] = useState<"all" | "my-inventory" | "reselling" | "exceptions" | "mirror-wizard">(initialTab);
  const [resellingList, setResellingList] = useState<ResellingItem[]>(INITIAL_RESELLING);

  // WhatsApp catalog sync state
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSyncCatalog = async () => {
    if (!onSyncWhatsAppCatalog) return;
    setSyncingCatalog(true);
    try {
      const res = await onSyncWhatsAppCatalog();
      if (res) {
        const parts = [`${res.upserted} product(s) synced`];
        if (res.deleted > 0) parts.push(`${res.deleted} deleted`);
        setSyncToast(
          `✓ WhatsApp Catalog in Sync! ${parts.join(", ")} with Meta (${res.mode} mode).`
        );
        setTimeout(() => setSyncToast(null), 4000);
      }
    } finally {
      setSyncingCatalog(false);
    }
  };

  // Reselling state
  const [searchReselling, setSearchReselling] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("Aroko Wholesale");
  const [selectedStatus, setSelectedStatus] = useState("All linked products");

  // Mirror & Set Margins Wizard state
  const [flaskPrice, setFlaskPrice] = useState("10000");
  const [lunchBoxPrice, setLunchBoxPrice] = useState("7500");
  const [jarPrice, setJarPrice] = useState("4000");
  const [storefrontChannel, setStorefrontChannel] = useState(true);
  const [whatsappChannel, setWhatsappChannel] = useState(true);
  const [instagramChannel, setInstagramChannel] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(false);

  // Exceptions Workbench state
  const [exceptionFilter, setExceptionFilter] = useState<"all" | "price" | "stock" | "automation">("all");
  const [proposedPrice, setProposedPrice] = useState("10500");
  const [exception1Resolved, setException1Resolved] = useState(false);
  const [stockRechecked, setStockRechecked] = useState(false);
  const [customerNotified, setCustomerNotified] = useState(false);
  const [supplierMsgModal, setSupplierMsgModal] = useState(false);
  const [supplierMsgText, setSupplierMsgText] = useState("Hi Aroko Wholesale, can you confirm if same-day delivery to Lekki before 4pm is feasible for Order CT-1042?");
  const [supplierMsgSent, setSupplierMsgSent] = useState(false);
  const [internalNote, setInternalNote] = useState("Awaiting supplier delivery confirmation");

  // Product Editor & Add Modal
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

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
        if (item.sku === "AW-FL750") return { ...item, sellingPrice: Number(flaskPrice) || item.sellingPrice };
        if (item.sku === "AW-LB1200") return { ...item, sellingPrice: Number(lunchBoxPrice) || item.sellingPrice };
        if (item.sku === "AW-SJ1000") return { ...item, sellingPrice: Number(jarPrice) || item.sellingPrice };
        return item;
      })
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
          : item
      )
    );
  };

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
            Link products from verified wholesale suppliers and set your custom retail markup.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
            🤝
          </div>
          <h3 className="text-base font-bold text-gray-900">No Supplier Products Selected</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Visit the Supplier Network directory to select items from verified wholesale importers before configuring retail markup.
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
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div>
          <div className="text-xs text-gray-500 mb-1">
            Products / Reselling / Selling exceptions
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Selling exceptions</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Resolve changes that affect linked listings, checkout and automated selling.
          </p>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
          <button
            onClick={() => setActiveTab("all")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            All products
          </button>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            My inventory
          </button>
          <button
            onClick={() => setActiveTab("reselling")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            Reselling ({resellingList.length})
          </button>
          <button
            onClick={() => setActiveTab("exceptions")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer"
          >
            Selling exceptions (0)
          </button>
        </div>

        {/* Clean Empty State */}
        <EmptyState
          badge="In Sync"
          icon="✓"
          title="No Selling Exceptions"
          description="All catalog products, wholesale prices, and WhatsApp stock guardrails are in sync. When a supplier updates pricing or items run low, action items will appear here."
          action={{
            label: "Manage Inventory",
            onClick: () => setActiveTab("my-inventory"),
          }}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 4: Products · Reselling                                             */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "reselling") {
    const filteredReselling = resellingList.filter((item) => {
      if (searchReselling.trim()) {
        const q = searchReselling.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (selectedStatus === "In stock" && item.stock <= 0) return false;
      if (selectedStatus === "Paused" && item.status !== "Paused") return false;
      return true;
    });

    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reselling</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Your prices. Supplier inventory. Every linked listing stays in sync.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleSyncCatalog}
              disabled={syncingCatalog}
              className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
              title="Push product pricing and stock updates to WhatsApp Business Catalog"
            >
              <span className={syncingCatalog ? "animate-spin" : ""}>🔄</span>
              <span>{syncingCatalog ? "Syncing..." : "Sync WhatsApp Catalog"}</span>
            </button>
            <button
              onClick={() => {
                if (onNavigateToNetwork) onNavigateToNetwork("catalog");
                else setActiveTab("mirror-wizard");
              }}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-medium text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Find more products</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {syncToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
            <span>✓</span>
            <span>{syncToast}</span>
          </div>
        )}

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
          <button
            onClick={() => setActiveTab("all")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            All products
          </button>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            My inventory
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
            Selling exceptions (0)
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
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-emerald-100 font-medium">Linked products</div>
            <div className="text-3xl font-extrabold mt-1">{resellingList.length}</div>
            <div className="text-[11px] text-emerald-200 mt-2">From Aroko Wholesale</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Featured gross margin</div>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">20%</div>
            <div className="text-[11px] text-gray-400 mt-2">₦2,000 per flask before fees</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Inventory sync</div>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">Live</div>
            <div className="text-[11px] text-gray-400 mt-2">Last checked just now</div>
          </div>
        </div>

        {/* Linked listings table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Linked listings</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Master stock is read-only. Available units are shared across resellers.
            </p>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <input
                type="text"
                placeholder="Name or supplier SKU"
                value={searchReselling}
                onChange={(e) => setSearchReselling(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option>Aroko Wholesale</option>
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
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Listing</th>
                  <th className="px-4 py-3">Source / Stock</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Your Price</th>
                  <th className="px-4 py-3">Profit / Unit</th>
                  <th className="px-5 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredReselling.map((item) => {
                  const profit = item.sellingPrice - item.cost;
                  const marginPct = Math.round((profit / item.sellingPrice) * 100);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-[11px] text-gray-400">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-gray-900">{item.supplier}</div>
                        <div
                          className={`text-[11px] font-medium ${
                            item.status === "Paused" ? "text-amber-700" : "text-emerald-700"
                          }`}
                        >
                          {item.stock} · {item.status}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium">₦{item.cost.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-bold text-gray-900">
                        ₦{item.sellingPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-emerald-700">₦{profit.toLocaleString()}</div>
                        <div className="text-[11px] text-gray-400">{marginPct}% margin</div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setActiveTab("mirror-wizard")}
                          className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                        >
                          Edit price
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400">
            Showing {filteredReselling.length} of {resellingList.length} linked products · Published to storefront and WhatsApp
          </div>
        </div>

        {/* Bottom 2 Columns: Alerts & Inventory Ownership */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock & price-change alerts */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900">Stock &amp; price-change alerts</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Scenario preview
              </span>
            </div>
            <p className="text-xs text-gray-500">
              A supplier cost change can reduce your margin. Low stock can stop checkout before payment.
            </p>

            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠</span>
                <span>Separate scenario: flask cost changed</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                ₦8,000 → ₦8,500. At ₦10,000 resale, gross profit changes from ₦2,000 to ₦1,500 per unit. This is not the price on paid order CT-1042.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setActiveTab("exceptions")}
                className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Review selling exceptions →
              </button>
              <button
                onClick={() => handleToggleListingPause("AW-FL750")}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
              >
                {resellingList.find((i) => i.sku === "AW-FL750")?.status === "Paused"
                  ? "Resume listing"
                  : "Pause listing"}
              </button>
            </div>
          </div>

          {/* Inventory ownership */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-gray-900">Inventory ownership</h3>

            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Stock owner</span>
                <span className="font-semibold text-gray-900">Aroko Wholesale</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Stock editing</span>
                <span className="font-semibold text-gray-900">Supplier only</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Rep permissions</span>
                <span className="font-semibold text-gray-900">Price &amp; channels</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400">
              Pausing your listing stops new checkouts; it does not cancel confirmed orders.
            </p>

            <button
              onClick={() => {
                if (onNavigateToNetwork) onNavigateToNetwork("catalog");
                else setActiveTab("mirror-wizard");
              }}
              className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              View supplier catalog
            </button>
          </div>
        </div>
        </>
      )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen: All Products / My Inventory (Original Catalog with tabs)           */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your digital inventory and live WhatsApp catalog.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleSyncCatalog}
            disabled={syncingCatalog}
            className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Push product pricing and stock updates to WhatsApp Business Catalog"
          >
            <span className={syncingCatalog ? "animate-spin" : ""}>🔄</span>
            <span>{syncingCatalog ? "Syncing..." : "Sync WhatsApp Catalog"}</span>
          </button>
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

      {syncToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <span>✓</span>
          <span>{syncToast}</span>
        </div>
      )}

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 cursor-pointer ${activeTab === "all" ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold" : "text-gray-500 hover:text-gray-900"}`}
        >
          All products
        </button>
        <button
          onClick={() => setActiveTab("my-inventory")}
          className={`pb-2.5 cursor-pointer ${activeTab === "my-inventory" ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold" : "text-gray-500 hover:text-gray-900"}`}
        >
          My inventory
        </button>
        <button
          onClick={() => setActiveTab("reselling")}
          className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
        >
          Reselling ({resellingList.length})
        </button>
        <button
          onClick={() => setActiveTab("exceptions")}
          className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
        >
          Selling exceptions (0)
        </button>
      </div>

      {/* Add New Product Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-900">Add New Product</h2>
            <p className="text-xs text-gray-400 mt-0.5">Create a new item in your digital catalog for customers to browse and order.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. 750ml Stainless Flask"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Price (NGN)</label>
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

      {/* Products Grid */}
      {products.length === 0 ? (
        <EmptyState
          badge="Product Catalog"
          icon="📦"
          title="Your Product Catalog is Empty"
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
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
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">{p.skuCode}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-emerald-800 text-sm">
                      {(() => {
                        const variantPrices =
                          p.variants
                            ?.map((v) => v.priceNaira)
                            .filter((pr): pr is number => typeof pr === "number" && pr > 0) || [];
                        if (variantPrices.length > 0) {
                          const minP = Math.min(...variantPrices);
                          const maxP = Math.max(...variantPrices);
                          if (minP !== maxP) {
                            return `₦${minP.toLocaleString()} - ₦${maxP.toLocaleString()}`;
                          }
                        }
                        return p.basePriceFormatted || `₦${p.basePriceNaira.toLocaleString()}`;
                      })()}
                    </div>
                    {onDeleteProduct && (
                      <button
                        type="button"
                        title="Delete product"
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmed = window.confirm(
                            `Delete product "${p.name}" (${p.skuCode})?\n\nThis will remove it from Caterlog and sync it off your WhatsApp Catalog.`
                          );
                          if (confirmed) {
                            void onDeleteProduct(p.skuCode);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
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
                          {v.priceFormatted || `₦${(v.priceNaira ?? p.basePriceNaira).toLocaleString()}`}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {v.availableStock !== undefined ? v.availableStock : v.stock} left
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                  <span className="text-gray-500">Total stock available:</span>
                  <span className="font-bold text-gray-900">{p.availableStock} units</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Product & Variant Editor Modal */}
      <ProductEditorModal
        isOpen={editorModalOpen}
        product={editingProduct}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingProduct(null);
        }}
        onDelete={onDeleteProduct}
        onSave={async (data) => {
          if (editingProduct && onUpdateProduct) {
            await onUpdateProduct(editingProduct.skuCode, {
              name: data.name,
              priceNaira: data.priceNaira,
              stockTotal: data.stockTotal,
              primaryImageUrl: data.primaryImageUrl,
              variants: data.variants,
            });
          } else if (editingProduct) {
            await onUpdateStock(editingProduct.skuCode, data.stockTotal);
          } else {
            await onAddProduct({
              name: data.name,
              skuCode: data.skuCode,
              priceNaira: data.priceNaira,
              stockTotal: data.stockTotal,
              primaryImageUrl: data.primaryImageUrl,
              variants: data.variants,
            });
          }
          return true;
        }}
      />
    </div>
  );
}
