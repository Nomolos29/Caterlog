"use client";

import React, { useState } from "react";

interface NetworkViewProps {
  onMirrorProducts?: () => void;
}

export function NetworkView({ onMirrorProducts }: NetworkViewProps) {
  // Tabs: 'find' | 'catalog' | 'resellers'
  const [activeTab, setActiveTab] = useState<"find" | "catalog" | "resellers">("find");

  // Find suppliers filters
  const [searchQuery, setSearchQuery] = useState("Home & living");
  const [categoryFilter, setCategoryFilter] = useState("Home & living");
  const [locationFilter, setLocationFilter] = useState("Lagos, Nigeria");
  const [accessFilter, setAccessFilter] = useState("Open to resellers");

  // Supplier Catalog selection
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(["flask", "lunchbox", "jar"]);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Resellers permission states
  const [viewCostsStock, setViewCostsStock] = useState(true);
  const [setRetailPrices, setSetRetailPrices] = useState(true);
  const [editMasterInventory, setEditMasterInventory] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [permsSaved, setPermsSaved] = useState(false);

  const toggleSelect = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter((p) => p !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Screen 8: Network · Supplier catalog (Aroko Wholesale)                     */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "catalog") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("find")}
                className="hover:text-emerald-700 underline"
              >
                Network / Find suppliers
              </button>
              <span>/</span>
              <span>Aroko Wholesale</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Aroko Wholesale</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Home &amp; living wholesaler · Lagos, Nigeria
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified identity
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Open to resellers
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Inventory synced just now
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (onMirrorProducts) onMirrorProducts();
            }}
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <span>Mirror {selectedProductIds.length} products</span>
            <span>→</span>
          </button>
        </div>

        {/* Catalog Tabs */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold">
            Catalog (24)
          </button>
          <button className="pb-2.5 text-gray-500 hover:text-gray-900">
            Business details
          </button>
          <button className="pb-2.5 text-gray-500 hover:text-gray-900">
            Wholesale terms
          </button>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product selection card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Select products to mirror</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedProductIds.length} selected · Your storefront uses your own selling prices
                </p>
              </div>

              <input
                type="text"
                placeholder="Search name or SKU"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Cost / Stock</th>
                      <th className="px-4 py-3 text-right">Selection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {/* 1. Flask */}
                    <tr
                      onClick={() => toggleSelect("flask")}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                          🧴
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Stainless flask</div>
                          <div className="text-[11px] text-gray-400">750ml · AW-FL750</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">₦8,000</div>
                        <div className="text-[11px] text-emerald-700 font-semibold">42 available</div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {selectedProductIds.includes("flask") ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Selected
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            Select
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 2. Lunch box */}
                    <tr
                      onClick={() => toggleSelect("lunchbox")}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                          🍱
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Lunch box · 1.2L</div>
                          <div className="text-[11px] text-gray-400">AW-LB1200</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">₦6,000</div>
                        <div className="text-[11px] text-emerald-700 font-semibold">28 available</div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {selectedProductIds.includes("lunchbox") ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Selected
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            Select
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 3. Storage jar */}
                    <tr
                      onClick={() => toggleSelect("jar")}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                          🫙
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Storage jar · 1L</div>
                          <div className="text-[11px] text-gray-400">AW-SJ1000</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">₦3,000</div>
                        <div className="text-[11px] text-emerald-700 font-semibold">62 available</div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {selectedProductIds.includes("jar") ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Selected
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            Select
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 4. Travel mug (Sold out) */}
                    <tr className="opacity-60 bg-gray-50/50">
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                          ☕
                        </div>
                        <div>
                          <div className="font-semibold text-gray-700">Travel mug · 400ml</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-700">₦5,000</div>
                        <div className="text-[11px] text-gray-400">0 available</div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-700">
                          Sold out
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-gray-400 pt-1">
                Showing 4 of 24 products · <button className="text-emerald-700 underline">View all products ↗</button>
              </div>
            </div>

            {/* Shared stock notice */}
            <div className="bg-[#ecfdf5] border border-emerald-100 rounded-2xl p-5 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>✓</span>
                <span>Shared stock, not a stock transfer</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Mirroring creates linked listings in Nia Stores. Aroko keeps the master inventory; confirmed sales update that inventory across all linked catalogs.
              </p>
            </div>

            {/* About this supplier */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-2 text-xs">
              <h3 className="text-xs font-bold text-gray-900">About this supplier</h3>
              <p className="text-gray-600 leading-relaxed">
                Aroko supplies drinkware, kitchen essentials and storage products to independent merchants. Product costs and live availability are managed by the supplier.
              </p>
              <p className="text-[11px] text-gray-400">
                Business verification confirms identity, not product quality or delivery performance.
              </p>
            </div>
          </div>

          {/* Right Column (1 Col) */}
          <div className="space-y-6">
            {/* Wholesale terms */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Wholesale terms</h3>
              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Minimum order</span>
                  <span className="font-semibold text-gray-900">1 unit</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Currency</span>
                  <span className="font-semibold text-gray-900">NGN</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Fulfilled by</span>
                  <span className="font-semibold text-gray-900">Aroko Wholesale</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="font-semibold text-gray-900">Ikeja, Lagos</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Delivery</span>
                  <span className="font-semibold text-gray-900">Confirm per order</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                No delivery date is guaranteed here. Pickup or delivery details are agreed before a commitment is sent to the customer.
              </p>
            </div>

            {/* Reseller access */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Reseller access</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Open to resellers
              </span>
              <p className="text-gray-600 leading-relaxed">
                Mirror this catalog immediately. No approval request is required for this catalog.
              </p>
              <p className="text-[11px] text-gray-400">
                Resellers can change retail prices and channels, but cannot edit supplier stock or costs.
              </p>
              <button
                onClick={() => {
                  if (onMirrorProducts) onMirrorProducts();
                }}
                className="w-full py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Mirror {selectedProductIds.length} products
              </button>
            </div>

            {/* Supplier contact */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Supplier contact</h3>
              <div>
                <div className="font-semibold text-gray-900">Aroko support</div>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Contact through Caterlog for product and fulfillment questions.
                </p>
              </div>
              <button
                onClick={() => alert("Opening messaging modal with Aroko Wholesale")}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                Message supplier
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 9: Network · My resellers (Supplier Perspective)                    */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "resellers") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Network / My resellers</div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">My resellers</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage who mirrors your catalogs and what they can access.
            </p>
          </div>
          <button
            onClick={() => alert("Opening invite reseller dialog")}
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
          >
            Invite reseller
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("find")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Find suppliers
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            My suppliers (1)
          </button>
          <button
            onClick={() => setActiveTab("resellers")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            My resellers (1)
          </button>
        </div>

        {/* Banner */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
          <div className="font-bold text-emerald-900 flex items-center gap-1.5">
            <span>✓</span>
            <span>Drinkware is open to resellers</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Nia Stores mirrored products immediately because the catalog is marked Open to resellers. Restricted catalogs have separate access controls; this is not a universal approval policy.
          </p>
        </div>

        {/* Connected Resellers Table Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Connected resellers</h3>
            <p className="text-xs text-gray-400 mt-0.5">1 relationship · Aroko Wholesale</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Reseller</th>
                  <th className="px-4 py-3">Catalogs / Listings</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Sales</th>
                  <th className="px-5 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Nia Stores</div>
                    <div className="text-[11px] text-gray-400">Verified · Lagos</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-gray-900 font-medium">Drinkware, Kitchen, Storage</div>
                    <div className="text-[11px] text-gray-400">3 linked products</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Open catalog
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-gray-900">₦50,000</div>
                    <div className="text-[11px] text-gray-400">3 paid orders</div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => alert("Viewing permissions for Nia Stores")}
                      className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                    >
                      Manage access
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2 Column Bottom: Permissions & Catalog Visibility / Invite */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Nia Stores Permissions Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Nia Stores · permissions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Connected 3 Nov 2026 · Mirrored from open catalogs</p>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-900">View wholesale costs &amp; live stock</div>
                  <div className="text-[11px] text-gray-400">Read-only access to linked product source data.</div>
                </div>
                <button
                  onClick={() => setViewCostsStock(!viewCostsStock)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    viewCostsStock ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      viewCostsStock ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Set retail prices &amp; channels</div>
                  <div className="text-[11px] text-gray-400">Reseller controls their own markup and storefront.</div>
                </div>
                <button
                  onClick={() => setSetRetailPrices(!setRetailPrices)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    setRetailPrices ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      setRetailPrices ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Edit master inventory</div>
                  <div className="text-[11px] text-gray-400">Not permitted. Stock remains supplier-owned.</div>
                </div>
                <button
                  onClick={() => setEditMasterInventory(!editMasterInventory)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    editMasterInventory ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      editMasterInventory ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Warning callout */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠</span>
                <span>Restrict future access</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Changing a catalog to restricted stops new mirroring. Review existing reseller access explicitly; do not disrupt paid orders awaiting fulfillment.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {permsSaved && (
                <span className="text-xs font-semibold text-emerald-700 mr-auto self-center">
                  ✓ Permissions updated
                </span>
              )}
              <button
                onClick={() => setPermsSaved(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                Discard
              </button>
              <button
                onClick={() => {
                  setPermsSaved(true);
                  setTimeout(() => setPermsSaved(false), 2500);
                }}
                className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Save permissions
              </button>
            </div>
          </div>

          {/* Right Column: Catalog Visibility & Invite */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Catalog visibility</h3>
              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-600">Drinkware</span>
                  <span className="font-semibold text-gray-900">Open · 1 linked</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-600">Kitchen essentials</span>
                  <span className="font-semibold text-gray-900">Open · 1 linked</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-600">Storage</span>
                  <span className="font-semibold text-gray-900">Open · 1 linked</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-600">Seasonal bundles</span>
                  <span className="font-semibold text-rose-700">Restricted · Not shared</span>
                </div>
              </div>
              <button
                onClick={() => alert("Editing catalog visibility")}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                Edit catalog access
              </button>
            </div>

            {/* Invite a reseller card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Invite a reseller</h3>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Business email
                </label>
                <input
                  type="email"
                  placeholder="Enter a business email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <p className="text-[11px] text-gray-400">
                Invites grant only the catalogs you select. No pending invitations.
              </p>
              {inviteSent && (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded">
                  Invitation sent to {inviteEmail}
                </div>
              )}
              <button
                onClick={() => {
                  if (inviteEmail) {
                    setInviteSent(true);
                    setTimeout(() => setInviteSent(false), 3000);
                  }
                }}
                disabled={!inviteEmail}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-800 text-xs font-semibold rounded-lg transition-colors"
              >
                Send invitation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 7: Network · Find suppliers                                         */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Network / Find suppliers</div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Find suppliers</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Discover wholesale catalogs. Connect stock, set your margin and start selling.
        </p>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
        <button
          onClick={() => setActiveTab("find")}
          className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
        >
          Find suppliers
        </button>
        <button
          onClick={() => setActiveTab("catalog")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          My suppliers (1)
        </button>
        <button
          onClick={() => setActiveTab("resellers")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          My resellers
        </button>
      </div>

      {/* Directory Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Search the directory</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            <option>Home &amp; living</option>
            <option>Electronics</option>
            <option>Fashion</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Location</label>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            <option>Lagos, Nigeria</option>
            <option>Abuja, Nigeria</option>
            <option>Ibadan, Nigeria</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Access</label>
          <select
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            <option>Open to resellers</option>
            <option>Requires request</option>
          </select>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>1 verified supplier · 3 matching catalogs</div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
          ● Live inventory
        </span>
      </div>

      {/* Verified Supplier Card: Aroko Wholesale */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Aroko Wholesale</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Verified
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Verified business · Lagos, Nigeria · Home &amp; living
            </p>
          </div>
          <button
            onClick={() => setActiveTab("catalog")}
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-center"
          >
            <span>View supplier &amp; catalog</span>
            <span>→</span>
          </button>
        </div>

        <p className="text-xs text-gray-700 leading-relaxed max-w-3xl">
          Practical everyday homeware for independent shops. Mirror selected products and sell from one shared stock pool.
        </p>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Open to resellers
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            24 live products
          </span>
        </div>

        <div className="text-[11px] text-gray-500">
          Wholesale from ₦3,000 · Minimum 1 unit · Pickup or merchant-arranged delivery
        </div>

        {/* 3 Categories preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div
            onClick={() => setActiveTab("catalog")}
            className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl hover:border-emerald-300 cursor-pointer transition-all space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🧴</span>
              <div>
                <div className="font-semibold text-xs text-gray-900">Drinkware</div>
                <div className="text-[10px] text-gray-400">8 products · from ₦5,000</div>
              </div>
            </div>
            <div className="text-[11px] font-medium text-emerald-700 pt-1">126 units available</div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">Browse products ↗</div>
          </div>

          <div
            onClick={() => setActiveTab("catalog")}
            className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl hover:border-emerald-300 cursor-pointer transition-all space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🍱</span>
              <div>
                <div className="font-semibold text-xs text-gray-900">Kitchen essentials</div>
                <div className="text-[10px] text-gray-400">10 products · from ₦6,000</div>
              </div>
            </div>
            <div className="text-[11px] font-medium text-emerald-700 pt-1">84 units available</div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">Browse products ↗</div>
          </div>

          <div
            onClick={() => setActiveTab("catalog")}
            className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl hover:border-emerald-300 cursor-pointer transition-all space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🫙</span>
              <div>
                <div className="font-semibold text-xs text-gray-900">Storage &amp; organisation</div>
                <div className="text-[10px] text-gray-400">6 products · from ₦3,000</div>
              </div>
            </div>
            <div className="text-[11px] font-medium text-emerald-700 pt-1">62 units available</div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">Browse products ↗</div>
          </div>
        </div>
      </div>

      {/* Bottom 2 Cards: No results & One connected catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
          <div>
            <h3 className="text-xs font-bold text-gray-900">Can&apos;t find a match?</h3>
            <p className="text-[11px] text-gray-400">No-results treatment</p>
          </div>
          <p className="text-gray-600 leading-relaxed">
            No suppliers match &ldquo;Electronics&rdquo; in this location. Remove a category or expand your location to search again.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setSearchQuery("Home & living");
                setCategoryFilter("Home & living");
              }}
              className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              Clear filters
            </button>
            <button
              onClick={() => alert("Showing all wholesale categories")}
              className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              Browse all categories
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
          <h3 className="text-xs font-bold text-gray-900">One connected catalog</h3>
          <div className="divide-y divide-gray-100">
            <div className="py-2 flex justify-between">
              <span className="text-gray-500">Supplier owns</span>
              <span className="font-semibold text-gray-900">Master stock &amp; costs</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-gray-500">You control</span>
              <span className="font-semibold text-gray-900">Retail price &amp; channels</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Open catalogs mirror immediately. Restricted catalogs show their own access requirements.
          </p>
        </div>
      </div>

      {/* Demonstration disclaimer */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs flex items-start gap-3">
        <span className="text-gray-400 font-bold">ℹ</span>
        <div className="text-gray-600">
          <span className="font-bold text-gray-800">Shared demonstration assumptions</span>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            Fictional Nigerian businesses and illustrative policies/pricing. Open-catalog access, approval rules, fee/refund liability and settlement timing need confirmation. Examples use a ₦300 fee borne by Nia Stores; no shipping is charged in the sample order. Market Boost is illustrated at ₦15,000/month. Exception panels are separate scenarios.
          </p>
        </div>
      </div>
    </div>
  );
}

