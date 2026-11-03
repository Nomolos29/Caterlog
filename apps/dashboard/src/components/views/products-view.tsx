"use client";

import React, { useState } from "react";
import type { ProductItem } from "@/lib/types";
import { PlusIcon } from "../icons";

interface ProductsViewProps {
  products: ProductItem[];
  onAddProduct: (input: {
    skuCode?: string;
    name: string;
    priceNaira: number;
    stockTotal: number;
    primaryImageUrl?: string;
  }) => Promise<boolean>;
  onUpdateStock: (sku: string, stock: number) => Promise<boolean>;
  onNavigateToNetwork?: () => void;
}

export function ProductsView({
  products,
  onAddProduct,
  onUpdateStock,
  onNavigateToNetwork,
}: ProductsViewProps) {
  // Tabs: 'all' | 'my-inventory' | 'reselling' | 'exceptions' | 'mirror-wizard'
  const [activeTab, setActiveTab] = useState<"all" | "my-inventory" | "reselling" | "exceptions" | "mirror-wizard">("reselling");

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

  // Exceptions Workbench filter
  const [exceptionFilter, setExceptionFilter] = useState<"all" | "price" | "stock" | "automation">("all");
  const [proposedPrice, setProposedPrice] = useState("10500");
  const [exception1Resolved, setException1Resolved] = useState(false);
  const [stockRechecked, setStockRechecked] = useState(false);
  const [internalNote, setInternalNote] = useState("Awaiting supplier delivery confirmation");

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

  /* -------------------------------------------------------------------------- */
  /* Screen 5: Products · Mirror and set margins (Wizard)                        */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "mirror-wizard") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Breadcrumb & Title */}
        <div>
          <div className="text-xs text-gray-500 mb-1">
            Network / Aroko Wholesale / Mirror products
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Mirror products &amp; set margins
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose what Nia Stores charges. Supplier costs and master stock stay linked.
          </p>
        </div>

        {/* 3-Step Wizard Navigation */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            ✓ Select products
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            2 Set prices
          </span>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500">
            3 Review &amp; publish
          </span>
        </div>

        {/* Linked products configuration table */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Your linked products</h3>
            <p className="text-xs text-gray-400">Supplier: Aroko Wholesale · Open catalog · No approval needed</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Product / Supplier SKU</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Selling Price</th>
                  <th className="px-4 py-3">Markup</th>
                  <th className="px-4 py-3 text-right">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {/* Flask */}
                <tr>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-gray-900">Stainless flask · 750ml</div>
                    <div className="text-[11px] text-gray-400">AW-FL750</div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">₦8,000</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400">NGN</span>
                      <input
                        type="number"
                        value={flaskPrice}
                        onChange={(e) => setFlaskPrice(e.target.value)}
                        className="w-28 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {Math.round(((Number(flaskPrice) - 8000) / 8000) * 100)}%
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                    ₦{(Number(flaskPrice) - 8000).toLocaleString()} · {Math.round(((Number(flaskPrice) - 8000) / Number(flaskPrice)) * 100)}%
                  </td>
                </tr>

                {/* Lunch Box */}
                <tr>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-gray-900">Lunch box · 1.2L</div>
                    <div className="text-[11px] text-gray-400">AW-LB1200</div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">₦6,000</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400">NGN</span>
                      <input
                        type="number"
                        value={lunchBoxPrice}
                        onChange={(e) => setLunchBoxPrice(e.target.value)}
                        className="w-28 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {Math.round(((Number(lunchBoxPrice) - 6000) / 6000) * 100)}%
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                    ₦{(Number(lunchBoxPrice) - 6000).toLocaleString()} · {Math.round(((Number(lunchBoxPrice) - 6000) / Number(lunchBoxPrice)) * 100)}%
                  </td>
                </tr>

                {/* Storage jar */}
                <tr>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-gray-900">Storage jar · 1L</div>
                    <div className="text-[11px] text-gray-400">AW-SJ1000</div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">₦3,000</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400">NGN</span>
                      <input
                        type="number"
                        value={jarPrice}
                        onChange={(e) => setJarPrice(e.target.value)}
                        className="w-28 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {Math.round(((Number(jarPrice) - 3000) / 3000) * 100)}%
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                    ₦{(Number(jarPrice) - 3000).toLocaleString()} · {Math.round(((Number(jarPrice) - 3000) / Number(jarPrice)) * 100)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 pt-1">
            Markup = profit ÷ cost. Margin = profit ÷ selling price. Gross margin excludes fees.
          </p>
        </div>

        {/* 2 Column Bottom: Channels & Review */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Channels & Price Validation */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Choose selling channels</h3>

              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Caterlog storefront</div>
                  <div className="text-[11px] text-gray-400">Publish all 3 products to Nia Stores.</div>
                </div>
                <button
                  onClick={() => setStorefrontChannel(!storefrontChannel)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    storefrontChannel ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      storefrontChannel ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <div className="text-xs font-semibold text-gray-900">WhatsApp catalog</div>
                  <div className="text-[11px] text-gray-400">Connected · +234 800 000 0142</div>
                </div>
                <button
                  onClick={() => setWhatsappChannel(!whatsappChannel)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    whatsappChannel ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      whatsappChannel ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Instagram</div>
                  <div className="text-[11px] text-gray-400">Not connected · Connect in Settings before publishing.</div>
                </div>
                <button
                  onClick={() => setInstagramChannel(!instagramChannel)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    instagramChannel ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      instagramChannel ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Price validation alert */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠</span>
                <span>Price validation</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                A selling price below the supplier cost cannot be published. For the flask, enter at least ₦8,000; set a higher price to leave room for payment fees.
              </p>
            </div>
          </div>

          {/* Right: Review before publishing */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-gray-900">Review before publishing</h3>
            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Linked products</span>
                <span className="font-semibold text-gray-900">3</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Featured price</span>
                <span className="font-semibold text-gray-900">₦10,000 / flask</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Two-unit sale</span>
                <span className="font-semibold text-gray-900">₦20,000</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Supplier allocation</span>
                <span className="font-semibold text-gray-900">₦16,000</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Gross margin</span>
                <span className="font-semibold text-emerald-700">₦4,000</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Sample rep fee</span>
                <span className="font-semibold text-gray-900">₦300</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Net rep earnings</span>
                <span className="font-bold text-emerald-800">₦3,700</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400">
              Gateway account readiness is checked before a customer can pay.
            </p>
          </div>
        </div>

        {/* Sticky Bottom Wizard Bar */}
        <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 py-3 px-8 flex items-center justify-end gap-3 z-10 shadow-lg">
          {wizardSuccess && (
            <span className="text-xs font-semibold text-emerald-700 mr-auto">
              ✓ 3 products successfully published with live supplier sync!
            </span>
          )}
          <button
            onClick={() => setActiveTab("reselling")}
            className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Back to catalog
          </button>
          <button
            onClick={() => {
              setWizardSuccess(true);
              setTimeout(() => {
                setActiveTab("reselling");
                setWizardSuccess(false);
              }, 1200);
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0d5c3a] hover:bg-[#0b4b2f] rounded-lg transition-colors shadow-xs"
          >
            Publish 3 linked products
          </button>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 6: Products · Selling exceptions workbench                          */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "exceptions") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
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
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("all")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            All products
          </button>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            My inventory
          </button>
          <button
            onClick={() => setActiveTab("reselling")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Reselling (3)
          </button>
          <button
            onClick={() => setActiveTab("exceptions")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Selling exceptions (3)
          </button>
        </div>

        {/* Sub-Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setExceptionFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              exceptionFilter === "all" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-gray-100 text-gray-600"
            }`}
          >
            All exceptions (3)
          </button>
          <button
            onClick={() => setExceptionFilter("price")}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              exceptionFilter === "price" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-gray-100 text-gray-600"
            }`}
          >
            Price changes (1)
          </button>
          <button
            onClick={() => setExceptionFilter("stock")}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              exceptionFilter === "stock" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-gray-100 text-gray-600"
            }`}
          >
            Stock conflicts (1)
          </button>
          <button
            onClick={() => setExceptionFilter("automation")}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              exceptionFilter === "automation" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-gray-100 text-gray-600"
            }`}
          >
            Automation (1)
          </button>
        </div>

        {/* Top Info Banner */}
        <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl text-xs flex items-start gap-3">
          <span className="text-blue-600 font-bold">ℹ</span>
          <div className="text-blue-900">
            <span className="font-bold">Separate scenario examples</span>
            <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
              Each panel below is an independent operational example. They are not simultaneous stock or pricing states for paid order CT-1042. That order retains its original ₦8,000 supplier cost and ₦20,000 payment.
            </p>
          </div>
        </div>

        {/* Exception 1: Supplier-price change */}
        {(exceptionFilter === "all" || exceptionFilter === "price") && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Supplier-price change · scenario example
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Aroko Wholesale → Stainless flask · AW-FL750
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                {exception1Resolved ? "Resolved" : "Review required"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl text-xs">
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Current Supplier Cost</div>
                <div className="text-sm font-bold text-gray-900 mt-1">₦8,000</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">New Supplier Cost</div>
                <div className="text-sm font-bold text-rose-700 mt-1">₦8,500 <span className="text-xs text-gray-500 font-normal">· +₦500</span></div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Your Selling Price</div>
                <div className="text-sm font-bold text-gray-900 mt-1">₦10,000</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Gross Margin Impact</div>
                <div className="text-xs font-semibold text-amber-800 mt-1">
                  ₦2,000 → ₦1,500 / unit <br />
                  <span className="text-[10px] text-gray-500">20% → 15%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Proposed selling price (NGN)
                </label>
                <input
                  type="number"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Restores ₦2,000 gross profit per unit; margin becomes 19.0%.
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  New two-unit example: customer ₦21,000; supplier ₦17,000; reseller gross ₦4,000 before fees.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Listing paused for review. Accept the new supplier cost and confirm your price before reopening checkout.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setException1Resolved(true)}
                    className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    Accept &amp; apply ₦{Number(proposedPrice).toLocaleString()}
                  </button>
                  <button
                    onClick={() => alert("Listing remains paused")}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                  >
                    Keep paused
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  Existing paid orders keep their captured allocation. Review new checkouts only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Exception 2: Stock exhausted before payment */}
        {(exceptionFilter === "all" || exceptionFilter === "stock") && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Stock exhausted before payment · scenario example
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Draft checkout CT-D204 · 2 × Stainless flask
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                Checkout blocked
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 text-xs">
                <div className="divide-y divide-gray-100">
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Last viewed stock</span>
                    <span className="font-semibold text-gray-900">2 units</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Latest server check</span>
                    <span className="font-bold text-rose-600">0 available</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Payment status</span>
                    <span className="font-semibold text-gray-900">Not charged</span>
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-rose-800 flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>Do not collect payment for unavailable stock</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    The payment link is disabled after the final inventory check. No order allocation or supplier payout was created.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    disabled
                    className="px-3 py-1.5 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg cursor-not-allowed"
                  >
                    Checkout disabled
                  </button>
                  <button
                    onClick={() => {
                      setStockRechecked(true);
                      setTimeout(() => setStockRechecked(false), 2000);
                    }}
                    className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                  >
                    {stockRechecked ? "Rechecking..." : "Recheck stock"}
                  </button>
                </div>
              </div>

              {/* Customer notification preview */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-900">Customer notification preview</div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 leading-relaxed">
                  &ldquo;The flask sold out before payment completed. Your payment link has been disabled and you have not been charged. We can let you know when it is back in stock.&rdquo;
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => alert("Notification sent to customer on WhatsApp")}
                    className="px-3.5 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    Notify customer
                  </button>
                  <button
                    onClick={() => alert("Opening draft checkout CT-D204")}
                    className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                  >
                    View draft checkout
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  Notification not sent yet. Restock timing must be confirmed by the supplier.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Exception 3: Automation escalation */}
        {(exceptionFilter === "all" || exceptionFilter === "automation") && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Automation escalation · scenario example
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Settings / Sales co-pilot / WA-0882 · Actual unresolved request
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Needs merchant
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <div className="font-semibold text-gray-900 text-sm">
                  &ldquo;Can you deliver it to Lekki before 4pm today?&rdquo;
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Guardrail triggered</span>
                    <span className="font-semibold text-gray-900">Delivery commitment</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Order CT-1042</span>
                    <span className="font-semibold text-gray-900">Paid · Preparing for pickup</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Automation</span>
                    <span className="font-semibold text-amber-800">Paused in thread</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">
                  This is a new request after payment. Do not change the order&apos;s fulfillment terms without confirmation.
                </p>
              </div>

              <div className="space-y-3">
                <div className="font-bold text-gray-900">Confirm with supplier, then reply</div>
                <p className="text-gray-600 text-xs">
                  Contact Aroko about delivery feasibility and cost. Take over the conversation; automation remains paused until you choose to resume.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => alert("Redirecting to Settings Sales co-pilot conversation")}
                    className="px-3.5 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    Take over in Settings →
                  </button>
                  <button
                    onClick={() => alert("Opening supplier messaging modal")}
                    className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                  >
                    Message supplier
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Internal resolution note
                  </label>
                  <input
                    type="text"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 4: Products · Reselling                                             */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "reselling") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reselling</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Your prices. Supplier inventory. Every linked listing stays in sync.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("mirror-wizard")}
            className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-medium text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>Find more products</span>
            <span>→</span>
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("all")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            All products
          </button>
          <button
            onClick={() => setActiveTab("my-inventory")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            My inventory
          </button>
          <button
            onClick={() => setActiveTab("reselling")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Reselling (3)
          </button>
          <button
            onClick={() => setActiveTab("exceptions")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Selling exceptions (3)
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-emerald-100 font-medium">Linked products</div>
            <div className="text-3xl font-extrabold mt-1">3</div>
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
            <table className="w-full text-left text-xs">
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
                {/* 1. Flask */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Stainless flask · 750ml</div>
                    <div className="text-[11px] text-gray-400">AW-FL750</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-gray-900">Aroko Wholesale</div>
                    <div className="text-[11px] text-emerald-700 font-medium">42 · Synced</div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">₦8,000</td>
                  <td className="px-4 py-3.5 font-bold text-gray-900">₦10,000</td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-emerald-700">₦2,000</div>
                    <div className="text-[11px] text-gray-400">20% margin</div>
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

                {/* 2. Lunch box */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Lunch box · 1.2L</div>
                    <div className="text-[11px] text-gray-400">AW-LB1200</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-gray-900">Aroko Wholesale</div>
                    <div className="text-[11px] text-emerald-700 font-medium">28 · Synced</div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">₦6,000</td>
                  <td className="px-4 py-3.5 font-bold text-gray-900">₦7,500</td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-emerald-700">₦1,500</div>
                    <div className="text-[11px] text-gray-400">20% margin</div>
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

                {/* 3. Storage jar */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Storage jar · 1L</div>
                    <div className="text-[11px] text-gray-400">AW-SJ1000</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-gray-900">Aroko Wholesale</div>
                    <div className="text-[11px] text-emerald-700 font-medium">62 · Synced</div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">₦3,000</td>
                  <td className="px-4 py-3.5 font-bold text-gray-900">₦4,000</td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-emerald-700">₦1,000</div>
                    <div className="text-[11px] text-gray-400">25% margin</div>
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
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400">
            Showing 3 of 3 linked products · Published to storefront and WhatsApp
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

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setActiveTab("exceptions")}
                className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Review selling exceptions →
              </button>
              <button
                onClick={() => alert("Listing paused")}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                Pause listing
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
                if (onNavigateToNetwork) onNavigateToNetwork();
                else setActiveTab("mirror-wizard");
              }}
              className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              View supplier catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen: All Products / My Inventory (Original Catalog with tabs)           */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your digital inventory and live WhatsApp catalog.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>{showAddForm ? "Close Form" : "Add Product"}</span>
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 ${activeTab === "all" ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold" : "text-gray-500 hover:text-gray-900"}`}
        >
          All products
        </button>
        <button
          onClick={() => setActiveTab("my-inventory")}
          className={`pb-2.5 ${activeTab === "my-inventory" ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold" : "text-gray-500 hover:text-gray-900"}`}
        >
          My inventory
        </button>
        <button
          onClick={() => setActiveTab("reselling")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Reselling (3)
        </button>
        <button
          onClick={() => setActiveTab("exceptions")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Selling exceptions (3)
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
            <div className="h-44 bg-gray-50 flex items-center justify-center border-b border-gray-100">
              {p.primaryImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.primaryImageUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="text-3xl">📦</div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                  <div className="text-[11px] font-mono text-gray-400 mt-0.5">{p.skuCode}</div>
                </div>
                <div className="font-bold text-emerald-800 text-sm">
                  {p.basePriceFormatted || `₦${p.basePriceNaira.toLocaleString()}`}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                <span className="text-gray-500">Stock available:</span>
                <span className="font-bold text-gray-900">{p.availableStock} units</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
