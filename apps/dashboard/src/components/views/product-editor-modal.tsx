"use client";

import React, { useState } from "react";
import type { ProductItem } from "@/lib/types";

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceNaira: number;
  stock: number;
}

interface ProductEditorModalProps {
  product?: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<boolean> | void;
}

export function ProductEditorModal({
  product,
  isOpen,
  onClose,
  onSave,
}: ProductEditorModalProps) {
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name || "Stainless Steel Vacuum Flask");
  const [sku, setSku] = useState(product?.skuCode || `SKU-${Date.now().toString().slice(-4)}`);
  const [category, setCategory] = useState(product?.category || "Kitchenware & Drinkware");
  const [description, setDescription] = useState(
    product?.description ||
      "Double-walled stainless steel thermal vacuum flask. Keeps beverages hot for 12 hours and cold for 24 hours. Leak-proof lid with silicone seal."
  );

  // Pricing & Margins
  const [wholesaleCost, setWholesaleCost] = useState(product ? Math.round(product.basePriceNaira * 0.75) : 7500);
  const [sellingPrice, setSellingPrice] = useState(product?.basePriceNaira || 10000);
  const [stockTotal, setStockTotal] = useState(product?.stockTotal || 45);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [isPublished, setIsPublished] = useState(true);

  // Images
  const [images, setImages] = useState<string[]>([
    product?.primaryImageUrl || "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60",
  ]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showAddImage, setShowAddImage] = useState(false);

  // Variants Matrix
  const [hasVariants, setHasVariants] = useState(true);
  const [variants, setVariants] = useState<ProductVariant[]>([
    { id: "v1", name: "750ml / Matte Black", sku: `${sku}-BLK`, priceNaira: sellingPrice, stock: 25 },
    { id: "v2", name: "750ml / Rose Gold", sku: `${sku}-RGD`, priceNaira: sellingPrice, stock: 12 },
    { id: "v3", name: "1000ml / Silver", sku: `${sku}-SLV`, priceNaira: sellingPrice + 2000, stock: 8 },
  ]);

  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState(sellingPrice);
  const [newVariantStock, setNewVariantStock] = useState(10);

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
    const newV: ProductVariant = {
      id: `v-${Date.now()}`,
      name: newVariantName.trim(),
      sku: `${sku}-${newVariantName.trim().slice(0, 3).toUpperCase()}`,
      priceNaira: Number(newVariantPrice) || sellingPrice,
      stock: Number(newVariantStock) || 0,
    };
    setVariants([...variants, newV]);
    setNewVariantName("");
  };

  const handleRemoveVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleSave = async () => {
    await onSave({
      skuCode: sku,
      name,
      category,
      description,
      priceNaira: sellingPrice,
      wholesaleCost,
      stockTotal: hasVariants ? variants.reduce((acc, v) => acc + v.stock, 0) : stockTotal,
      primaryImageUrl: images[0],
      variants: hasVariants ? variants : [],
      isPublished,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full my-8 p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
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
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                    title="Remove image"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* Add Photo Button */}
            <button
              onClick={() => setShowAddImage(true)}
              className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/30 aspect-square flex flex-col items-center justify-center text-gray-400 hover:text-emerald-700 transition-all cursor-pointer p-4 text-center"
            >
              <span className="text-xl font-bold">+</span>
              <span className="text-[11px] font-semibold mt-1">Add Photo</span>
            </button>
          </div>

          {showAddImage && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Paste image URL (https://...)"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              SKU Identifier *
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Kitchenware & Drinkware">Kitchenware & Drinkware</option>
              <option value="Electronics & Tech">Electronics & Tech</option>
              <option value="Home & Living">Home & Living</option>
              <option value="Fitness & Health">Fitness & Health</option>
            </select>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                Low-Stock Warning Threshold
              </label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
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

          <div className="flex gap-2">
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
    </div>
  );
}

