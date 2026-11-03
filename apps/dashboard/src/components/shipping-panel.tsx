"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import type { Discount, ShippingZone } from "@/lib/types";
import type { RunAction } from "./dashboard";

export function ShippingPanel({
  zones,
  discounts,
  run,
}: {
  zones: ShippingZone[];
  discounts: Discount[];
  run: RunAction;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ShippingZones zones={zones} run={run} />
      <DiscountCodes discounts={discounts} run={run} />
    </div>
  );
}

function ShippingZones({ zones, run }: { zones: ShippingZone[]; run: RunAction }) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await run(() => api.addShippingZone(name.trim(), fee.trim()));
    if (ok) {
      setName("");
      setFee("");
    }
  };

  const remove = (zone: ShippingZone) => {
    const confirmed = window.confirm(
      `Remove delivery zone #${zone.code} (${zone.name})? Existing orders keep their original fee.`
    );
    if (!confirmed) return;
    void run(() => api.deleteShippingZone(zone.code));
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">🚚 Delivery Zones</h3>
        <p className="text-xs text-gray-400">
          Also editable in WhatsApp via{" "}
          <code className="text-emerald-400">shipping add Lekki 3500</code>
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Zone name (e.g. Surulere)"
          required
          className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <input
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          inputMode="decimal"
          placeholder="Fee (₦)"
          required
          className="w-28 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          Add
        </button>
      </form>

      <div className="space-y-2">
        {zones.length === 0 ? (
          <p className="text-xs text-gray-500">No active delivery zones yet.</p>
        ) : (
          zones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs"
            >
              <div>
                <span className="text-gray-500 font-mono mr-1.5">#{zone.code}</span>
                <span className="font-semibold text-white">{zone.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-emerald-400">{zone.feeFormatted}</span>
                <button
                  type="button"
                  onClick={() => remove(zone)}
                  className="text-gray-500 hover:text-rose-400"
                  aria-label={`Delete ${zone.name}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DiscountCodes({
  discounts,
  run,
}: {
  discounts: Discount[];
  run: RunAction;
}) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<Discount["type"]>("PERCENTAGE");
  const [value, setValue] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await run(() =>
      api.addDiscount({
        code: code.trim(),
        type,
        value: Number(value),
      })
    );
    if (ok) {
      setCode("");
      setValue("");
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">🏷️ Promo &amp; Discount Codes</h3>
        <p className="text-xs text-gray-400">
          Also editable in WhatsApp via{" "}
          <code className="text-emerald-400">discount add PAYDAY 10%</code>
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Code (e.g. WKND15)"
          required
          className="w-28 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-emerald-500"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value as Discount["type"])}
          className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
        >
          <option value="PERCENTAGE">% Off</option>
          <option value="FLAT_KOBO">₦ Flat</option>
        </select>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type="number"
          min={type === "PERCENTAGE" ? 0.01 : 1}
          step={type === "PERCENTAGE" ? 0.01 : 1}
          placeholder={type === "PERCENTAGE" ? "10" : "5000"}
          required
          className="w-24 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          Add
        </button>
      </form>

      <div className="space-y-2">
        {discounts.length === 0 ? (
          <p className="text-xs text-gray-500">No active discount codes yet.</p>
        ) : (
          discounts.map((discount) => (
            <div
              key={discount.id}
              className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs"
            >
              <div>
                <span className="font-mono font-bold text-emerald-400">{discount.code}</span>
                <span className="text-gray-400 ml-2">{discount.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">
                  {discount.usedCount}
                  {discount.maxUses !== null ? `/${discount.maxUses}` : ""} used
                </span>
                <button
                  type="button"
                  onClick={() => void run(() => api.deleteDiscount(discount.code))}
                  className="text-gray-500 hover:text-rose-400"
                  aria-label={`Deactivate ${discount.code}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
