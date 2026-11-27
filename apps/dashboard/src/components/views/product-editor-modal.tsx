"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ProductItem } from "@/lib/types";

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceNaira: number;
  stock: number;
}

interface CustomFieldItem {
  id: string;
  name: string;
  value: string;
}

export const PRESET_CATEGORIES = [
  "Fashion & Apparel",
  "Shoes, Bags & Footwear",
  "Beauty, Skincare & Cosmetics",
  "Hair, Wigs & Extensions",
  "Jewelry, Watches & Accessories",
  "Phones, Gadgets & Computers",
  "Electronics & Home Appliances",
  "Food, Groceries & Catering",
  "Kitchenware & Cookware",
  "Home, Living & Decor",
  "Health, Fitness & Wellness",
  "Baby, Kids & Toys",
  "Perfumes & Fragrances",
  "Books, Stationery & Crafts",
  "Automotive & Tools",
  "Other / Custom Category",
];

export function resolveStructuredSkuPrefix(name: string, category?: string): string {
  const n = (name || "").toUpperCase();
  const c = (category || "").toUpperCase();
  const combined = `${n} ${c}`;

  if (/\b(BAG|TOTE|HANDBAG|PURSE|BACKPACK|CLUTCH|WALLET|POUCH)\b/.test(n)) return "BAG";
  if (/\b(HEEL|SHOE|BOOT|SNEAKER|SLIDE|SANDAL|LOAFER|MULE|SLIPPER|FOOTWEAR)\b/.test(n)) return "SHOE";
  if (/\b(FLASK|BOTTLE|TUMBLER|MUG|THERMOS)\b/.test(n)) return "FLASK";
  if (/\b(WIG|FRONTAL|CLOSURE|BRAID|BUNDLE|HAIR EXTENSION)\b/.test(combined)) return "HAIR";
  if (/\b(PERFUME|OUD|SCENT|FRAGRANCE|COLOGNE|DIFFUSER|BODY MIST)\b/.test(combined)) return "SCNT";
  if (/\b(WATCH|NECKLACE|BRACELET|EARRING|RING|JEWELRY|SUNGLASS|EYEGLASS|CHAIN)\b/.test(combined)) return "JEWL";
  if (/\b(PHONE|IPHONE|SAMSUNG|LAPTOP|MACBOOK|EARBUD|AIRPOD|POWERBANK|CHARGER|TABLET|GADGET)\b/.test(combined)) return "TECH";
  if (/\b(TV|FRIDGE|FREEZER|FAN|IRON|SPEAKER|INVERTER|GENERATOR|APPLIANCE|MICROWAVE)\b/.test(combined)) return "ELEC";
  if (/\b(POT|PAN|BLENDER|KETTLE|PLATE|CUTLERY|KITCHEN|COOKWARE|UTENSIL)\b/.test(combined)) return "KITCH";
  if (/\b(FOOD|LUNCH|CAKE|SNACK|RICE|MEAL|CHOPS|PASTRY|HONEY|SPICE|GROCER|CATERING)\b/.test(combined)) return "FOOD";
  if (/\b(COSMETIC|CREAM|LOTION|SERUM|SOAP|BUTTER|MAKEUP|BEAUTY|SKINCARE|GLOW|CLEANSER)\b/.test(combined)) return "GLOW";
  if (/\b(DRESS|SHIRT|GOWN|HOODIE|TOP|PANTS|TROUSER|SUIT|JACKET|WEAR|CLOTH|ABAYA|ANKARA|KAFTAN|SKIRT|JEAN|APPAREL)\b/.test(combined)) return "WEAR";
  if (/\b(BED|SHEET|DUVET|PILLOW|CURTAIN|RUG|LAMP|CHAIR|TABLE|DECOR|FURNITURE)\b/.test(combined)) return "HOME";
  if (/\b(VITAMIN|SUPPLEMENT|GYM|TEA|HERB|FITNESS|WELLNESS|HEALTH)\b/.test(combined)) return "HLTH";
  if (/\b(BABY|KID|TOY|DIAPER|STROLLER|INFANT)\b/.test(combined)) return "KIDS";
  if (/\b(BOOK|JOURNAL|PLANNER|PEN|STATIONERY|CRAFT)\b/.test(combined)) return "BOOK";
  if (/\b(CAR|AUTO|TIRE|BATTERY|TOOL|HELMET)\b/.test(combined)) return "AUTO";

  if (/SHOES|BAGS|FOOTWEAR/.test(c)) return "SHOE";
  if (/FASHION|APPAREL/.test(c)) return "WEAR";
  if (/BEAUTY|SKINCARE|COSMETIC/.test(c)) return "GLOW";

  const catToken = c.replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (catToken.length >= 3 && catToken !== "GENE" && catToken !== "CUST" && catToken !== "OTHE") {
    return catToken;
  }

  const firstWord = n.trim().split(/\s+/)[0]?.replace(/[^A-Z0-9]/g, "") ?? "";
  if (firstWord.length >= 3) {
    return firstWord.slice(0, 4);
  }
  return "ITEM";
}

