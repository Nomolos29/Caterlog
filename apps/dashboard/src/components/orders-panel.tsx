"use client";

import { api } from "@/lib/api";
import type { Order } from "@/lib/types";
import type { RunAction } from "./dashboard";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-950 text-amber-300 border-amber-700",
  PARTIALLY_PAID: "bg-orange-950 text-orange-300 border-orange-700",
  PAID: "bg-emerald-950 text-emerald-300 border-emerald-700",
  PROCESSING: "bg-indigo-950 text-indigo-300 border-indigo-700",
  OUT_FOR_DELIVERY: "bg-sky-950 text-sky-300 border-sky-700",
  FULFILLED: "bg-teal-950 text-teal-300 border-teal-700",
  EXPIRED: "bg-gray-800 text-gray-400 border-gray-700",
  CANCELLED: "bg-rose-950 text-rose-300 border-rose-800",
  REFUNDED: "bg-purple-950 text-purple-300 border-purple-800",
};

export function OrdersPanel({ orders, run }: { orders: Order[]; run: RunAction }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">
          Live Order Queue (Server-Verified State Machine)
        </h2>
        <span className="text-xs text-gray-400">
          Test partial or full bank transfers directly on any pending order below
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center text-sm text-gray-400">
          No orders yet. Send a buyer message in the WhatsApp simulator to create the first order.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, run }: { order: Order; run: RunAction }) {
  const isPending = order.status === "PENDING_PAYMENT" || order.status === "PARTIALLY_PAID";
  const shippingNaira = Number(order.shippingFeeKobo) / 100;
  const itemOnlyNaira = order.totalAmountNaira - shippingNaira;
  const canSimulatePartial =
    order.status === "PENDING_PAYMENT" &&
    shippingNaira > 0 &&
    itemOnlyNaira > 0 &&
    itemOnlyNaira < order.totalAmountNaira;
  const overpaidNaira = Number(order.overpaidAmountKobo ?? "0") / 100;
  const isExpired =
    isPending && new Date(order.paymentExpiresAt).getTime() < Date.now();

  const simulateFull = () => {
    void run(
      async () =>
        (
          await api.simulateTransfer(order.shortCode, order.remainingBalanceNaira)
        ).state
    );
  };

  const simulatePartial = () => {
    void run(
      async () =>
        (await api.simulateTransfer(order.shortCode, itemOnlyNaira)).state
    );
  };

  const dispatch = () => {
    const riderPhone = window.prompt(
      `Rider phone for ${order.shortCode} (optional)`,
      order.riderPhone ?? "08031112222"
    );
    if (riderPhone === null) return;
    void run(() => api.dispatchOrder(order.shortCode, riderPhone.trim() || undefined));
  };

  const expire = () => {
    const confirmed = window.confirm(
      `Expire ${order.shortCode} and release ${order.quantity} reserved unit(s)?`
    );
    if (!confirmed) return;
    void run(() => api.expireOrder(order.shortCode));
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono font-bold text-white text-sm">{order.shortCode}</span>
          <span
            className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${
              STATUS_STYLES[order.status] ?? "bg-gray-800 text-gray-300 border-gray-700"
            }`}
          >
            {order.status}
          </span>
          <span className="text-xs text-gray-400">
            {order.customerName} ({order.customerPhone})
          </span>
          {isExpired ? (
            <span className="text-[11px] font-semibold text-rose-300">hold elapsed</span>
          ) : null}
        </div>

        <div className="text-sm text-gray-200 font-medium">
          {order.productName} <span className="text-gray-400">×{order.quantity}</span>
          {" • "}Delivery ({order.shippingZoneName}):{" "}
          <span className="text-gray-300">{order.shippingFeeFormatted}</span>
          {order.discountCode ? (
            <>
              {" • "}Promo{" "}
              <span className="text-emerald-400">
                {order.discountCode} (-{order.discountAmountFormatted})
              </span>
            </>
          ) : null}
        </div>

        <div className="text-xs text-gray-400 font-mono break-words">
          🏦 {order.bankName} • NUBAN:{" "}
          <span className="text-emerald-400 font-bold">{order.accountNumber}</span>
          {" • "}Paid: {order.amountPaidFormatted} / Total:{" "}
          <span className="text-white font-bold">{order.totalAmountFormatted}</span>
        </div>

        {isPending && order.remainingBalanceNaira > 0 ? (
          <div className="text-xs text-amber-300">
            Remaining balance: <strong>{order.remainingBalanceFormatted}</strong>
            {order.riderPhone ? ` • Rider: ${order.riderPhone}` : ""}
          </div>
        ) : null}

        {overpaidNaira > 0 && order.overpaidAmountFormatted ? (
          <div className="text-xs text-teal-300">
            💚 Overpayment received: <strong>{order.overpaidAmountFormatted}</strong> — refund or
            credit the buyer.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        {isPending ? (
          <button
            type="button"
            onClick={simulateFull}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            💸 Simulate Transfer ({order.remainingBalanceFormatted})
          </button>
        ) : null}

        {canSimulatePartial ? (
          <button
            type="button"
            onClick={simulatePartial}
            title="Test what happens when a Nigerian buyer forgets to add the delivery fee"
            className="bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            ⚠️ Simulate Partial (Forgot Delivery: ₦{itemOnlyNaira.toLocaleString()})
          </button>
        ) : null}

        {isPending ? (
          <button
            type="button"
            onClick={expire}
            className="bg-gray-800 hover:bg-gray-700 text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-700"
          >
            ⌛ Expire &amp; Release Stock
          </button>
        ) : null}

        {order.status === "PAID" ? (
          <button
            type="button"
            onClick={dispatch}
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            🚚 Mark Dispatched
          </button>
        ) : null}

        {order.status === "OUT_FOR_DELIVERY" ? (
          <span className="text-xs text-sky-300 self-center">
            🛣️ Out for delivery{order.riderPhone ? ` • ${order.riderPhone}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
