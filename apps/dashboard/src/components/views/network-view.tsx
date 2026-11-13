"use client";

import React, { useState } from "react";
import { FilterIcon, CheckIcon } from "../icons";
import { NIGERIAN_STATES } from "./market-boost-view";

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
  state: string;
  shippingScope: "LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE";
  allowInterstate: boolean;
  coveredStates: string[];
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
    state: "Lagos",
    shippingScope: "LOCAL_STATE",
    allowInterstate: false,
    coveredStates: ["Lagos"],
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
    state: "Lagos",
    shippingScope: "NATIONWIDE",
    allowInterstate: true,
    coveredStates: ["Nationwide (All 36 States + FCT)"],
    warehouseAddress: "Section C, Alaba International Market, Ojo, Lagos",
    phone: "+234 814 333 4455",
    whatsapp: "2348143334455",
    rating: 4.8,
    totalFulfilled: 890,
    subAccountCode: "SUB-MK-002",
    leadTime: "Next-day dispatch for all Mainland & Island deliveries; 48-72h interstate haulage",
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
  {
    id: "sup-3",
    name: "Kano Northern Wholesale Hub",
    slug: "kano-northern-hub",
    verified: true,
    cacNumber: "RC-3184910",
    category: "Household & Textiles",
    location: "Kano, Nigeria",
    state: "Kano",
    shippingScope: "SELECTED_STATES",
    allowInterstate: true,
    coveredStates: ["Kano", "Kaduna", "Jigawa", "FCT - Abuja"],
    warehouseAddress: "Block 4, Singer Market, Fagge, Kano State",
    phone: "+234 803 111 8899",
    whatsapp: "2348031118899",
    rating: 4.7,
    totalFulfilled: 620,
    subAccountCode: "SUB-KN-003",
    leadTime: "Same day dispatch within Kano; 24-48h to Abuja/Kaduna hubs",
    cutoffTime: "12:00 PM WAT daily",
    wholesaleTerms: {
      moqDropship: 1,
      moqWholesale: 4,
      settlementTerms: "Instant Monnify escrow split on order payment",
      returnWindow: "48-hour return window with unboxing verification",
      suggestedMargin: "25% – 40% gross retail margin",
      inventorySync: "Live inventory reservations with instant webhook sync",
    },
    products: [
      {
        id: "p9",
        sku: "KN-TC500",
        name: "Premium Cotton Thermal Blanket · Double Size",
        category: "Textiles",
        wholesaleCost: 12000,
        suggestedRetail: 17500,
        stock: 35,
        imageUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=60",
        moq: 1,
      },
      {
        id: "p10",
        sku: "KN-SS300",
        name: "Stainless Steel Traditional Tea Pot Set",
        category: "Kitchenware",
        wholesaleCost: 8500,
        suggestedRetail: 12000,
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60",
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

  // Reseller operating location & Geographic visibility filters
  const [resellerState, setResellerState] = useState("Lagos");
  const [filterDeliverableOnly, setFilterDeliverableOnly] = useState(false);
  const [incompatibleModalSup, setIncompatibleModalSup] = useState<SupplierProfile | null>(null);

  const isSupplierDeliverable = (sup: SupplierProfile, targetState: string = resellerState) => {
    if (sup.shippingScope === "NATIONWIDE") return true;
    if (sup.shippingScope === "LOCAL_STATE") {
      return sup.state.toLowerCase() === targetState.toLowerCase();
    }
    if (sup.shippingScope === "SELECTED_STATES") {
      return sup.coveredStates.some(
        (st) =>
          st.toLowerCase() === targetState.toLowerCase() ||
          st.toLowerCase().includes(targetState.toLowerCase())
      );
    }
    return false;
  };

  const getShippingBadge = (sup: SupplierProfile) => {
    if (sup.shippingScope === "LOCAL_STATE") {
      return {
        label: `📍 ${sup.state} Only (Local)`,
        color: "bg-amber-50 text-amber-900 border-amber-200",
        interstate: "🔒 Interstate Disabled",
      };
    }
    if (sup.shippingScope === "SELECTED_STATES") {
      return {
        label: `🗺️ ${sup.coveredStates.length} States: ${sup.coveredStates.slice(0, 3).join(", ")}${
          sup.coveredStates.length > 3 ? "..." : ""
        }`,
        color: "bg-blue-50 text-blue-900 border-blue-200",
        interstate: "Regional Delivery",
      };
    }
    return {
      label: "🌐 Nationwide Delivery",
      color: "bg-emerald-50 text-emerald-900 border-emerald-200",
      interstate: "All 36 States + FCT",
    };
  };

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
    if (selectedSupplier && !isSupplierDeliverable(selectedSupplier)) {
      setIncompatibleModalSup(selectedSupplier);
      return;
    }
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-gray-900">{sup.name}</h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckIcon className="w-3 h-3" />
                            <span>Verified Importer</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getShippingBadge(sup).color}`}>
                            {getShippingBadge(sup).label}
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
                          <span className="text-gray-500">Shipping Reach:</span>
                          <span className="font-semibold text-gray-900 text-right max-w-[220px]">{getShippingBadge(sup).label}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Interstate Mirroring:</span>
                          <span className={`font-semibold ${sup.allowInterstate ? "text-emerald-700" : "text-amber-800"}`}>
                            {sup.allowInterstate ? "Supported ✅" : "Blocked 🔒 (Local only)"}
                          </span>
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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{selectedSupplier.name} · Wholesale Catalog</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedSupplier.products.length} Products
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getShippingBadge(selectedSupplier).color}`}>
                  {getShippingBadge(selectedSupplier).label}
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
              {!isSupplierDeliverable(selectedSupplier) ? (
                <button
                  onClick={() => setIncompatibleModalSup(selectedSupplier)}
                  className="bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span>🔒</span>
                  <span>Mirroring Restricted ({resellerState})</span>
                </button>
              ) : (
                <button
                  onClick={handleMirrorSelected}
                  className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Mirror Selected ({selectedProductSkus.length})
                </button>
              )}
            </div>
          </div>

          {/* Interstate Restriction Notice if outside delivery zone */}
          {!isSupplierDeliverable(selectedSupplier) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>Geographic Mirroring Guardrail Active</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                      Out of Delivery Scope
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                    {selectedSupplier.name} only fulfills deliveries within <strong>{selectedSupplier.shippingScope === "LOCAL_STATE" ? selectedSupplier.state : selectedSupplier.coveredStates.join(", ")}</strong> and has disabled interstate fulfillment. Because your store operates in <strong>{resellerState}</strong>, product mirroring is restricted to protect your brand from failed delivery fulfillment disputes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSupplierMsgModal(true)}
                className="px-3.5 py-2 bg-amber-900 hover:bg-amber-950 text-white rounded-xl font-semibold text-xs whitespace-nowrap cursor-pointer transition-all shrink-0"
              >
                Inquire on WhatsApp Desk →
              </button>
            </div>
          )}

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
              Connect with verified Lagos and nationwide importers. Suppliers set their geographic visibility to ensure you only mirror catalogs that can reliably be fulfilled to your customers without interstate logistics failure.
            </p>
          </div>

          {/* Reseller Business Location & Coverage Filter Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <span>📍</span>
                <span>My Reseller Store Location:</span>
              </span>
              <select
                value={resellerState}
                onChange={(e) => setResellerState(e.target.value)}
                className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-600"
              >
                {NIGERIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st} State
                  </option>
                ))}
              </select>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500 text-[11px]">
                Showing suppliers delivering to <strong>{resellerState}</strong>
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-gray-700 font-medium">
              <input
                type="checkbox"
                checked={filterDeliverableOnly}
                onChange={(e) => setFilterDeliverableOnly(e.target.checked)}
                className="rounded text-emerald-600 cursor-pointer"
              />
              <span>Hide out-of-zone suppliers</span>
            </label>
          </div>

          {/* Directory Supplier Cards or Empty State */}
          {directorySuppliers.filter((sup) => !filterDeliverableOnly || isSupplierDeliverable(sup)).length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
                🏢
              </div>
              <h3 className="text-base font-bold text-gray-900">No Suppliers Matching {resellerState} Delivery</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                There are currently no verified wholesale suppliers delivering to {resellerState}. Turn off &ldquo;Hide out-of-zone suppliers&rdquo; to browse all nationwide and regional suppliers.
              </p>
              <button
                onClick={() => setFilterDeliverableOnly(false)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
              >
                Show all directory suppliers
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {directorySuppliers
                .filter((sup) => !filterDeliverableOnly || isSupplierDeliverable(sup))
                .map((sup) => {
                  const deliverable = isSupplierDeliverable(sup);
                  const badge = getShippingBadge(sup);

                  return (
                    <div
                      key={sup.id}
                      className={`bg-white rounded-3xl border p-6 shadow-2xs space-y-5 transition-all flex flex-col justify-between ${
                        deliverable
                          ? "border-gray-100 hover:border-emerald-300"
                          : "border-amber-200/80 bg-amber-50/10"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-base text-gray-900">{sup.name}</h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                                CAC Verified
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 font-mono">{sup.cacNumber} · {sup.category}</div>
                          </div>
                          <span className="text-xs font-bold text-emerald-700 shrink-0">★ {sup.rating}</span>
                        </div>

                        {/* Geographic delivery warning if outside delivery zone */}
                        {!deliverable ? (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span>🔒</span>
                              <span>
                                Supplier does not deliver to <strong>{resellerState}</strong>. Interstate catalog mirroring is restricted.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-900 text-[11px] flex items-center gap-1.5">
                            <span>✓</span>
                            <span>Eligible for <strong>{resellerState}</strong> fulfillment &amp; instant catalog mirroring.</span>
                          </div>
                        )}

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
                          className={`flex-1 text-xs font-semibold py-2.5 px-4 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all text-center ${
                            deliverable
                              ? "bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white"
                              : "bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300"
                          }`}
                        >
                          {deliverable ? "View Products & Terms" : `Inspect Catalog (Restricted to ${sup.state})`}
                        </button>
                        <a
                          href={`https://wa.me/${sup.whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                        >
                          WhatsApp Desk
                        </a>
                      </div>
                    </div>
                  );
                })}
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

      {/* Incompatible Supplier Geographic Restriction Modal */}
      {incompatibleModalSup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔒</span>
                <h3 className="font-bold text-gray-900 text-sm">Geographic Fulfillment Restriction</h3>
              </div>
              <button
                onClick={() => setIncompatibleModalSup(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-700 space-y-3">
              <p>
                <strong>{incompatibleModalSup.name}</strong> operates out of{" "}
                <strong>{incompatibleModalSup.warehouseAddress}</strong> and only fulfills orders within:
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl font-medium text-amber-950">
                {incompatibleModalSup.shippingScope === "LOCAL_STATE" ? (
                  <span>📍 <strong>{incompatibleModalSup.state} State Only</strong> (Interstate shipping disabled)</span>
                ) : (
                  <span>🗺️ <strong>{incompatibleModalSup.coveredStates.join(", ")}</strong></span>
                )}
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Because your reseller business is based in <strong>{resellerState}</strong>, mirroring these products to your catalog would result in failed customer orders and escrow refund deductions when buyers order items that cannot be delivered.
              </p>

              <p className="text-[11px] text-gray-600">
                If you have independent haulage arrangements (e.g., GIG Logistics, ABC Cargo, interstate bus parcel), you can request custom dispatch directly from their wholesale desk.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setIncompatibleModalSup(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs rounded-xl cursor-pointer"
              >
                Dismiss
              </button>
              <a
                href={`https://wa.me/${incompatibleModalSup.whatsapp}?text=${encodeURIComponent(
                  `Hello ${incompatibleModalSup.name}, reaching out from a store in ${resellerState}. We are interested in your catalog on Caterlog and would like to ask if you can fulfill interstate orders to our state via custom courier.`
                )}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIncompatibleModalSup(null)}
                className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-4 py-2 rounded-xl text-center cursor-pointer"
              >
                Inquire on WhatsApp Desk →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