export function buildStructuredSku(
  name: string,
  category?: string,
  existingProducts: Array<{ skuCode: string }> = []
): string {
  const prefix = resolveStructuredSkuPrefix(name, category);
  const existingUpper = new Set(existingProducts.map((p) => p.skuCode.toUpperCase()));

  let maxIndex = 0;
  const prefixRegex = new RegExp(`^${prefix}-(\\d+)$`, "i");
  for (const prod of existingProducts) {
    const m = prod.skuCode.trim().match(prefixRegex);
    if (m?.[1]) {
      const num = parseInt(m[1], 10);
      if (Number.isFinite(num) && num > maxIndex) {
        maxIndex = num;
      }
    }
  }

  let index = maxIndex + 1;
  let candidate = `${prefix}-${String(index).padStart(2, "0")}`;
  while (existingUpper.has(candidate)) {
    index++;
    candidate = `${prefix}-${String(index).padStart(2, "0")}`;
  }
  return candidate;
}

export function buildStructuredVariantSku(
  parentSku: string,
  variantName: string,
  index: number,
  usedSkus: Set<string> = new Set()
): string {
  const cleanParent = parentSku.trim().toUpperCase();
  const raw = (variantName || "").toUpperCase();

  const colorMap: Array<[RegExp, string]> = [
    [/\bBLACK\b/, "BLK"],
    [/\bGOLD\b/, "GLD"],
    [/\bSILVER\b/, "SLV"],
    [/\bWHITE\b/, "WHT"],
    [/\bGREEN\b/, "GRN"],
    [/\bBLUE\b/, "BLU"],
    [/\bPINK\b/, "PNK"],
    [/\bBROWN\b/, "BRN"],
    [/\bPURPLE\b/, "PRP"],
    [/\bYELLOW\b/, "YLW"],
    [/\bORANGE\b/, "ORG"],
    [/\bRED\b/, "RED"],
    [/\bTAN\b/, "TAN"],
    [/\bNAVY\b/, "NVY"],
    [/\bNUDE\b/, "NUD"],
  ];

  const sizeMatch = raw.match(/\b(\d{1,4}(?:ML|L|KG|G|IN|CM)?|XXXL|XXL|XL|XS|SM|MD|LG)\b/);
  let colorCode = "";
  for (const [regex, abbr] of colorMap) {
    if (regex.test(raw)) {
      colorCode = abbr;
      break;
    }
  }

  let suffix = "";
  if (sizeMatch && colorCode) {
    suffix = `${sizeMatch[1]}${colorCode}`;
  } else if (sizeMatch) {
    const rest = raw
      .replace(sizeMatch[0], "")
      .replace(/\b(SIZE|COLOR|COLOUR|VOLUME|LENGTH)\b/g, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    suffix = `${sizeMatch[1]}${rest}`;
  } else if (colorCode) {
    suffix = colorCode;
  } else {
    suffix =
      raw
        .replace(/\b(SIZE|COLOR|COLOUR|VARIANT)\b/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || `V${index + 1}`;
  }

  let candidate = `${cleanParent}-${suffix}`;
  let counter = 2;
  while (usedSkus.has(candidate)) {
    candidate = `${cleanParent}-${suffix}${counter}`;
    counter++;
  }
  usedSkus.add(candidate);
  return candidate;
}

interface ProductEditorModalProps {
  product?: ProductItem | null;
  existingProducts?: ProductItem[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<boolean> | void;
  onDelete?: (skuCode: string) => Promise<boolean> | void;
}

export function ProductEditorModal({
  product,
  existingProducts = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
}: ProductEditorModalProps) {
  const isEditing = Boolean(product);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(product?.name || "");
  const [sku, setSku] = useState(
    product?.skuCode || buildStructuredSku("", "Fashion & Apparel", existingProducts)
  );
  const [autoGenerateSku, setAutoGenerateSku] = useState(!product);
  const [category, setCategory] = useState(product?.category || "Fashion & Apparel");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState("");
  const [description, setDescription] = useState(product?.description || "");

  // Custom Fields (Key-Value attributes like Color, Size, Brand, Material)
  const [customFields, setCustomFields] = useState<CustomFieldItem[]>([]);

  // Pricing & Margins + Strike-Through Compare-At & Product Type (Physical vs Digital)
  const [wholesaleCost, setWholesaleCost] = useState(product ? Math.round(product.basePriceNaira * 0.75) : 7500);
  const [sellingPrice, setSellingPrice] = useState(product?.basePriceNaira || 10000);
  const [compareAtPrice, setCompareAtPrice] = useState<string>(
    product?.customFields?.compareAtPriceNaira || ""
  );
  const [productType, setProductType] = useState<"PHYSICAL" | "DIGITAL">(
    product?.customFields?.productType === "DIGITAL" ? "DIGITAL" : "PHYSICAL"
  );
  const [digitalDownloadUrl, setDigitalDownloadUrl] = useState<string>(
    product?.customFields?.digitalDownloadUrl || ""
  );
  const [stockTotal, setStockTotal] = useState(product?.stockTotal || 10);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [isPublished, setIsPublished] = useState(true);

  // Wholesale & Advance Booking Settings (Product-Level)
  const [isBookable, setIsBookable] = useState(
    product?.customFields?.isBookable === "true" || false
  );
  const [bookingMoq, setBookingMoq] = useState(
    product?.customFields?.bookingMoq ? Number(product.customFields.bookingMoq) : 10
  );
  const [bookingDepositPercent, setBookingDepositPercent] = useState(
    product?.customFields?.bookingDepositPercent ? Number(product.customFields.bookingDepositPercent) : 30
  );
  const [bookingLeadTimeDays, setBookingLeadTimeDays] = useState(
    product?.customFields?.bookingLeadTimeDays ? Number(product.customFields.bookingLeadTimeDays) : 14
  );

  // Images
  const [images, setImages] = useState<string[]>(
    product?.primaryImageUrl ? [product.primaryImageUrl] : []
  );
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showAddImage, setShowAddImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === "string") {
        setImages((prev) => [dataUrl, ...prev]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Variants Matrix
  const [hasVariants, setHasVariants] = useState(Boolean(product?.variants && product.variants.length > 0));
  const [variants, setVariants] = useState<ProductVariant[]>(
    product?.variants
      ? product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          priceNaira: v.priceNaira ?? product.basePriceNaira,
          stock: v.stock,
        }))
      : []
  );

  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState(sellingPrice);
  const [newVariantStock, setNewVariantStock] = useState(10);

  // Hydrate fields whenever modal opens with a product
  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.skuCode);
      const isPreset = PRESET_CATEGORIES.includes(product.category);
      if (isPreset && product.category !== "Other / Custom Category") {
        setCategory(product.category);
        setIsCustomCategory(false);
        setCustomCategoryText("");
      } else {
        setCategory(product.category || "Other / Custom Category");
        setIsCustomCategory(true);
        setCustomCategoryText(product.category === "Other / Custom Category" ? "" : (product.category || ""));
      }
      setDescription(product.description || "");
      setSellingPrice(product.basePriceNaira);
      setWholesaleCost(Math.round(product.basePriceNaira * 0.75));
      setCompareAtPrice(product.customFields?.compareAtPriceNaira || "");
      setProductType(
        product.customFields?.productType === "DIGITAL" ? "DIGITAL" : "PHYSICAL"
      );
      setDigitalDownloadUrl(product.customFields?.digitalDownloadUrl || "");
      setStockTotal(product.stockTotal);
      const parsedGallery = (() => {
        if (product.customFields?.galleryUrls) {
          try {
            const arr = JSON.parse(product.customFields.galleryUrls);
            if (Array.isArray(arr) && arr.length > 0) return arr as string[];
          } catch {}
        }
        return product.primaryImageUrl ? [product.primaryImageUrl] : [];
      })();
      setImages(parsedGallery);
      if (product.variants && product.variants.length > 0) {
        setHasVariants(true);
        setVariants(
          product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            priceNaira: v.priceNaira ?? product.basePriceNaira,
            stock: v.stock,
          }))
        );
      } else {
        setHasVariants(false);
        setVariants([]);
      }
      if (product.customFields) {
        setCustomFields(
          Object.entries(product.customFields)
            .filter(
              ([name]) =>
                ![
                  "isBookable",
                  "bookingMoq",
                  "bookingDepositPercent",
                  "bookingLeadTimeDays",
                  "galleryUrls",
                  "compareAtPriceNaira",
                  "flashSalePercent",
                  "flashSaleLabel",
                  "productType",
                  "digitalDownloadUrl",
                ].includes(name)
            )
            .map(([name, value], i) => ({
              id: `cf-${i}-${Date.now()}`,
              name,
              value,
            }))
        );
        setIsBookable(product.customFields.isBookable === "true");
        setBookingMoq(product.customFields.bookingMoq ? Number(product.customFields.bookingMoq) : 10);
        setBookingDepositPercent(product.customFields.bookingDepositPercent ? Number(product.customFields.bookingDepositPercent) : 30);
        setBookingLeadTimeDays(product.customFields.bookingLeadTimeDays ? Number(product.customFields.bookingLeadTimeDays) : 14);
      } else {
        setCustomFields([]);
        setIsBookable(false);
        setBookingMoq(10);
        setBookingDepositPercent(30);
        setBookingLeadTimeDays(14);
      }
    } else if (isOpen) {
      setName("");
      setAutoGenerateSku(true);
      setSku(buildStructuredSku("", "Fashion & Apparel", existingProducts));
      setCategory("Fashion & Apparel");
      setIsCustomCategory(false);
      setCustomCategoryText("");
      setDescription("");
      setSellingPrice(10000);
      setWholesaleCost(7500);
      setCompareAtPrice("");
      setProductType("PHYSICAL");
      setDigitalDownloadUrl("");
      setStockTotal(10);
      setHasVariants(false);
      setVariants([]);
      setCustomFields([]);
      setImages([]);
      setIsBookable(false);
      setBookingMoq(10);
      setBookingDepositPercent(30);
      setBookingLeadTimeDays(14);
    }
  }, [product, isOpen]);

  // Live structured SKU auto-generation when creating or auto-syncing a product
  useEffect(() => {
    if (!isOpen || !autoGenerateSku) return;
    const effectiveCat = isCustomCategory
      ? customCategoryText.trim() || "General"
      : category;
    const otherProducts = product
      ? existingProducts.filter((p) => p.skuCode.toUpperCase() !== product.skuCode.toUpperCase())
      : existingProducts;
    const nextSku = buildStructuredSku(name, effectiveCat, otherProducts);
    setSku(nextSku);
  }, [name, category, isCustomCategory, customCategoryText, autoGenerateSku, isOpen, existingProducts, product]);

  // Keep variant SKUs structured (`<PARENT_SKU>-<VARIANT_TOKEN>`) whenever parent SKU changes
  useEffect(() => {
    if (!sku || variants.length === 0) return;
    const used = new Set<string>();
    setVariants((prev) =>
      prev.map((v, idx) => ({
        ...v,
        sku: buildStructuredVariantSku(sku, v.name, idx, used),
      }))
    );
  }, [sku]);

  // Computed Margins
  const grossProfit = sellingPrice - wholesaleCost;
  const marginPercent = Math.round((grossProfit / (sellingPrice || 1)) * 100);

  if (!isOpen) return null;

  const handleAddImage = () => {
    if (newImageUrl.trim()) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl("");
      setShowAddImage(false);
    }
  };

  const handleAddVariant = () => {
    if (!newVariantName.trim()) return;
    const used = new Set(variants.map((v) => v.sku.toUpperCase()));
    const newV: ProductVariant = {
      id: `v-${Date.now()}`,
      name: newVariantName.trim(),
      sku: buildStructuredVariantSku(sku, newVariantName.trim(), variants.length, used),
      priceNaira: Number(newVariantPrice) || sellingPrice,
      stock: Number(newVariantStock) || 0,
    };
    setVariants([...variants, newV]);
    setNewVariantName("");
  };

  const handleRemoveVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleAddCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: `cf-${Date.now()}`, name: "", value: "" },
    ]);
  };

  const handleUpdateCustomField = (id: string, name: string, value: string) => {
    setCustomFields(
      customFields.map((cf) => (cf.id === id ? { ...cf, name, value } : cf))
    );
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(customFields.filter((cf) => cf.id !== id));
  };

  const handleSave = async () => {
    const finalCategory = isCustomCategory
      ? (customCategoryText.trim() || "General")
      : category;

    const customFieldsRecord: Record<string, string> = {};
    for (const cf of customFields) {
      if (cf.name.trim() && cf.value.trim()) {
        customFieldsRecord[cf.name.trim()] = cf.value.trim();
      }
    }

    if (isBookable) {
      customFieldsRecord["isBookable"] = "true";
      customFieldsRecord["bookingMoq"] = String(bookingMoq);
      customFieldsRecord["bookingDepositPercent"] = String(bookingDepositPercent);
      customFieldsRecord["bookingLeadTimeDays"] = String(bookingLeadTimeDays);
    } else {
      customFieldsRecord["isBookable"] = "false";
    }

    if (images.length > 0) {
      customFieldsRecord["galleryUrls"] = JSON.stringify(images);
    }
    if (Number(compareAtPrice) > sellingPrice) {
      customFieldsRecord["compareAtPriceNaira"] = String(Number(compareAtPrice));
    }
    customFieldsRecord["productType"] = productType;
    if (productType === "DIGITAL" && digitalDownloadUrl.trim()) {
      customFieldsRecord["digitalDownloadUrl"] = digitalDownloadUrl.trim();
    }

    await onSave({
      skuCode: sku,
      name,
      category: finalCategory,
      description,
      priceNaira: sellingPrice,
      wholesaleCost,
      stockTotal: hasVariants ? variants.reduce((acc, v) => acc + v.stock, 0) : stockTotal,
      primaryImageUrl: images[0],
      variants: hasVariants ? variants : [],
      customFields: Object.keys(customFieldsRecord).length > 0 ? customFieldsRecord : undefined,
      isPublished,
    });
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-slate-900/25 backdrop-blur-md overflow-hidden animate-backdrop-fade">
      <div className="bg-white rounded-none sm:rounded-[28px] max-w-3xl w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] p-4 sm:p-8 shadow-2xl border-0 sm:border border-gray-100 space-y-6 overflow-y-auto animate-popup-spring">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                {isEditing ? "Edit Product SKU" : "Create New Product"}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPublished ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                }`}
              >
                {isPublished ? "Active · Listed" : "Draft · Unpublished"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-1">
              {isEditing ? product?.name : "Add New Product & Variants"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set retail margins, variant attributes, and sync to WhatsApp Catalog.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
            ✕
          </button>
        </div>

        {/* Section 1: Multi-Photo Gallery */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
            Product Image Gallery (WhatsApp Catalog Sync)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative group rounded-2xl overflow-hidden border border-gray-200 aspect-square bg-gray-50 flex items-center justify-center"
              >
                <img src={img} alt="Product" className="w-full h-full object-cover" />
                {idx === 0 && (
                  <span className="absolute top-2 left-2 bg-[#0d5c3a] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Cover
                  </span>
                )}
                {images.length > 1 && (
                  <button
                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                    title="Remove image"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* Add Photo Buttons */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-600 hover:bg-emerald-50/50 aspect-square flex flex-col items-center justify-center text-emerald-700 transition-all cursor-pointer p-4 text-center group"
            >
              <span className="text-xl font-bold group-hover:scale-110 transition-transform">📷</span>
              <span className="text-[11px] font-bold mt-1">Upload Photo</span>
              <span className="text-[9px] text-gray-400 mt-0.5">From Device</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddImage(true)}
              className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/30 aspect-square flex flex-col items-center justify-center text-gray-400 hover:text-emerald-700 transition-all cursor-pointer p-4 text-center"
            >
              <span className="text-xl font-bold">🔗</span>
              <span className="text-[11px] font-semibold mt-1">Add URL</span>
            </button>
          </div>

          {showAddImage && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Paste original product image URL (https://...)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleAddImage}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer"
              >
                Attach
              </button>
              <button
                onClick={() => setShowAddImage(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Basic Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Product Title *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                SKU Identifier *
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {autoGenerateSku ? "Auto-Structured" : "Custom"}
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setAutoGenerateSku((prev) => !prev)}
                    className="text-[10px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    {autoGenerateSku ? "Customize" : "Auto-Generate"}
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              value={sku}
              readOnly={autoGenerateSku || isEditing}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none ${
                autoGenerateSku || isEditing
                  ? "bg-emerald-50/40 border-emerald-200 text-emerald-950"
                  : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Category
            </label>
            <select
              value={isCustomCategory ? "Other / Custom Category" : category}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Other / Custom Category") {
                  setIsCustomCategory(true);
                  setCategory("Other / Custom Category");
                } else {
                  setIsCustomCategory(false);
                  setCategory(val);
                }
              }}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {PRESET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {isCustomCategory && (
              <div className="mt-2 animate-in fade-in">
                <input
                  type="text"
                  placeholder="Enter custom category name (e.g. Traditional Fabrics, Beaded Bags)..."
                  value={customCategoryText}
                  onChange={(e) => setCustomCategoryText(e.target.value)}
                  className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-medium focus:outline-none focus:border-emerald-600 placeholder:text-gray-400"
                />
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Product Description (Sent by Co-Pilot upon inquiry)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Section 2.5: Custom Attributes & Specifications */}
        <div className="bg-gray-50/60 border border-gray-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <span>🏷️</span>
                <span>Custom Attributes & Specifications</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Add custom fields (e.g. Color, Material, Size, Brand, Gender, Warranty) for buyers and your AI Co-Pilot.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCustomField}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl transition-colors cursor-pointer"
            >
              + Add Custom Field
            </button>
          </div>

          {customFields.length === 0 ? (
            <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
              No custom fields added yet. Tap <strong>+ Add Custom Field</strong> to add attributes like Color, Size, or Material.
            </div>
          ) : (
            <div className="space-y-2">
              {customFields.map((cf) => (
                <div key={cf.id} className="flex items-center gap-2 animate-in fade-in">
                  <input
                    type="text"
                    placeholder="Field name (e.g. Color, Brand, Material)"
                    value={cf.name}
                    onChange={(e) => handleUpdateCustomField(cf.id, e.target.value, cf.value)}
                    className="w-1/3 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Burgundy, Nike, Genuine Leather)"
                    value={cf.value}
                    onChange={(e) => handleUpdateCustomField(cf.id, cf.name, e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(cf.id)}
                    className="text-gray-400 hover:text-rose-600 p-2 text-sm cursor-pointer"
                    title="Remove Field"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Pricing & Margin Calculator */}
        <div className="bg-gray-50 border border-gray-200/70 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Pricing, Cost & Profit Margins
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500">Gross Margin:</span>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {marginPercent}% (₦{grossProfit.toLocaleString()} profit/unit)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Wholesale Cost (NGN)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-bold">₦</span>
                <input
                  type="number"
                  value={wholesaleCost}
                  onChange={(e) => setWholesaleCost(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Selling Retail Price (NGN) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-bold">₦</span>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-900 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Strike-Through Original (₦)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-bold">₦</span>
                <input
                  type="number"
                  placeholder="Optional e.g. 15000"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Product Fulfillment Type
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as "PHYSICAL" | "DIGITAL")}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-500"
              >
                <option value="PHYSICAL">📦 Physical Merchandise</option>
                <option value="DIGITAL">⚡ Digital / Instant Access</option>
              </select>
            </div>
          </div>

          {productType === "DIGITAL" && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                Digital Delivery URL / Access Link (Sent automatically after payment)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... or digital access link"
                value={digitalDownloadUrl}
                onChange={(e) => setDigitalDownloadUrl(e.target.value)}
                className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          )}
        </div>

        {/* Section 4: Variants Matrix (Matching Product Details & Edit.png) */}
        <div className="space-y-4 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-gray-900">Variants & Options Matrix</div>
              <div className="text-[11px] text-gray-500">Allow customers to choose size, color, or capacity.</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="rounded text-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-gray-700">Enable Variants</span>
            </label>
          </div>

          {hasVariants && (
            <div className="space-y-3">
              {/* Variants Table */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-4">Variant Name</th>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4">Retail Price (NGN)</th>
                      <th className="py-2.5 px-4">Available Stock</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4 font-semibold text-gray-900">{v.name}</td>
                        <td className="py-3 px-4 font-mono text-gray-500">{v.sku}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">₦{v.priceNaira.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              v.stock <= lowStockThreshold ? "text-rose-600 font-bold" : "text-gray-900"
                            }`}
                          >
                            {v.stock} units
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRemoveVariant(v.id)}
                            className="text-gray-400 hover:text-rose-600 font-bold px-1.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Variant Inline Bar */}
              <div className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                <input
                  type="text"
                  placeholder="Variant name (e.g. 500ml / Navy Blue)"
                  value={newVariantName}
                  onChange={(e) => setNewVariantName(e.target.value)}
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="number"
                  placeholder="Price (NGN)"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(Number(e.target.value))}
                  className="w-28 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={newVariantStock}
                  onChange={(e) => setNewVariantStock(Number(e.target.value))}
                  className="w-20 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleAddVariant}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg cursor-pointer active:scale-95 transition-all shadow-2xs"
                >
                  + Add Variant
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Wholesale & Advance Booking Rules (Product-Level) */}
        <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <span>📦</span>
                <span>Wholesale &amp; Advance Booking Rules</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 max-w-lg">
                Allow bulk wholesale buyers and reseller networks to reserve inventory in advance with an upfront escrow deposit.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isBookable}
                onChange={(e) => setIsBookable(e.target.checked)}
                className="rounded text-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-800">
                {isBookable ? "✓ Bookable" : "Not Bookable"}
              </span>
            </label>
          </div>

          {isBookable && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-200/60 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Minimum Order Quantity (MOQ)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={bookingMoq}
                    onChange={(e) => setBookingMoq(Number(e.target.value) || 1)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-gray-400">units min.</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Required Escrow Deposit %
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={bookingDepositPercent}
                    onChange={(e) => setBookingDepositPercent(Number(e.target.value) || 30)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-gray-400">% escrow</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Lead Time (Days to Dispatch)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={bookingLeadTimeDays}
                    onChange={(e) => setBookingLeadTimeDays(Number(e.target.value) || 14)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-gray-400">days</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded text-emerald-600 cursor-pointer"
            />
            <span>Publish live to WhatsApp & payment links</span>
          </label>

          <div className="flex items-center gap-2">
            {isEditing && onDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!product) return;
                  const confirmed = window.confirm(
                    `Delete product "${product.name}" (${product.skuCode})?\n\nThis will permanently remove it from your Caterlog store and delete it from your WhatsApp Business Catalog.`
                  );
                  if (!confirmed) return;
                  setDeleting(true);
                  try {
                    await onDelete(product.skuCode);
                    onClose();
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-3.5 py-2.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🗑️</span>
                <span>{deleting ? "Deleting..." : "Delete Product"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            >
              {isEditing ? "Save Product Changes" : "Create Product"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

