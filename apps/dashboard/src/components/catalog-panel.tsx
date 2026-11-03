"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import type { RunAction } from "./dashboard";

const EMPTY_FORM = { skuCode: "", name: "", priceNaira: "", stockTotal: "" };

export function CatalogPanel({
  products,
  run,
}: {
  products: Product[];
  run: RunAction;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedSku, setSelectedSku] = useState(products[0]?.skuCode ?? "");
  const [previewToken, setPreviewToken] = useState(() => Date.now());

  useEffect(() => {
    if (!products.some((product) => product.skuCode === selectedSku)) {
      setSelectedSku(products[0]?.skuCode ?? "");
    }
  }, [products, selectedSku]);

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await run(() =>
      api.addProduct({
        skuCode: form.skuCode.trim(),
        name: form.name.trim(),
        priceNaira: form.priceNaira.trim(),
        stockTotal: Number(form.stockTotal),
      })
    );
    if (ok) setForm(EMPTY_FORM);
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3">
          + Add Product (Syncs with WhatsApp Catalog &amp; Status Matcher)
        </h3>
        <form
          onSubmit={submitProduct}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5"
        >
          <input
            value={form.skuCode}
            onChange={(event) => setForm({ ...form, skuCode: event.target.value })}
            placeholder="SKU (e.g. BAG-02)"
            required
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Product Name"
            required
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <input
            value={form.priceNaira}
            onChange={(event) => setForm({ ...form, priceNaira: event.target.value })}
            inputMode="decimal"
            placeholder="Price in Naira (e.g. 32000 or #32k)"
            required
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <input
              value={form.stockTotal}
              onChange={(event) => setForm({ ...form, stockTotal: event.target.value })}
              type="number"
              min={0}
              step={1}
              placeholder="Stock (e.g. 6)"
              required
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg whitespace-nowrap"
            >
              Save
            </button>
          </div>
        </form>
      </div>

      {products.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center text-sm text-gray-400">
          Your catalog is empty. Add your first product above, or send a WhatsApp photo caption like
          <span className="text-emerald-400"> Name, #25000, stock 5</span>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} run={run} />
          ))}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              🖼️ Live WhatsApp OpenGraph Card Renderer (/og/product/:sku)
            </h3>
            <p className="text-xs text-gray-400">
              Automatically updates the price tag &amp; remaining stock badge whenever a WhatsApp
              sale happens.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedSku}
              onChange={(event) => {
                setSelectedSku(event.target.value);
                setPreviewToken(Date.now());
              }}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              {products.map((product) => (
                <option key={product.id} value={product.skuCode}>
                  {product.skuCode} — {product.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPreviewToken(Date.now())}
              className="bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 px-3 py-1.5 rounded-lg"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-800 bg-black">
          {selectedSku ? (
            // eslint-disable-next-line @next/next/no-img-element -- API streams a dynamic SVG card.
            <img
              src={api.ogCardUrl(selectedSku, previewToken)}
              alt={`Dynamic OpenGraph preview for ${selectedSku}`}
              className="w-full max-h-64 object-contain"
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-gray-500">
              Add a product to preview its WhatsApp link card.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, run }: { product: Product; run: RunAction }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3.5 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- catalog images are vendor URLs. */}
      <img
        src={product.primaryImageUrl}
        alt={product.name}
        className="h-16 w-16 rounded-lg object-cover border border-gray-800 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-gray-800 text-emerald-400 px-2 py-0.5 rounded">
            {product.skuCode}
          </span>
          <span
            className="text-[11px] font-mono text-gray-500"
            title="Perceptual Hash for WhatsApp Status Matching"
          >
            pHash: {product.imagePhash.slice(0, 8)}…
          </span>
        </div>
        <div className="font-bold text-white text-sm truncate mt-0.5">{product.name}</div>
        <div className="text-xs text-emerald-400 font-bold">{product.basePriceFormatted}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">
          Available: <strong className="text-white">{product.availableStock}</strong> • Reserved:{" "}
          <strong className="text-amber-400">{product.stockReserved}</strong>
        </div>
      </div>
      <StockInput product={product} run={run} />
    </div>
  );
}

function StockInput({ product, run }: { product: Product; run: RunAction }) {
  const [value, setValue] = useState(String(product.stockTotal));

  useEffect(() => setValue(String(product.stockTotal)), [product.stockTotal]);

  const commit = async () => {
    const next = Number(value);
    if (!Number.isInteger(next) || next === product.stockTotal) {
      setValue(String(product.stockTotal));
      return;
    }
    const ok = await run(() => api.updateStock(product.skuCode, next));
    if (!ok) setValue(String(product.stockTotal));
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="text-[10px] text-gray-400" htmlFor={`stock-${product.skuCode}`}>
        Total Stock
      </label>
      <input
        id={`stock-${product.skuCode}`}
        type="number"
        min={product.stockReserved}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="w-16 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white focus:outline-none focus:border-emerald-500"
      />
    </div>
  );
}
