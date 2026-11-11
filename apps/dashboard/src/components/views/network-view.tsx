"use client";

import React, { useState } from "react";
import { FilterIcon, CheckIcon } from "../icons";

interface NetworkViewProps {
  initialTab?: "my-suppliers" | "find-suppliers" | "supplier-catalog" | "my-resellers";
  onMirrorProducts?: (selectedSkus?: string[]) => void;
}

interface SupplierProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  wholesaleCost: number;
  suggestedRetail: number;
  stock: number;
  imageUrl: string;
  moq: number;
}

interface SupplierProfile {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  cacNumber: string;
  category: string;
  location: string;
  warehouseAddress: string;
  phone: string;
  whatsapp: string;
  rating: number;
  totalFulfilled: number;
  subAccountCode: string;
  leadTime: string;
  cutoffTime: string;
  wholesaleTerms: {
    moqDropship: number;
    moqWholesale: number;
    settlementTerms: string;
    returnWindow: string;
    suggestedMargin: string;
    inventorySync: string;
  };
  products: SupplierProduct[];
}

const SUPPLIERS_DATA: SupplierProfile[] = [
  {
    id: "sup-1",
    name: "Aroko Wholesale",
    slug: "aroko-wholesale",
    verified: true,
    cacNumber: "RC-1928401",
    category: "Kitchenware & Home Living",
    location: "Lagos, Nigeria",
    warehouseAddress: "Warehouse 3B, International Trade Fair Complex, Badagry Expressway, Lagos",
    phone: "+234 802 888 1920",
    whatsapp: "2348028881920",
    rating: 4.9,
    totalFulfilled: 1420,
    subAccountCode: "SUB-AW-001",
    leadTime: "Same day dispatch if ordered before 1:00 PM; 24h pickup at Ikeja hub",
    cutoffTime: "1:00 PM WAT daily",
    wholesaleTerms: {
      moqDropship: 1,
      moqWholesale: 5,
      settlementTerms: "Instant escrow split via Monnify upon customer payment confirmation (0 net days)",
      returnWindow: "48-hour return window for transit damage with unboxing video/photo proof",
      suggestedMargin: "25% – 35% gross retail margin",
      inventorySync: "Real-time webhook inventory reservations with automatic 15-minute hold TTL",
    },
    products: [
      {
        id: "p1",
        sku: "AW-FL750",
        name: "Stainless Steel Vacuum Flask · 750ml",
        category: "Drinkware",
        wholesaleCost: 8000,
        suggestedRetail: 10000,
        stock: 42,
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p2",
        sku: "AW-LB1200",
        name: "Insulated Lunch Box · 1.2L Double Compartment",
        category: "Storage",
        wholesaleCost: 6000,
        suggestedRetail: 7500,
        stock: 28,
        imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p3",
        sku: "AW-SJ1000",
        name: "Borosilicate Glass Storage Jar · 1L Airtight",
        category: "Storage",
        wholesaleCost: 3000,
        suggestedRetail: 4000,
        stock: 62,
        imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p4",
        sku: "AW-AF5500",
        name: "5.5L Digital Touchscreen Hot Air Fryer",
        category: "Appliances",
        wholesaleCost: 48000,
        suggestedRetail: 65000,
        stock: 15,
        imageUrl: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p5",
        sku: "AW-EK2000",
        name: "Electric Borosilicate Glass Kettle 2.0L",
        category: "Appliances",
        wholesaleCost: 14000,
        suggestedRetail: 19500,
        stock: 34,
        imageUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p6",
        sku: "AW-KU1200",
        name: "Silicone Kitchen Utensils 12-Piece Set",
        category: "Kitchen Tools",
        wholesaleCost: 9500,
        suggestedRetail: 13500,
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
    ],
  },
  {
    id: "sup-2",
    name: "MegaKitch Importers",
    slug: "megakitch-importers",
    verified: true,
    cacNumber: "RC-2049182",
    category: "Kitchen Organizers & Storage",
    location: "Alaba, Lagos",
    warehouseAddress: "Section C, Alaba International Market, Ojo, Lagos",
    phone: "+234 814 333 4455",
    whatsapp: "2348143334455",
    rating: 4.8,
    totalFulfilled: 890,
    subAccountCode: "SUB-MK-002",
    leadTime: "Next-day dispatch for all Mainland & Island deliveries",
    cutoffTime: "3:00 PM WAT daily",
    wholesaleTerms: {
      moqDropship: 1,
      moqWholesale: 2,
      settlementTerms: "Instant Monnify escrow split on order payment",
      returnWindow: "72-hour factory defect replacement",
      suggestedMargin: "30% – 45% gross retail margin",
      inventorySync: "Daily morning inventory reconciliation",
    },
    products: [
      {
        id: "p7",
        sku: "MK-CRT30",
        name: "3-Tier Rolling Heavy Duty Metal Utility Cart",
        category: "Organizers",
        wholesaleCost: 18000,
        suggestedRetail: 25000,
        stock: 20,
        imageUrl: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p8",
        sku: "MK-SP160",
        name: "16-Jar Rotating Carousel Spice Rack",
        category: "Organizers",
        wholesaleCost: 7500,
        suggestedRetail: 11000,
        stock: 45,
        imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
    ],
  },
];

export function NetworkView({ initialTab = "my-suppliers", onMirrorProducts }: NetworkViewProps) {
  // Connected suppliers list & wholesale directory
  const [connectedSuppliers, setConnectedSuppliers] = useState<SupplierProfile[]>([SUPPLIERS_DATA[0]]);
  const [directorySuppliers, setDirectorySuppliers] = useState<SupplierProfile[]>(SUPPLIERS_DATA);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile | null>(null);

  // Default to my-suppliers
  const [activeTab, setActiveTab] = useState<"my-suppliers" | "find-suppliers" | "supplier-catalog" | "my-resellers">(
    initialTab
  );

  // Supplier Catalog selection
  const [selectedProductSkus, setSelectedProductSkus] = useState<string[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("ALL");
  const [mirrorToast, setMirrorToast] = useState<string | null>(null);

  // Supplier Messaging Modal
  const [supplierMsgModal, setSupplierMsgModal] = useState(false);
  const [supplierMsgText, setSupplierMsgText] = useState("");

  // Resellers permission states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const toggleSelectSku = (sku: string) => {
    if (selectedProductSkus.includes(sku)) {
      setSelectedProductSkus(selectedProductSkus.filter((s) => s !== sku));
    } else {
      setSelectedProductSkus([...selectedProductSkus, sku]);
    }
  };

  const handleSelectAllInCatalog = (filteredProducts: SupplierProduct[]) => {
    const allSkus = filteredProducts.map((p) => p.sku);
    const allSelected = allSkus.every((s) => selectedProductSkus.includes(s));
    if (allSelected) {
      setSelectedProductSkus(selectedProductSkus.filter((s) => !allSkus.includes(s)));
    } else {
      setSelectedProductSkus(Array.from(new Set([...selectedProductSkus, ...allSkus])));
    }
  };

  const handleMirrorSelected = () => {
    if (onMirrorProducts) {
      onMirrorProducts(selectedProductSkus);
    }
    setMirrorToast(`✓ Successfully mirrored ${selectedProductSkus.length} products to your reselling inventory!`);
    setTimeout(() => setMirrorToast(null), 3000);
  };

  const handleViewSupplierCatalog = (sup: SupplierProfile) => {
    setSelectedSupplier(sup);
    setSupplierMsgText(
      `Hello ${sup.name}, we have mirrored your catalog products and would like to confirm fulfillment dispatch turnaround for Lagos deliveries.`
    );
    setActiveTab("supplier-catalog");
  };

  // Filter products in catalog view
  const catalogProducts = selectedSupplier
    ? selectedSupplier.products.filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(catalogSearch.toLowerCase());
        const matchesCat = catalogCategory === "ALL" || p.category === catalogCategory;
        return matchesSearch && matchesCat;
      })
    : [];

  const uniqueCategories = selectedSupplier
    ? Array.from(new Set(selectedSupplier.products.map((p) => p.category)))
    : [];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {mirrorToast && (
        <div className="fixed top-18 right-8 z-50 bg-[#0d5c3a] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <span>✓</span>
          <span>{mirrorToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Supplier Network</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Partner with verified Nigerian wholesale importers, mirror live product stock, and split payments via Monnify.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "supplier-catalog" && (
            <button
              onClick={handleMirrorSelected}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <span>Publish ({selectedProductSkus.length}) to My Store</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Strip: My Suppliers FIRST! Then Find Suppliers, then Catalog, then Resellers */}
      <div className="flex border-b border-gray-200 text-xs font-semibold gap-6 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab("my-suppliers")}
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
            activeTab === "my-suppliers"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          My Suppliers ({connectedSuppliers.length})
        </button>

        <button
          onClick={() => setActiveTab("find-suppliers")}
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
            activeTab === "find-suppliers"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          Find Suppliers (Directory)
        </button>

        {activeTab === "supplier-catalog" && selectedSupplier && (
          <button
            onClick={() => setActiveTab("supplier-catalog")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-bold whitespace-nowrap cursor-pointer active:scale-95"
          >
            {selectedSupplier.name} · All Products
          </button>
        )}

        <button
          onClick={() => setActiveTab("my-resellers")}
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
            activeTab === "my-resellers"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          My Resellers (Distribution)
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: MY SUPPLIERS (FIRST! Shows Business Details & Wholesale Terms)  */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "my-suppliers" && (
        <div className="space-y-6">
          {connectedSuppliers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
              <div className="text-4xl">🤝</div>
              <h3 className="text-base font-bold text-gray-900">No Connected Suppliers Yet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Explore the verified supplier directory to mirror products and start selling kitchenware, electronics, and home goods with zero inventory capital.
              </p>
              <button
                onClick={() => setActiveTab("find-suppliers")}
                className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
              >
                Find Verified Suppliers →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {connectedSuppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-2xs p-6 sm:p-8 space-y-6 hover:border-gray-200 transition-colors"
                >
                  {/* Supplier Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold text-xl flex items-center justify-center shrink-0">
                        {sup.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">{sup.name}</h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckIcon className="w-3 h-3" />
                            <span>Verified Importer</span>
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3">
                          <span className="font-mono text-gray-700 font-semibold">{sup.cacNumber}</span>
                          <span>•</span>
                          <span>{sup.category}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">★ {sup.rating} ({sup.totalFulfilled} fulfilled)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <a
                        href={`https://wa.me/${sup.whatsapp}?text=${encodeURIComponent(
                          `Hello ${sup.name}, reaching out from Nia Stores regarding our wholesale partnership on Caterlog.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span>WhatsApp Desk</span>
                        <span>↗</span>
                      </a>
                      <button
                        onClick={() => handleViewSupplierCatalog(sup)}
                        className="px-4 py-2 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span>View All Products ({sup.products.length}) →</span>
                      </button>
                    </div>
                  </div>

                  {/* 2 Column Details: Business Information vs Wholesale Terms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Left: Business Details */}
                    <div className="bg-gray-50/70 rounded-2xl p-5 space-y-3 border border-gray-100">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                        <span>🏢</span>
                        <span>Business & Fulfillment Details</span>
                      </div>
                      <div className="space-y-2 text-gray-600">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Warehouse Location:</span>
                          <span className="font-medium text-gray-900 text-right max-w-[220px]">{sup.warehouseAddress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dispatch Cutoff:</span>
                          <span className="font-semibold text-gray-900">{sup.cutoffTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Fulfillment Lead Time:</span>
                          <span className="font-medium text-gray-900 text-right max-w-[220px]">{sup.leadTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Monnify Sub-Account:</span>
                          <span className="font-mono font-bold text-emerald-800">{sup.subAccountCode} (Escrow Route)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Contact Line:</span>
                          <span className="font-mono text-gray-800">{sup.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Wholesale Terms */}
                    <div className="bg-emerald-50/40 rounded-2xl p-5 space-y-3 border border-emerald-100">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                        <span>📄</span>
                        <span>Wholesale Agreement & Terms</span>
                      </div>
                      <div className="space-y-2 text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dropship MOQ:</span>
                          <span className="font-bold text-emerald-950">{sup.wholesaleTerms.moqDropship} unit (No pre-funding)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Settlement Terms:</span>
                          <span className="font-medium text-emerald-950 text-right max-w-[220px]">
                            {sup.wholesaleTerms.settlementTerms}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Suggested Retail Margin:</span>
                          <span className="font-bold text-emerald-800">{sup.wholesaleTerms.suggestedMargin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Damages & Returns:</span>
                          <span className="font-medium text-gray-800 text-right max-w-[220px]">
                            {sup.wholesaleTerms.returnWindow}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Inventory Sync:</span>
                          <span className="font-medium text-gray-800 text-right max-w-[220px]">
                            {sup.wholesaleTerms.inventorySync}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Catalog Preview Bar */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-700">Popular Catalog Items</span>
                      <button
                        onClick={() => handleViewSupplierCatalog(sup)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        Browse all {sup.products.length} products →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {sup.products.slice(0, 3).map((prod) => (
                        <div
                          key={prod.id}
                          className="p-3 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center gap-3"
                        >
                          <img src={prod.imageUrl} alt={prod.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-gray-900 truncate">{prod.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Wholesale: <span className="font-bold text-emerald-800">₦{prod.wholesaleCost.toLocaleString()}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">Stock: {prod.stock} units</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: SUPPLIER CATALOG (View All Products from a Supplier)             */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "supplier-catalog" && (
        !selectedSupplier ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
              📦
            </div>
            <h3 className="text-base font-bold text-gray-900">No Supplier Selected</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Select a connected wholesale partner or browse the verified supplier directory to inspect and mirror product catalogs.
            </p>
            <button
              onClick={() => setActiveTab("find-suppliers")}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              Find Suppliers →
            </button>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Back button & Supplier Context Banner */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <button
                onClick={() => setActiveTab("my-suppliers")}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 cursor-pointer"
              >
                ← Back to My Suppliers
              </button>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{selectedSupplier.name} · Wholesale Catalog</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedSupplier.products.length} Products
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Warehouse: {selectedSupplier.warehouseAddress} · Lead time: {selectedSupplier.leadTime}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSupplierMsgModal(true)}
                className="px-3.5 py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Message Supplier
              </button>
              <button
                onClick={handleMirrorSelected}
                className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Mirror Selected ({selectedProductSkus.length})
              </button>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search products by title or SKU..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setCatalogCategory("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  catalogCategory === "ALL"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All Categories
              </button>
              {uniqueCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatalogCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    catalogCategory === cat
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Supplier All Products Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={catalogProducts.length > 0 && catalogProducts.every((p) => selectedProductSkus.includes(p.sku))}
                  onChange={() => handleSelectAllInCatalog(catalogProducts)}
                  className="rounded text-emerald-600 cursor-pointer"
                />
                <span>Select all in view ({catalogProducts.length})</span>
              </label>
              <span className="text-xs text-gray-400 font-medium">
                {selectedProductSkus.length} of {selectedSupplier.products.length} selected to mirror
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-gray-50/60 text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-6 w-12">Select</th>
                    <th className="py-3 px-6">Product</th>
                    <th className="py-3 px-6">Category</th>
                    <th className="py-3 px-6">Wholesale Cost</th>
                    <th className="py-3 px-6">Suggested Retail</th>
                    <th className="py-3 px-6">Gross Margin</th>
                    <th className="py-3 px-6">Stock Available</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {catalogProducts.map((p) => {
                    const isSelected = selectedProductSkus.includes(p.sku);
                    const margin = p.suggestedRetail - p.wholesaleCost;
                    const marginPct = Math.round((margin / p.suggestedRetail) * 100);
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50/60 transition-colors ${isSelected ? "bg-emerald-50/20" : ""}`}>
                        <td className="py-3.5 px-6">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectSku(p.sku)}
                            className="rounded text-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                            <div>
                              <div className="font-bold text-gray-900">{p.name}</div>
                              <div className="text-[11px] font-mono text-gray-400 mt-0.5">{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-gray-600">{p.category}</td>
                        <td className="py-3.5 px-6 font-bold text-gray-900">₦{p.wholesaleCost.toLocaleString()}</td>
                        <td className="py-3.5 px-6 font-medium text-gray-600">₦{p.suggestedRetail.toLocaleString()}</td>
                        <td className="py-3.5 px-6 font-bold text-emerald-700">
                          +{marginPct}% (₦{margin.toLocaleString()})
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`font-semibold ${p.stock < 15 ? "text-amber-600 font-bold" : "text-gray-900"}`}>
                            {p.stock} units
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => toggleSelectSku(p.sku)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-800"
                                : "border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700"
                            }`}
                          >
                            {isSelected ? "✓ Mirrored" : "+ Mirror SKU"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: FIND SUPPLIERS (Verified Directory)                             */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "find-suppliers" && (
        <div className="space-y-6">
          {/* Directory Hero */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">Verified Nigerian Supplier Directory</h2>
            <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
              Connect with verified Lagos and nationwide importers. All suppliers in Caterlog are CAC verified and bound by standard Monnify split escrow settlement terms.
            </p>
          </div>

          {/* Directory Supplier Cards or Empty State */}
          {directorySuppliers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
                🏢
              </div>
              <h3 className="text-base font-bold text-gray-900">No Verified Suppliers Listed Yet</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                The verified wholesale supplier directory will list verified Nigerian importers and manufacturers as they onboard.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {directorySuppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="bg-white rounded-3xl border border-gray-100 p-6 shadow-2xs space-y-5 hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-gray-900">{sup.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                            CAC Verified
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{sup.cacNumber} · {sup.category}</div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700">★ {sup.rating}</span>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed">
                      Warehouse: {sup.warehouseAddress}. Fulfillment cutoff: {sup.cutoffTime}.
                    </p>

                    <div className="bg-gray-50 rounded-2xl p-3.5 space-y-1.5 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dropship MOQ:</span>
                        <span className="font-semibold text-gray-900">{sup.wholesaleTerms.moqDropship} unit</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Escrow Settlement:</span>
                        <span className="font-semibold text-emerald-700">Instant via Monnify</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Catalog Size:</span>
                        <span className="font-semibold text-gray-900">{sup.products.length} Products Available</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleViewSupplierCatalog(sup)}
                      className="flex-1 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all text-center"
                    >
                      View Products &amp; Terms
                    </button>
                    <a
                      href={`https://wa.me/${sup.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 4: MY RESELLERS (Downstream Network Distribution)                  */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "my-resellers" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">My Resellers Network</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manage sub-resellers authorized to mirror your products and sell downstream.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="reseller@example.ng"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => {
                    if (inviteEmail) {
                      setInviteSent(true);
                      setTimeout(() => setInviteSent(false), 3000);
                      setInviteEmail("");
                    }
                  }}
                  className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs cursor-pointer active:scale-95"
                >
                  {inviteSent ? "✓ Sent" : "Invite Reseller"}
                </button>
              </div>
            </div>

            {/* Reseller Permissions Summary */}
            <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 flex flex-wrap gap-4 text-xs text-gray-600">
              <span className="font-bold text-gray-900">Default Reseller Permissions:</span>
              <span>✓ View shared wholesale stock</span>
              <span>✓ Set custom retail markup</span>
              <span>✕ Cannot edit master catalog inventory</span>
            </div>
          </div>

          {/* Active Resellers Empty State */}
          <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto">
              👥
            </div>
            <h3 className="text-sm font-bold text-gray-900">No Resellers Connected Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Send an invite to downstream distributors, retail partners, or affiliate vendors to allow them to mirror your inventory.
            </p>
          </div>
        </div>
      )}

      {/* Message Supplier Modal */}
      {supplierMsgModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Message {selectedSupplier.name}</h3>
                <p className="text-xs text-gray-400">Direct WhatsApp wholesale desk inquiry</p>
              </div>
              <button onClick={() => setSupplierMsgModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                ✕
              </button>
            </div>
            <div>
              <textarea
                rows={4}
                value={supplierMsgText}
                onChange={(e) => setSupplierMsgText(e.target.value)}
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSupplierMsgModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <a
                href={`https://wa.me/${selectedSupplier.whatsapp}?text=${encodeURIComponent(supplierMsgText)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSupplierMsgModal(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer"
              >
                Send via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
