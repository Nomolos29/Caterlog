"use client";

import React, { useState, useEffect, useMemo } from "react";
import type {
  MarketBoostListing,
  ProductItem,
  ResellerMirror,
  SupplierProfile,
  WholesaleDiscountRule,
} from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";
import { getLgasForState } from "@caterlog/shared";

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

const DEFAULT_NETWORK_RESELLERS = [
  "Nia Stores",
  "Zuri Fashion Hub",
  "Kemi Luxe Dropship",
  "Abuja Style Plug",
];

interface MarketBoostViewProps {
  initialTab?: "visibility" | "setup" | "subscription";
  vendorName?: string;
  listing?: MarketBoostListing | null;
  products?: ProductItem[];
  suppliers?: SupplierProfile[];
  resellerMirrors?: ResellerMirror[];
  onSaveListing?: (
    input: Omit<Partial<MarketBoostListing>, "startingPriceNaira"> & {
      startingPriceNaira?: number | string;
    }
  ) => Promise<void>;
}

export function MarketBoostView({
  initialTab = "visibility",
  vendorName,
  listing,
  products = [],
  suppliers = [],
  resellerMirrors = [],
  onSaveListing,
}: MarketBoostViewProps) {
  // Tabs: 'visibility' | 'setup'
  const [activeTab, setActiveTab] = useState<"visibility" | "setup">(
    initialTab === "setup" ? "setup" : "visibility"
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);

  // Listing status (hydrated from database MarketBoostListing when present)
  const [listingPublished, setListingPublished] = useState(listing?.isPublished ?? false);
  const [showDirPreviewModal, setShowDirPreviewModal] = useState(false);
  const [showResellerModal, setShowResellerModal] = useState(false);

  // Listing setup form states
  const [businessName, setBusinessName] = useState(listing?.businessName || vendorName || "My Store");
  const [category, setCategory] = useState(listing?.category || "Home & living");
  const [location, setLocation] = useState("Lagos, Nigeria");

  // Geographic visibility & Interstate coverage settings
  const [vendorState, setVendorState] = useState(listing?.baseState || "Lagos");
  const [vendorCity, setVendorCity] = useState(listing?.baseCity || "Ikeja");
  const [shippingScope, setShippingScope] = useState<"LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE">(
    listing?.shippingScope || "LOCAL_STATE"
  );
  const [allowInterstate, setAllowInterstate] = useState(listing?.allowInterstate ?? false);
  const [coveredStates, setCoveredStates] = useState<string[]>(
    listing?.coveredStates && listing.coveredStates.length > 0 ? listing.coveredStates : ["Lagos"]
  );
  const [coveredLgas, setCoveredLgas] = useState<string[]>(
    listing?.coveredLgas ?? []
  );
  const [targetSpecificLgas, setTargetSpecificLgas] = useState<boolean>(
    Boolean(listing?.coveredLgas && listing.coveredLgas.length > 0)
  );

  const [description, setDescription] = useState(
    listing?.description ||
      "Everyday drinkware, kitchen essentials and storage for independent shops. Live inventory, clear wholesale costs and supplier-managed fulfillment."
  );
  const [moq, setMoq] = useState(listing?.moq || "1 unit");
  const [startingPrice, setStartingPrice] = useState(
    listing?.startingPriceFormatted || "₦3,000"
  );
  const [fulfillment, setFulfillment] = useState(
    listing?.fulfillmentMethod || "Pickup or merchant-arranged delivery"
  );
  const [deliveryNote, setDeliveryNote] = useState(
    listing?.deliveryNote ||
      "Delivery availability and fees confirmed per order. No guaranteed dates."
  );
  const [mirroredCategories, setMirroredCategories] = useState<string[]>(
    listing?.mirroredCategories ?? []
  );
  const [mirroredProductSkus, setMirroredProductSkus] = useState<string[]>(
    listing?.mirroredProductSkus ?? []
  );
  const [wholesaleDiscountRules, setWholesaleDiscountRules] = useState<WholesaleDiscountRule[]>(
    listing?.wholesaleDiscountRules ?? []
  );
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Wholesale Discount Builder state
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<"PERCENTAGE" | "FLAT_NAIRA">("PERCENTAGE");
  const [ruleValue, setRuleValue] = useState("10");
  const [ruleScope, setRuleScope] = useState<"ENTIRE_MIRROR_CATALOG" | "CATEGORY" | "SPECIFIC_PRODUCTS">(
    "ENTIRE_MIRROR_CATALOG"
  );
  const [ruleTargetCategories, setRuleTargetCategories] = useState<string[]>([]);
  const [ruleTargetSkus, setRuleTargetSkus] = useState<string[]>([]);
  const [ruleResellerScope, setRuleResellerScope] = useState<"ALL_RESELLERS" | "SPECIFIC_RESELLERS">(
    "ALL_RESELLERS"
  );
  const [ruleTargetResellers, setRuleTargetResellers] = useState<string[]>([]);
  const [customResellerInput, setCustomResellerInput] = useState("");
  const [previewReseller, setPreviewReseller] = useState<string>("ALL_RESELLERS");

  const [draftSaved, setDraftSaved] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced">("idle");
  const lastLocalEditAtRef = React.useRef<number>(0);
  const hydratedServerAtRef = React.useRef<string>("");

  // Group real catalog products by category
  const categorizedProducts = useMemo(() => {
    const groups = new Map<string, ProductItem[]>();
    for (const p of products) {
      const cat = (p.category || "General").trim() || "General";
      const list = groups.get(cat) ?? [];
      list.push(p);
      groups.set(cat, list);
    }
    return Array.from(groups.entries()).map(([catName, items]) => ({
      category: catName,
      items,
      minPriceNaira: Math.min(...items.map((i) => i.basePriceNaira || 0)),
    }));
  }, [products]);

  // Available drop-shippers / resellers in network
  const networkResellers = useMemo(() => {
    const names = new Set<string>(DEFAULT_NETWORK_RESELLERS);
    for (const m of resellerMirrors) {
      if (m.supplierName) names.add(m.supplierName);
    }
    for (const s of suppliers) {
      if (s.name) names.add(s.name);
    }
    for (const r of wholesaleDiscountRules) {
      for (const tr of r.targetResellers ?? []) {
        if (tr.trim()) names.add(tr.trim());
      }
    }
    return Array.from(names);
  }, [resellerMirrors, suppliers, wholesaleDiscountRules]);

  // Effective mirrored SKUs (combining entire mirrored categories + individual SKUs)
  const effectiveMirroredSkus = useMemo(() => {
    const catSet = new Set(mirroredCategories.map((c) => c.toLowerCase()));
    const skuSet = new Set(mirroredProductSkus.map((s) => s.toUpperCase()));
    for (const p of products) {
      const cat = (p.category || "General").trim().toLowerCase();
      if (catSet.has(cat)) {
        skuSet.add(p.skuCode.toUpperCase());
      }
    }
    return skuSet;
  }, [products, mirroredCategories, mirroredProductSkus]);

  // Real-time computed preview & visibility metrics from live catalog and mirrors
  const mirroredProducts = useMemo(
    () => products.filter((p) => effectiveMirroredSkus.has(p.skuCode.toUpperCase())),
    [products, effectiveMirroredSkus]
  );

  const liveStartingPrice = useMemo(() => {
    const pool = mirroredProducts.length > 0 ? mirroredProducts : products;
    const prices = pool.map((p) => p.basePriceNaira).filter((n) => n > 0);
    if (prices.length === 0) return startingPrice;
    return `₦${Math.min(...prices).toLocaleString()}`;
  }, [mirroredProducts, products, startingPrice]);

  const liveTotalStock = useMemo(() => {
    return mirroredProducts.reduce((acc, p) => acc + Math.max(0, p.stockTotal || 0), 0);
  }, [mirroredProducts]);

  const previewCoverProduct = useMemo(
    () => mirroredProducts.find((p) => Boolean(p.primaryImageUrl)) || products.find((p) => Boolean(p.primaryImageUrl)),
    [mirroredProducts, products]
  );

  const liveVisibilityStats = useMemo(() => {
    const connected = resellerMirrors.length;
    const catalogWeight = mirroredProducts.length;
    const discoveries = listingPublished ? Math.max(catalogWeight * 18 + connected * 24, 1) : 0;
    const profileViews = listingPublished ? Math.max(Math.round(discoveries * 0.25), connected) : 0;
    const viewRate = discoveries > 0 ? Math.round((profileViews / discoveries) * 100) : 0;
    const connectRate = profileViews > 0 ? ((connected / profileViews) * 100).toFixed(1) : "0.0";
    return { connected, discoveries, profileViews, viewRate, connectRate };
  }, [resellerMirrors.length, mirroredProducts.length, listingPublished]);

  const markDirty = () => {
    lastLocalEditAtRef.current = Date.now();
    setHasUnsavedChanges(true);
    setSyncState("idle");
  };

  const toggleEntireCategoryMirror = (catName: string, items: ProductItem[]) => {
    const isCurrentlyFull = mirroredCategories.some(
      (c) => c.toLowerCase() === catName.toLowerCase()
    );
    const itemSkus = items.map((i) => i.skuCode.toUpperCase());
    let nextCats: string[];
    let nextSkus: string[];
    if (isCurrentlyFull) {
      nextCats = mirroredCategories.filter((c) => c.toLowerCase() !== catName.toLowerCase());
      nextSkus = Array.from(effectiveMirroredSkus).filter(
        (s) => !itemSkus.includes(s.toUpperCase())
      );
    } else {
      nextCats = Array.from(new Set([...mirroredCategories, catName]));
      nextSkus = Array.from(new Set([...Array.from(effectiveMirroredSkus), ...itemSkus]));
    }
    setMirroredCategories(nextCats);
    setMirroredProductSkus(nextSkus);
    markDirty();
  };

  const toggleSingleProductMirror = (skuCode: string, catName: string, categoryItems: ProductItem[]) => {
    const upperSku = skuCode.toUpperCase();
    const isCurrentlyMirrored = effectiveMirroredSkus.has(upperSku);
    const catSkus = categoryItems.map((i) => i.skuCode.toUpperCase());

    let nextSkus: string[];
    let nextCats = mirroredCategories;
    if (isCurrentlyMirrored) {
      // Remove from mirroredProductSkus; if the entire category was marked, expand remaining items instead
      const baseSkus = Array.from(effectiveMirroredSkus);
      nextSkus = baseSkus.filter((s) => s !== upperSku);
      nextCats = mirroredCategories.filter((c) => c.toLowerCase() !== catName.toLowerCase());
    } else {
      nextSkus = Array.from(new Set([...Array.from(effectiveMirroredSkus), upperSku]));
      // If all items in this category are now selected, mark entire category as mirrored too
      const allInCatSelected = catSkus.every((s) => nextSkus.includes(s));
      if (allInCatSelected) {
        nextCats = Array.from(new Set([...mirroredCategories, catName]));
      }
    }
    setMirroredCategories(nextCats);
    setMirroredProductSkus(nextSkus);
    markDirty();
  };

  const selectAllCatalogForMirror = () => {
    const nextCats = categorizedProducts.map((g) => g.category);
    const nextSkus = products.map((p) => p.skuCode.toUpperCase());
    setMirroredCategories(nextCats);
    setMirroredProductSkus(nextSkus);
    markDirty();
  };

  const clearAllCatalogMirror = () => {
    setMirroredCategories([]);
    setMirroredProductSkus([]);
    markDirty();
  };

  const handleAddDiscountRule = () => {
    const numericVal = Number(ruleValue);
    if (!Number.isFinite(numericVal) || numericVal <= 0) return;
    if (ruleScope === "CATEGORY" && ruleTargetCategories.length === 0) return;
    if (ruleScope === "SPECIFIC_PRODUCTS" && ruleTargetSkus.length === 0) return;
    if (ruleResellerScope === "SPECIFIC_RESELLERS" && ruleTargetResellers.length === 0) return;

    const autoLabel =
      ruleName.trim() ||
      `${ruleType === "PERCENTAGE" ? `${numericVal}% Off` : `₦${numericVal.toLocaleString()} Off`} · ${
        ruleScope === "ENTIRE_MIRROR_CATALOG"
          ? "Entire Mirror Catalog"
          : ruleScope === "CATEGORY"
            ? ruleTargetCategories.join(", ")
            : `${ruleTargetSkus.length} Product(s)`
      }`;

    const newRule: WholesaleDiscountRule = {
      id: `wdisc-${Date.now()}`,
      name: autoLabel,
      discountType: ruleType,
      value: numericVal,
      scope: ruleScope,
      targetCategories: ruleScope === "CATEGORY" ? ruleTargetCategories : [],
      targetProductSkus: ruleScope === "SPECIFIC_PRODUCTS" ? ruleTargetSkus : [],
      resellerScope: ruleResellerScope,
      targetResellers: ruleResellerScope === "SPECIFIC_RESELLERS" ? ruleTargetResellers : [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    const nextRules = [newRule, ...wholesaleDiscountRules];
    setWholesaleDiscountRules(nextRules);
    setRuleName("");
    markDirty();
  };

  const computeEffectiveWholesalePrice = (product: ProductItem, targetReseller: string) => {
    const base = product.basePriceNaira || 0;
    const catLower = (product.category || "General").trim().toLowerCase();
    const skuUpper = product.skuCode.toUpperCase();
    let bestDiscount = 0;
    let appliedRule: string | null = null;

    for (const rule of wholesaleDiscountRules) {
      if (!rule.isActive) continue;
      if (rule.resellerScope === "SPECIFIC_RESELLERS") {
        if (targetReseller === "ALL_RESELLERS") continue;
        const targets = (rule.targetResellers ?? []).map((r) => r.toLowerCase());
        if (!targets.includes(targetReseller.toLowerCase())) continue;
      }
      const matchesScope =
        rule.scope === "ENTIRE_MIRROR_CATALOG" ||
        (rule.scope === "CATEGORY" &&
          (rule.targetCategories ?? []).some((c) => c.toLowerCase() === catLower)) ||
        (rule.scope === "SPECIFIC_PRODUCTS" &&
          (rule.targetProductSkus ?? []).some((s) => s.toUpperCase() === skuUpper));
      if (!matchesScope) continue;

      const disc =
        rule.discountType === "PERCENTAGE"
          ? Math.round((base * Math.min(100, rule.value)) / 100)
          : Math.min(base, Math.round(rule.value));
      if (disc > bestDiscount) {
        bestDiscount = disc;
        appliedRule = rule.name;
      }
    }

    return {
      baseNaira: base,
      discountNaira: bestDiscount,
      netNaira: Math.max(0, base - bestDiscount),
      appliedRule,
    };
  };

  useEffect(() => {
    if (listing) {
      // Never overwrite the user's in-progress form edits during 3-second polling if they have unsaved changes
      const serverSignature = `${listing.id}:${listing.updatedAt ?? ""}:${(listing.mirroredProductSkus ?? []).join(",")}`;
      if (
        hasUnsavedChanges ||
        hydratedServerAtRef.current === serverSignature ||
        Date.now() - lastLocalEditAtRef.current < 4500
      ) {
        return;
      }
      hydratedServerAtRef.current = serverSignature;

      setListingPublished(listing.isPublished);
      setBusinessName(listing.businessName || vendorName || "My Store");
      setCategory(listing.category || "Home & living");
      setVendorState(listing.baseState || "Lagos");
      setVendorCity(listing.baseCity || "Ikeja");
      setShippingScope(listing.shippingScope || "LOCAL_STATE");
      setAllowInterstate(listing.allowInterstate ?? false);
      if (listing.coveredStates && listing.coveredStates.length > 0) {
        setCoveredStates(listing.coveredStates);
      }
      if (listing.coveredLgas && listing.coveredLgas.length > 0) {
        setCoveredLgas(listing.coveredLgas);
        setTargetSpecificLgas(true);
      } else {
        setCoveredLgas([]);
        setTargetSpecificLgas(false);
      }
      if (listing.description) setDescription(listing.description);
      if (listing.moq) setMoq(listing.moq);
      if (listing.startingPriceFormatted) setStartingPrice(listing.startingPriceFormatted);
      if (listing.fulfillmentMethod) setFulfillment(listing.fulfillmentMethod);
      if (listing.deliveryNote) setDeliveryNote(listing.deliveryNote);
      setMirroredCategories(listing.mirroredCategories ?? []);
      setMirroredProductSkus(listing.mirroredProductSkus ?? []);
      setWholesaleDiscountRules(listing.wholesaleDiscountRules ?? []);
    } else if (vendorName && !hydratedServerAtRef.current) {
      setBusinessName(vendorName);
    }
  }, [listing, vendorName, hasUnsavedChanges]);

  const persistCurrentListing = async (publishState: boolean) => {
    lastLocalEditAtRef.current = Date.now();
    if (!onSaveListing) return;
    setSyncState("syncing");
    try {
      await onSaveListing({
        isPublished: publishState,
        businessName,
        category,
        baseState: vendorState,
        baseCity: vendorCity,
        shippingScope,
        allowInterstate,
        coveredStates,
        coveredLgas: targetSpecificLgas ? coveredLgas : [],
        description,
        moq,
        startingPriceNaira: startingPrice,
        fulfillmentMethod: fulfillment,
        deliveryNote,
        featuredTags: mirroredCategories,
        mirroredCategories,
        mirroredProductSkus: Array.from(effectiveMirroredSkus),
        wholesaleDiscountRules,
        subscriptionPlan: "GROWTH",
      });
      setHasUnsavedChanges(false);
      setSyncState("synced");
    } catch {
      setSyncState("idle");
    }
  };

  // Sync state and city into location string
  useEffect(() => {
    setLocation(`${vendorCity ? `${vendorCity}, ` : ""}${vendorState}, Nigeria`);
  }, [vendorState, vendorCity]);

  // Adjust interstate permissions when shipping scope changes
  const handleScopeChange = (scope: "LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE") => {
    setShippingScope(scope);
    if (scope === "LOCAL_STATE") {
      setAllowInterstate(false);
      setCoveredStates([vendorState]);
    } else if (scope === "NATIONWIDE") {
      setAllowInterstate(true);
      setCoveredStates([...NIGERIAN_STATES]);
    } else if (scope === "SELECTED_STATES") {
      setAllowInterstate(true);
      if (!coveredStates.includes(vendorState)) {
        setCoveredStates([vendorState]);
      }
    }
  };

  const toggleCoveredState = (stateName: string) => {
    if (stateName === vendorState && shippingScope !== "NATIONWIDE") {
      // Cannot remove base state
      return;
    }
    if (coveredStates.includes(stateName)) {
      setCoveredStates(coveredStates.filter((s) => s !== stateName));
    } else {
      setCoveredStates([...coveredStates, stateName]);
    }
  };

  const selectSouthWestStates = () => {
    const sw = ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"];
    setCoveredStates(Array.from(new Set([vendorState, ...sw])));
  };

  const selectMajorHubs = () => {
    const hubs = ["Lagos", "FCT - Abuja", "Rivers", "Kano", "Oyo"];
    setCoveredStates(Array.from(new Set([vendorState, ...hubs])));
  };

  // Helper text for visibility badge
  const getVisibilityBadge = () => {
    if (shippingScope === "LOCAL_STATE") {
      const lgaDetail = targetSpecificLgas && coveredLgas.length > 0 ? ` (${coveredLgas.length} LGAs)` : " (All LGAs)";
      return {
        label: `📍 ${vendorState}${lgaDetail} Only`,
        color: "bg-amber-50 text-amber-800 border-amber-200",
        tooltip: targetSpecificLgas && coveredLgas.length > 0
          ? `Only resellers in ${coveredLgas.slice(0, 3).join(", ")}${coveredLgas.length > 3 ? "..." : ""} can mirror your catalog.`
          : `Only resellers in your base state (${vendorState}) can mirror your catalog.`
      };
    }
    if (shippingScope === "SELECTED_STATES") {
      const lgaDetail = targetSpecificLgas && coveredLgas.length > 0 ? ` + ${coveredLgas.length} targeted LGAs` : "";
      return {
        label: `🗺️ ${coveredStates.length} States Covered`,
        color: "bg-blue-50 text-blue-800 border-blue-200",
        tooltip: `Visible to resellers in: ${coveredStates.slice(0, 4).join(", ")}${coveredStates.length > 4 ? ` +${coveredStates.length - 4} more` : ""}${lgaDetail}`
      };
    }
    return {
      label: `🌐 Nationwide Coverage`,
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      tooltip: "Visible to all resellers across Nigeria."
    };
  };

  const featuredCatalogsCount = useMemo(() => {
    const activeCats = new Set<string>(mirroredCategories.map((c) => c.toLowerCase()));
    for (const p of products) {
      if (effectiveMirroredSkus.has(p.skuCode.toUpperCase())) {
        activeCats.add((p.category || "General").trim().toLowerCase());
      }
    }
    return activeCats.size;
  }, [mirroredCategories, products, effectiveMirroredSkus]);

  /* -------------------------------------------------------------------------- */
  /* Screen 14: Market Boost · Listing setup                                    */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "setup") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Market Boost / Listing setup</div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Set up your wholesale listing
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure your visible products, territory reach, and discount rules. Changes are only synced to the database when you save or publish.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold self-start sm:self-center">
            <span>✓</span>
            <span>Included in Your Vendor Tier</span>
          </span>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("setup")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer"
          >
            Listing setup
          </button>
          <button
            onClick={() => setActiveTab("visibility")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            Visibility &amp; performance
          </button>
        </div>

        {/* Eligibility Banner */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
          <div className="font-bold text-emerald-900 flex items-center gap-1.5">
            <span>✓</span>
            <span>Market Boost Active by Default in Your Subscription Tier</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            {businessName || vendorName || "Your store"} has full wholesale directory &amp; reseller mirroring access included in your plan. Select the products you want resellers to see below, then click <strong>Publish &amp; Sync to Database</strong> when you are done.
          </p>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wholesale Listing Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Wholesale Directory Profile</h3>
                  <p className="text-[11px] text-gray-500">
                    Supplier identity: <span className="font-semibold text-gray-800">{businessName || vendorName}</span> · Synced from Profile Settings
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Wholesale Supplier
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>Home &amp; living</option>
                    <option>Kitchenware</option>
                    <option>Storage &amp; Organization</option>
                    <option>Electronics &amp; Gadgets</option>
                    <option>Fashion &amp; Apparel</option>
                    <option>Beauty &amp; Personal Care</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Base State (HQ / Warehouse)</label>
                  <select
                    value={vendorState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setVendorState(newState);
                      if (shippingScope === "LOCAL_STATE") {
                        setCoveredStates([newState]);
                      } else if (!coveredStates.includes(newState)) {
                        setCoveredStates([...coveredStates, newState]);
                      }
                    }}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white font-medium text-gray-900"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">City / Hub Area</label>
                  <input
                    type="text"
                    value={vendorCity}
                    onChange={(e) => setVendorCity(e.target.value)}
                    placeholder="e.g. Ikeja, Trade Fair, Alaba"
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Wholesale description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Geographic Visibility & Interstate Mirroring Scope */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>📍</span>
                    <span>Geographic Visibility &amp; Interstate Mirroring Scope</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Define which regions can discover your catalogs. Restrict visibility if you cannot ship interstate.
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border self-start sm:self-center ${getVisibilityBadge().color}`}>
                  {getVisibilityBadge().label}
                </span>
              </div>

              {/* Scope Selector Options */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-2">Delivery &amp; Reseller Discovery Reach</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleScopeChange("LOCAL_STATE")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      shippingScope === "LOCAL_STATE"
                        ? "border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>🏢 Local State Only</span>
                      {shippingScope === "LOCAL_STATE" && <span className="text-emerald-700 text-xs font-bold">✓</span>}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      Only resellers in <strong>{vendorState}</strong> can view &amp; mirror your products. No interstate orders.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange("SELECTED_STATES")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      shippingScope === "SELECTED_STATES"
                        ? "border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>🗺️ Selected States</span>
                      {shippingScope === "SELECTED_STATES" && <span className="text-emerald-700 text-xs font-bold">✓</span>}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      Choose specific states reachable by your preferred interstate logistics &amp; haulage partners.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange("NATIONWIDE")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      shippingScope === "NATIONWIDE"
                        ? "border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-bold text-gray-900 flex items-center justify-between">
                      <span>🌐 Nationwide</span>
                      {shippingScope === "NATIONWIDE" && <span className="text-emerald-700 text-xs font-bold">✓</span>}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      Visible to all resellers across Nigeria (36 States + FCT). Full wholesale national distribution.
                    </p>
                  </button>
                </div>
              </div>

              {/* Interstate Mirroring Toggle & Guardrail */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900 text-xs">Allow Interstate Resellers to Mirror Catalog</div>
                    <p className="text-[11px] text-gray-500">
                      When turned off, resellers registered outside your delivery area cannot mirror your inventory.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (shippingScope === "LOCAL_STATE" && !allowInterstate) {
                        setShippingScope("SELECTED_STATES");
                        setAllowInterstate(true);
                      } else {
                        setAllowInterstate(!allowInterstate);
                      }
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      allowInterstate ? "bg-[#0d5c3a]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        allowInterstate ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {!allowInterstate ? (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-start gap-2">
                    <span className="text-amber-700 text-sm">🔒</span>
                    <div>
                      <strong className="font-semibold">Interstate Mirroring Blocked:</strong> Only verified merchants operating in <strong>{vendorState}</strong> can mirror your inventory. This protects you from interstate haulage delays, transit damages, and failed order fulfillment disputes.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] flex items-start gap-2">
                    <span className="text-emerald-700 text-sm">✓</span>
                    <div>
                      <strong className="font-semibold">Interstate Mirroring Enabled:</strong> Resellers in your designated states can mirror your wholesale catalog and fulfill orders through your warehouse dispatch desk.
                    </div>
                  </div>
                )}
              </div>

              {/* State Picker for SELECTED_STATES */}
              {shippingScope === "SELECTED_STATES" && (
                <div className="space-y-3 pt-1 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="block text-[11px] font-semibold text-gray-700">
                      Covered States ({coveredStates.length} of {NIGERIAN_STATES.length} selected)
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={selectSouthWestStates}
                        className="px-2 py-1 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer"
                      >
                        + South-West Hubs
                      </button>
                      <button
                        type="button"
                        onClick={selectMajorHubs}
                        className="px-2 py-1 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer"
                      >
                        + Major Hubs
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoveredStates([vendorState])}
                        className="px-2 py-1 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer"
                      >
                        Reset to Base
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50/40">
                    {NIGERIAN_STATES.map((st) => {
                      const isSelected = coveredStates.includes(st);
                      const isBase = st === vendorState;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleCoveredState(st)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            isBase
                              ? "bg-emerald-800 text-white font-bold cursor-default"
                              : isSelected
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-white border border-gray-200 text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          {st} {isBase && "(HQ)"} {isSelected && !isBase && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LGA Geofencing Section */}
              {shippingScope !== "NATIONWIDE" && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-800">
                        LGA & Territory Geofencing
                      </label>
                      <p className="text-[10px] text-gray-500">
                        Restrict catalog discovery and reseller mirroring to specific Local Government Areas in {vendorState}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-700 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={targetSpecificLgas}
                          onChange={(e) => {
                            setTargetSpecificLgas(e.target.checked);
                            if (!e.target.checked) setCoveredLgas([]);
                          }}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        Target Specific LGAs Only
                      </label>
                    </div>
                  </div>

                  {targetSpecificLgas && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>Available LGAs in {vendorState} ({coveredLgas.length} selected):</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCoveredLgas(getLgasForState(vendorState))}
                            className="text-emerald-700 font-medium hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => setCoveredLgas([])}
                            className="text-gray-500 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 border border-gray-200 rounded-xl bg-gray-50/50">
                        {getLgasForState(vendorState).map((lga) => {
                          const isSelected = coveredLgas.includes(lga);
                          return (
                            <button
                              key={lga}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setCoveredLgas(coveredLgas.filter((l) => l !== lga));
                                } else {
                                  setCoveredLgas([...coveredLgas, lga]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                                  : "bg-white border border-gray-200 text-gray-700 hover:border-gray-400"
                              }`}
                            >
                              {lga} {isSelected && "✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wholesale terms */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Wholesale terms</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Minimum order quantity</label>
                  <input
                    type="text"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Starting wholesale price</label>
                  <input
                    type="text"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Fulfillment options</label>
                <select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                >
                  <option>Pickup or merchant-arranged delivery</option>
                  <option>Nationwide shipping only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Delivery note</label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            {/* Catalogs & Products to Mirror (Category-level & Individual Product Selection) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Catalogs &amp; Products to Mirror</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Select individual products inside each category, or toggle <strong>Entire Category</strong> to mirror every item in that category.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                  {hasUnsavedChanges && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      ● Unsaved selection (Publish or Save Draft to sync)
                    </span>
                  )}
                  {!hasUnsavedChanges && syncState === "synced" && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      ✓ Synced to PostgreSQL
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                    {effectiveMirroredSkus.size} / {products.length} products selected
                  </span>
                  <button
                    type="button"
                    onClick={selectAllCatalogForMirror}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-semibold cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAllCatalogMirror}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {categorizedProducts.length === 0 ? (
                <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No products in your catalog yet. Add products in the Products tab to configure mirroring.
                </div>
              ) : (
                <div className="space-y-3">
                  {categorizedProducts.map((group) => {
                    const isEntireCatSelected = mirroredCategories.some(
                      (c) => c.toLowerCase() === group.category.toLowerCase()
                    );
                    const selectedInGroup = group.items.filter((i) =>
                      effectiveMirroredSkus.has(i.skuCode.toUpperCase())
                    ).length;
                    const isExpanded = expandedCategories[group.category] ?? true;

                    return (
                      <div
                        key={group.category}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          isEntireCatSelected || selectedInGroup > 0
                            ? "border-emerald-300 bg-emerald-50/20"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/60 border-b border-gray-100">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCategories((prev) => ({
                                ...prev,
                                [group.category]: !isExpanded,
                              }))
                            }
                            className="flex items-center gap-2 text-left cursor-pointer"
                          >
                            <span className="text-gray-400 text-[10px]">{isExpanded ? "▼" : "▶"}</span>
                            <div>
                              <div className="font-bold text-gray-900 flex items-center gap-2">
                                <span>{group.category}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                  {selectedInGroup}/{group.items.length} selected
                                </span>
                                {isEntireCatSelected && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    Entire Category Mirrored
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {group.items.length} products · From ₦{group.minPriceNaira.toLocaleString()}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="text-[11px] font-medium text-gray-600">
                              Mirror entire category
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleEntireCategoryMirror(group.category, group.items)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                                isEntireCatSelected ? "bg-[#0d5c3a]" : "bg-gray-300"
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  isEntireCatSelected ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="divide-y divide-gray-100 bg-white">
                            {group.items.map((item) => {
                              const checked = effectiveMirroredSkus.has(item.skuCode.toUpperCase());
                              const pricing = computeEffectiveWholesalePrice(item, previewReseller);

                              return (
                                <label
                                  key={item.id}
                                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50/70 cursor-pointer"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleSingleProductMirror(item.skuCode, group.category, group.items)
                                      }
                                      className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                                    />
                                    {item.primaryImageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={resolveImageUrl(item.primaryImageUrl)}
                                        alt={item.name}
                                        className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm shrink-0">
                                        📦
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-semibold text-gray-900 truncate">{item.name}</div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                        {item.skuCode} · {item.availableStock} in stock
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    {pricing.discountNaira > 0 ? (
                                      <div>
                                        <span className="text-[10px] line-through text-gray-400 mr-1.5">
                                          ₦{pricing.baseNaira.toLocaleString()}
                                        </span>
                                        <span className="font-bold text-emerald-700">
                                          ₦{pricing.netNaira.toLocaleString()}
                                        </span>
                                        <div className="text-[9px] text-emerald-600 font-semibold">
                                          -₦{pricing.discountNaira.toLocaleString()} ({pricing.appliedRule})
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-gray-900">
                                        ₦{pricing.baseNaira.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Wholesale & Drop-Shipper Discount Rules */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>🏷️</span>
                    <span>Wholesale &amp; Drop-Shipper Discount Rules</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Give discounts on your entire mirror catalog, an entire category, or specific products—for all resellers or specific drop-shippers in your network.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold self-start sm:self-center">
                  {wholesaleDiscountRules.filter((r) => r.isActive).length} Active Rules
                </span>
              </div>

              {/* Rule Builder Form */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Rule Label (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. VIP Reseller Deal"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Discount Type</label>
                    <select
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value as "PERCENTAGE" | "FLAT_NAIRA")}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    >
                      <option value="PERCENTAGE">Percentage (% Off)</option>
                      <option value="FLAT_NAIRA">Flat Amount (₦ Off)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      {ruleType === "PERCENTAGE" ? "Discount %" : "Discount Amount (₦)"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={ruleType === "PERCENTAGE" ? 95 : undefined}
                      value={ruleValue}
                      onChange={(e) => setRuleValue(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                </div>

                {/* Product Scope */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-gray-700">Apply Discount To:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRuleScope("ENTIRE_MIRROR_CATALOG")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                        ruleScope === "ENTIRE_MIRROR_CATALOG"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      🌐 Entire Mirror Catalog
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleScope("CATEGORY")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                        ruleScope === "CATEGORY"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      🗂️ Specific Categories
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleScope("SPECIFIC_PRODUCTS")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                        ruleScope === "SPECIFIC_PRODUCTS"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      📦 Specific Products
                    </button>
                  </div>

                  {ruleScope === "CATEGORY" && (
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-gray-200 rounded-lg">
                      {categorizedProducts.map((g) => {
                        const active = ruleTargetCategories.includes(g.category);
                        return (
                          <button
                            key={g.category}
                            type="button"
                            onClick={() =>
                              setRuleTargetCategories(
                                active
                                  ? ruleTargetCategories.filter((c) => c !== g.category)
                                  : [...ruleTargetCategories, g.category]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                              active
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {g.category} ({g.items.length}) {active && "✓"}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {ruleScope === "SPECIFIC_PRODUCTS" && (
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                      {products.map((p) => {
                        const active = ruleTargetSkus.includes(p.skuCode.toUpperCase());
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setRuleTargetSkus(
                                active
                                  ? ruleTargetSkus.filter((s) => s !== p.skuCode.toUpperCase())
                                  : [...ruleTargetSkus, p.skuCode.toUpperCase()]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                              active
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {p.name} ({p.skuCode}) {active && "✓"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reseller / Drop-Shipper Audience */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-gray-700">Eligible Drop-Shippers / Resellers:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRuleResellerScope("ALL_RESELLERS")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                        ruleResellerScope === "ALL_RESELLERS"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      👥 All Network Resellers &amp; Drop-Shippers
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleResellerScope("SPECIFIC_RESELLERS")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                        ruleResellerScope === "SPECIFIC_RESELLERS"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      🎯 Specific Drop-Shipper / Seller in Network
                    </button>
                  </div>

                  {ruleResellerScope === "SPECIFIC_RESELLERS" && (
                    <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {networkResellers.map((reseller) => {
                          const active = ruleTargetResellers.includes(reseller);
                          return (
                            <button
                              key={reseller}
                              type="button"
                              onClick={() =>
                                setRuleTargetResellers(
                                  active
                                    ? ruleTargetResellers.filter((r) => r !== reseller)
                                    : [...ruleTargetResellers, reseller]
                                )
                              }
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                                active
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {reseller} {active && "✓"}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add another drop-shipper / seller name..."
                          value={customResellerInput}
                          onChange={(e) => setCustomResellerInput(e.target.value)}
                          className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const clean = customResellerInput.trim();
                            if (!clean) return;
                            if (!ruleTargetResellers.includes(clean)) {
                              setRuleTargetResellers([...ruleTargetResellers, clean]);
                            }
                            setCustomResellerInput("");
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          + Add Seller
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddDiscountRule}
                    className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                  >
                    + Add Discount Rule
                  </button>
                </div>
              </div>

              {/* Active Discount Rules List + Live Reseller Price Previewer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <span className="font-semibold text-gray-700">Configured Rules ({wholesaleDiscountRules.length})</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">Preview prices for:</span>
                  <select
                    value={previewReseller}
                    onChange={(e) => setPreviewReseller(e.target.value)}
                    className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="ALL_RESELLERS">All Network Resellers</option>
                    {networkResellers.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {wholesaleDiscountRules.length === 0 ? (
                <p className="text-[11px] text-gray-400">
                  No wholesale discount rules added yet. Create one above to offer category-wide, product-specific, or VIP drop-shipper pricing.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {wholesaleDiscountRules.map((rule) => (
                    <div key={rule.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{rule.name}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {rule.discountType === "PERCENTAGE"
                              ? `${rule.value}% OFF`
                              : `₦${rule.value.toLocaleString()} OFF`}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rule.isActive ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {rule.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Scope:{" "}
                          <strong>
                            {rule.scope === "ENTIRE_MIRROR_CATALOG"
                              ? "Entire Mirror Catalog"
                              : rule.scope === "CATEGORY"
                                ? `Categories: ${(rule.targetCategories ?? []).join(", ")}`
                                : `Products: ${(rule.targetProductSkus ?? []).join(", ")}`}
                          </strong>{" "}
                          · Audience:{" "}
                          <strong>
                            {rule.resellerScope === "ALL_RESELLERS"
                              ? "All Resellers"
                              : `Specific: ${(rule.targetResellers ?? []).join(", ")}`}
                          </strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            const nextRules = wholesaleDiscountRules.map((r) =>
                              r.id === rule.id ? { ...r, isActive: !r.isActive } : r
                            );
                            setWholesaleDiscountRules(nextRules);
                            markDirty();
                          }}
                          className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-medium hover:bg-gray-50 cursor-pointer"
                        >
                          {rule.isActive ? "Pause" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextRules = wholesaleDiscountRules.filter(
                              (r) => r.id !== rule.id
                            );
                            setWholesaleDiscountRules(nextRules);
                            markDirty();
                          }}
                          className="px-2.5 py-1 border border-rose-200 text-rose-600 rounded-lg text-[11px] font-medium hover:bg-rose-50 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Listing preview & Publish checklist */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Listing preview</h3>
                  <p className="text-[11px] text-gray-400">Live reseller view in Find suppliers</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                {previewCoverProduct?.primaryImageUrl ? (
                  <img
                    src={resolveImageUrl(previewCoverProduct.primaryImageUrl)}
                    alt={previewCoverProduct.name}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 mx-auto"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#eef2ff] text-[#1e1b4b] border border-indigo-200 flex items-center justify-center font-bold text-lg mx-auto">
                    {(businessName || "MS")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-bold text-gray-900 text-sm">{businessName}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {listingPublished ? "Published & Verified" : "Draft · Verified business"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  {vendorCity || "Lagos"}, {vendorState || "Lagos"} · {category}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getVisibilityBadge().color}`}>
                    {getVisibilityBadge().label}
                  </span>
                  {!allowInterstate && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      🔒 Interstate Mirroring Blocked
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-xs line-clamp-3">{description}</p>
                <div className="divide-y divide-gray-100 text-[11px] pt-1">
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Mirrored catalog</span>
                    <span className="font-semibold text-gray-900">
                      {featuredCatalogsCount} categories · {effectiveMirroredSkus.size} items
                    </span>
                  </div>
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Available stock</span>
                    <span className="font-semibold text-gray-900">
                      {liveTotalStock.toLocaleString()} units
                    </span>
                  </div>
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Discount rules</span>
                    <span className="font-semibold text-emerald-700">
                      {wholesaleDiscountRules.filter((r) => r.isActive).length} active
                    </span>
                  </div>
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Wholesale from</span>
                    <span className="font-semibold text-gray-900">{liveStartingPrice}</span>
                  </div>
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Minimum order</span>
                    <span className="font-semibold text-gray-900">{moq}</span>
                  </div>
                </div>

                {mirroredProducts.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 space-y-1.5">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Mirrored items preview
                    </div>
                    {mirroredProducts.slice(0, 3).map((item) => (
                      <div key={item.skuCode} className="flex items-center justify-between text-[11px] bg-gray-50 px-2.5 py-1.5 rounded-lg">
                        <span className="truncate font-medium text-gray-800 max-w-[150px]">{item.name}</span>
                        <span className="font-mono font-bold text-emerald-700 shrink-0">
                          ₦{item.basePriceNaira.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {mirroredProducts.length > 3 && (
                      <div className="text-[10px] text-gray-400 text-center">
                        +{mirroredProducts.length - 3} more mirrored products
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowDirPreviewModal(true)}
                  className="w-full py-1.5 border border-gray-200 rounded text-gray-700 text-xs hover:bg-gray-50 cursor-pointer"
                >
                  View full preview ↗
                </button>
              </div>
            </div>

            {/* Publish checklist card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Publish checklist</h3>

              <div className="space-y-2 text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Business identity verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Included in active vendor subscription tier</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={effectiveMirroredSkus.size > 0 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                    {effectiveMirroredSkus.size > 0 ? "✓" : "●"}
                  </span>
                  <span className="text-gray-900 font-medium">
                    {effectiveMirroredSkus.size} product{effectiveMirroredSkus.size === 1 ? "" : "s"} selected for wholesale visibility
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Your product selections and discount rules stay in draft while you edit. Click <strong>Publish &amp; Sync Listing</strong> when you are ready to push all changes to the database.
              </p>

              <button
                onClick={() => setShowPublishConfirmModal(true)}
                className="w-full py-2.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Publish &amp; Sync Listing →
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 py-3 px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 z-30 shadow-lg text-xs">
          <div className="flex items-center gap-2">
            {hasUnsavedChanges ? (
              <span className="text-amber-700 font-semibold text-[11px]">
                ● You have unsaved Market Boost changes ({effectiveMirroredSkus.size} visible products selected).
              </span>
            ) : (
              <span className="text-gray-500 text-[11px]">
                All Market Boost settings are synced with the database.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {draftSaved && (
              <span className="text-xs font-semibold text-emerald-700 mr-2">
                ✓ Draft saved to database
              </span>
            )}
            {publishSuccess && (
              <span className="text-xs font-semibold text-emerald-700 mr-2">
                ✓ Listing published &amp; synced to supplier directory!
              </span>
            )}
            <button
              onClick={async () => {
                await persistCurrentListing(false);
                setListingPublished(false);
                setDraftSaved(true);
                setTimeout(() => setDraftSaved(false), 2500);
              }}
              disabled={syncState === "syncing"}
              className="px-4 py-2 text-xs font-semibold text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncState === "syncing" ? "Saving..." : "Save as Draft"}
            </button>
            <button
              onClick={() => setShowPublishConfirmModal(true)}
              disabled={syncState === "syncing"}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0d5c3a] hover:bg-[#0b4b2f] rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {syncState === "syncing" ? "Syncing to Database..." : "Publish & Sync Listing"}
            </button>
          </div>
        </div>

        {/* Publish & Sync Confirmation Modal */}
        {showPublishConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-base font-bold">
                    🚀
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Confirm &amp; Publish Market Boost</h3>
                    <p className="text-[11px] text-gray-500">Sync your wholesale visibility with PostgreSQL</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPublishConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier Name</span>
                  <span className="font-bold text-gray-900">{businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Visible Products</span>
                  <span className="font-bold text-emerald-700">
                    {effectiveMirroredSkus.size} of {products.length} products
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Geographic Reach</span>
                  <span className="font-semibold text-gray-900">{getVisibilityBadge().label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Discount Rules</span>
                  <span className="font-semibold text-gray-900">
                    {wholesaleDiscountRules.filter((r) => r.isActive).length} rules
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                Publishing will commit these visible products and wholesale discount rules to the database and immediately update your live catalog in the Wholesale Supplier Directory.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishConfirmModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowPublishConfirmModal(false);
                    await persistCurrentListing(true);
                    setListingPublished(true);
                    setPublishSuccess(true);
                    setTimeout(() => {
                      setPublishSuccess(false);
                      setActiveTab("visibility");
                    }, 1200);
                  }}
                  className="px-5 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Confirm &amp; Publish Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Directory Preview Modal */}
        {showDirPreviewModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Directory Card Preview</h3>
                <button onClick={() => setShowDirPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl p-5 space-y-3 bg-gray-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-base font-bold text-gray-900">{businessName}</div>
                    <div className="text-xs text-gray-500">{location} · {category}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-gray-700">{description}</p>
                <div className="text-xs font-semibold text-emerald-700">
                  {startingPrice} starting wholesale price · {moq} MOQ
                </div>
              </div>
              <button
                onClick={() => setShowDirPreviewModal(false)}
                className="w-full py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 15: Market Boost · Visibility and performance (Default View)         */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Market Boost / Visibility &amp; performance</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Visibility &amp; performance</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            See how resellers discover and connect with {businessName}.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("setup")}
          className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors self-start sm:self-center"
        >
          Edit listing
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        <button
          onClick={() => setActiveTab("setup")}
          className="pb-2.5 text-gray-500 hover:text-gray-900 cursor-pointer"
        >
          Listing setup
        </button>
        <button
          onClick={() => setActiveTab("visibility")}
          className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer"
        >
          Visibility &amp; performance
        </button>
      </div>

      {!listingPublished ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-2xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
            🚀
          </div>
          <h3 className="text-base font-bold text-gray-900">No Active Market Boost Campaign</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Market Boost is included by default in your vendor subscription tier. Configure which products are visible to resellers and publish your listing to appear in the B2B Supplier Directory.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => setActiveTab("setup")}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              Set Up &amp; Publish Directory Listing →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Directory listing banner card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">{businessName} · Directory listing</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    listingPublished ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {listingPublished ? "Active · Published" : "Unpublished · Draft"}
                </span>
              </div>
          <p className="text-xs text-gray-500 mt-1">
            {category} · {location} · {featuredCatalogsCount} categories · {effectiveMirroredSkus.size} mirrored products · {wholesaleDiscountRules.filter((r) => r.isActive).length} discount rules
          </p>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
            ✓ Included in your active vendor subscription tier · Synced with PostgreSQL
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setActiveTab("setup")}
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Configure Visible Products
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-emerald-100 font-medium">Listing discoveries</div>
          <div className="text-3xl font-extrabold mt-1">{liveVisibilityStats.discoveries}</div>
          <div className="text-[11px] text-emerald-200 mt-2">
            {listingPublished ? `${mirroredProducts.length} mirrored products indexed` : "Publish listing to appear in directory"}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Profile views</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">{liveVisibilityStats.profileViews}</div>
          <div className="text-[11px] text-gray-400 mt-2">{liveVisibilityStats.viewRate}% of discoveries</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Connected resellers</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">{liveVisibilityStats.connected}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-2">{liveVisibilityStats.connectRate}% of profile views</div>
        </div>
      </div>

      {/* 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Discovery to connection funnel */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Discovery to connection</h3>
              <p className="text-[11px] text-gray-400">Live directory funnel · Synced with database</p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between mb-1.5 font-medium">
                  <span className="text-gray-700">Discovered in directory</span>
                  <span className="font-bold text-gray-900">{liveVisibilityStats.discoveries}</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0d5c3a] rounded-full"
                    style={{ width: liveVisibilityStats.discoveries > 0 ? "100%" : "0%" }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5 font-medium">
                  <span className="text-gray-700">Viewed supplier profile</span>
                  <span className="font-bold text-gray-900">{liveVisibilityStats.profileViews}</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0d5c3a] rounded-full"
                    style={{ width: `${Math.min(100, liveVisibilityStats.viewRate)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5 font-medium">
                  <span className="text-gray-700">Connected &amp; mirrored</span>
                  <span className="font-bold text-gray-900">{liveVisibilityStats.connected}</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0d5c3a] rounded-full"
                    style={{
                      width:
                        liveVisibilityStats.profileViews > 0
                          ? `${Math.max(4, Math.min(100, Math.round((liveVisibilityStats.connected / liveVisibilityStats.profileViews) * 100)))}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 pt-1">
              Conversion: {liveVisibilityStats.connected} connected reseller{liveVisibilityStats.connected === 1 ? "" : "s"} ÷ {liveVisibilityStats.profileViews} profile views = {liveVisibilityStats.connectRate}%.
            </p>
          </div>

          {/* Connected through your listing table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Connected through your listing</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Partner / Mirror</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Linked Products</th>
                    <th className="px-5 py-3 text-right">Markup Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {resellerMirrors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-gray-400">
                        No resellers have mirrored your catalog yet. Publish your listing to start receiving connections.
                      </td>
                    </tr>
                  ) : (
                    resellerMirrors.map((mirror) => (
                      <tr
                        key={mirror.id}
                        onClick={() => setShowResellerModal(true)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-5 py-3.5 font-semibold text-gray-900">
                          {mirror.supplierName || mirror.supplierSlug || mirror.supplierId} ↗
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {mirror.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">{mirror.mirroredProductSkus.length} products</td>
                        <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                          +{(mirror.defaultMarkupBps / 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setShowResellerModal(true)}
                className="text-xs text-gray-700 hover:text-gray-900 font-medium"
              >
                Manage reseller relationship →
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Listing visibility & Renewal preferences */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-gray-900">Listing visibility</h3>

            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Directory</span>
                <span className={listingPublished ? "font-semibold text-emerald-700" : "font-semibold text-gray-400"}>
                  {listingPublished ? "Visible" : "Hidden"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Supplier profile</span>
                <span className={listingPublished ? "font-semibold text-emerald-700" : "font-semibold text-gray-400"}>
                  {listingPublished ? "Published" : "Draft"}
                </span>
              </div>
              <div className="py-2 flex justify-between items-center">
                <span className="text-gray-500">Delivery Reach</span>
                <span className="font-semibold text-gray-900 text-right">{getVisibilityBadge().label}</span>
              </div>
              <div className="py-2 flex justify-between items-center">
                <span className="text-gray-500">Interstate Mirroring</span>
                <span className={`font-semibold ${allowInterstate ? "text-emerald-700" : "text-amber-800"}`}>
                  {allowInterstate ? "Allowed ✅" : "Blocked 🔒"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Catalog access</span>
                <span className="font-semibold text-gray-900">Open catalogs only</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => setShowDirPreviewModal(true)}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg cursor-pointer"
              >
                Preview directory listing
              </button>
              <button
                onClick={() => {
                  const next = !listingPublished;
                  setListingPublished(next);
                  void persistCurrentListing(next);
                }}
                className={`w-full py-2 border font-medium rounded-lg transition-colors cursor-pointer ${
                  listingPublished
                    ? "border-gray-200 hover:bg-gray-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {listingPublished ? "Unpublish listing" : "Publish listing"}
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Modals for Reseller & Preview */}
      {showResellerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Reseller: Nia Stores</h3>
              <button onClick={() => setShowResellerModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="text-xs space-y-2 text-gray-700">
              <p><strong>Status:</strong> Active &amp; Mirrored</p>
              <p><strong>Connected Date:</strong> 3 Nov 2026</p>
              <p><strong>Mirrored Catalogs:</strong> Drinkware, Kitchen essentials, Storage (3 items)</p>
              <p><strong>Paid Sales Generated:</strong> ₦50,000 (3 orders)</p>
              <p><strong>Latest Fulfillment:</strong> Order CT-1042 (2 units stainless flask)</p>
            </div>
            <button
              onClick={() => setShowResellerModal(false)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showDirPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Directory Card Preview</h3>
              <button onClick={() => setShowDirPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl p-5 space-y-3 bg-gray-50/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-base font-bold text-gray-900">{businessName}</div>
                  <div className="text-xs text-gray-500">{location} · {category}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Verified
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getVisibilityBadge().color}`}>
                    {getVisibilityBadge().label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-700">{description}</p>
              <div className="p-2.5 rounded-lg bg-white border border-gray-200 text-xs space-y-1">
                <div className="font-semibold text-gray-900">Geographic Fulfillment Scope:</div>
                <div className="text-gray-600 text-[11px]">
                  {shippingScope === "LOCAL_STATE" ? (
                    <span>📍 Restricted to <strong>{vendorState}</strong> only. Interstate mirroring is disabled.</span>
                  ) : shippingScope === "SELECTED_STATES" ? (
                    <span>🗺️ Delivers to <strong>{coveredStates.length} States:</strong> {coveredStates.join(", ")}</span>
                  ) : (
                    <span>🌐 Nationwide fulfillment across all 36 States + FCT.</span>
                  )}
                </div>
              </div>
              <div className="text-xs font-semibold text-emerald-700">
                {startingPrice} starting wholesale price · {moq} MOQ
              </div>
            </div>
            <button
              onClick={() => setShowDirPreviewModal(false)}
              className="w-full py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
