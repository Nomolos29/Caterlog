"use client";

import React, { useState, useMemo } from "react";

interface PaymentsViewProps {
  initialTab?: "splits" | "accounts" | "detail" | "rules";
  onNavigateToOrder?: (orderCode: string) => void;
}

interface TransactionItem {
  id: string;
  orderCode: string;
  amount: number;
  gatewayRef: string;
  date: string;
  time: string;
  supplierGross: number;
  repGross: number;
  repNet: number;
  fee: number;
  customerStatus: "Paid" | "Payment failed";
  supplierSettlement: "Supplier pending" | "Both settled" | "Not created";
  repSettlement: "Rep failed" | "Both settled" | "Not created" | "Settled";
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    orderCode: "CT-1042",
    amount: 20000,
    gatewayRef: "GW-1042",
    date: "3 Nov 2026",
    time: "10:18 WAT",
    supplierGross: 16000,
    repGross: 4000,
    repNet: 3700,
    fee: 300,
    customerStatus: "Paid",
    supplierSettlement: "Supplier pending",
    repSettlement: "Rep failed",
  },
  {
    id: "tx-2",
    orderCode: "CT-1041",
    amount: 10000,
    gatewayRef: "GW-1041",
    date: "2 Nov 2026",
    time: "14:20 WAT",
    supplierGross: 8000,
    repGross: 2000,
    repNet: 1850,
    fee: 150,
    customerStatus: "Paid",
    supplierSettlement: "Both settled",
    repSettlement: "Both settled",
  },
  {
    id: "tx-3",
    orderCode: "CT-1040",
    amount: 20000,
    gatewayRef: "GW-1040",
    date: "1 Nov 2026",
    time: "11:05 WAT",
    supplierGross: 16000,
    repGross: 4000,
    repNet: 3700,
    fee: 300,
    customerStatus: "Paid",
    supplierSettlement: "Both settled",
    repSettlement: "Both settled",
  },
  {
    id: "tx-4",
    orderCode: "CT-1039",
    amount: 10000,
    gatewayRef: "No capture",
    date: "31 Oct 2026",
    time: "16:45 WAT",
    supplierGross: 0,
    repGross: 0,
    repNet: 0,
    fee: 0,
    customerStatus: "Payment failed",
    supplierSettlement: "Not created",
    repSettlement: "Not created",
  },
];

export function PaymentsView({ initialTab = "splits", onNavigateToOrder }: PaymentsViewProps) {
  // Tabs: 'splits' | 'accounts' | 'detail' | 'rules'
  const [activeTab, setActiveTab] = useState<"splits" | "accounts" | "detail" | "rules">(initialTab);
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);

  // Filter states for split transactions ledger
  const [searchTx, setSearchTx] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [settlementFilter, setSettlementFilter] = useState("All statuses");
  const [dateRange, setDateRange] = useState("1–3 Nov 2026");

  // Payout accounts state
  const [bankSelect, setBankSelect] = useState("Example bank");
  const [accountNumber, setAccountNumber] = useState("012345678");
  const [accountValidating, setAccountValidating] = useState(false);
  const [gatewayChecking, setGatewayChecking] = useState(false);
  const [replacementValidated, setReplacementValidated] = useState(false);
  const [gatewayTimeoutResolved, setGatewayTimeoutResolved] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Detail / Refund review state
  const [retryPayoutLoading, setRetryPayoutLoading] = useState(false);
  const [payoutRetried, setPayoutRetried] = useState(false);
  const [refundAmount, setRefundAmount] = useState("20000");
  const [refundReason, setRefundReason] = useState("Customer requested cancellation");
  const [reviewedLiability, setReviewedLiability] = useState(false);
  const [refundSubmitted, setRefundSubmitted] = useState(false);
  const [timelineRefreshing, setTimelineRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState(false);

  // CSV Export functionality
  const handleExportCSV = () => {
    const header = "Order ID,Gateway Ref,Date,Time,Amount (NGN),Supplier (NGN),Rep Gross (NGN),Fee (NGN),Rep Net (NGN),Customer Status,Settlement Status\n";
    const rows = transactions
      .map(
        (t) =>
          `"${t.orderCode}","${t.gatewayRef}","${t.date}","${t.time}",${t.amount},${t.supplierGross},${t.repGross},${t.fee},${t.repNet},"${t.customerStatus}","${t.supplierSettlement} / ${t.repSettlement}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `caterlog-split-transactions-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (searchTx.trim()) {
        const q = searchTx.toLowerCase();
        const matches =
          t.orderCode.toLowerCase().includes(q) ||
          t.gatewayRef.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== "All statuses") {
        if (t.customerStatus !== statusFilter) return false;
      }
      if (settlementFilter === "Both settled") {
        if (t.supplierSettlement !== "Both settled") return false;
      } else if (settlementFilter === "Action needed") {
        if (t.repSettlement !== "Rep failed" && t.supplierSettlement !== "Supplier pending") {
          return false;
        }
      }
      return true;
    });
  }, [transactions, searchTx, statusFilter, settlementFilter]);

  // Account Number Validation Handler
  const handleAccountChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(cleaned);
    if (cleaned.length === 10) {
      setReplacementValidated(true);
    } else {
      setReplacementValidated(false);
    }
  };

  const handleValidateAccount = () => {
    setAccountValidating(true);
    setTimeout(() => {
      setAccountValidating(false);
      if (accountNumber.length === 10) {
        setReplacementValidated(true);
      }
    }, 800);
  };

  const handleRetryGateway = () => {
    setGatewayChecking(true);
    setTimeout(() => {
      setGatewayChecking(false);
      setGatewayTimeoutResolved(true);
      setReplacementValidated(true);
    }, 1000);
  };

  const handleRetryPayout = () => {
    setRetryPayoutLoading(true);
    setTimeout(() => {
      setRetryPayoutLoading(false);
      setPayoutRetried(true);
      // update transaction status in memory
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.orderCode === "CT-1042"
            ? { ...tx, repSettlement: "Settled" }
            : tx
        )
      );
    }, 1200);
  };

  const handleRefreshGateway = () => {
    setTimelineRefreshing(true);
    setTimeout(() => {
      setTimelineRefreshing(false);
      setRefreshNotice(true);
      setTimeout(() => setRefreshNotice(false), 2500);
    }, 900);
  };

  /* -------------------------------------------------------------------------- */
  /* Screen 13: Payments · Split detail and refund review (CT-1042)             */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "detail") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("splits")}
                className="hover:text-emerald-700 underline"
              >
                Payments / Split transactions
              </button>
              <span>/</span>
              <span>CT-1042</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Split transaction CT-1042
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              GW-1042 · Customer paid ₦20,000 · 3 Nov 2026, 10:18 WAT
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Customer payment: Paid
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  payoutRetried
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {payoutRetried ? "Settlement: Re-queued / Settling" : "Settlement: Action needed"}
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  refundSubmitted
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {refundSubmitted ? "Refund: Proposed / In Review" : "Refund: Not submitted"}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (onNavigateToOrder) onNavigateToOrder("CT-1042");
            }}
            className="px-4 py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all self-start sm:self-center cursor-pointer active:scale-95"
          >
            View order →
          </button>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Allocation ledger card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Allocation ledger</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Original payment · 2 × Stainless flask at ₦10,000
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Recipient</th>
                      <th className="px-4 py-2.5">Gross</th>
                      <th className="px-4 py-2.5">Fee Charged</th>
                      <th className="px-4 py-2.5 text-right">Net Allocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    <tr>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">Aroko Wholesale</div>
                        <div className="text-[11px] text-gray-400 font-mono">SUB-AW-001</div>
                      </td>
                      <td className="px-4 py-3 font-medium">₦16,000</td>
                      <td className="px-4 py-3 text-gray-400">₦0</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">₦16,000</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">Nia Stores</div>
                        <div className="text-[11px] text-gray-400 font-mono">SUB-NS-001</div>
                      </td>
                      <td className="px-4 py-3 font-medium">₦4,000</td>
                      <td className="px-4 py-3 text-rose-600 font-medium">-₦300</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">₦3,700</td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-500">Gateway fee</td>
                      <td className="px-4 py-3 text-gray-400">Included above</td>
                      <td className="px-4 py-3 text-gray-400">From Nia gross</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">₦300 retained</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row justify-between text-xs text-gray-600 gap-2">
                <span>Customer payment reconciliation</span>
                <span className="font-mono font-semibold text-gray-900">
                  ₦16,000 + ₦3,700 + ₦300 = ₦20,000
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Gross reseller margin ₦4,000 is included in the customer payment, not an extra charge.
              </p>
            </div>

            {/* Recipient payout recovery card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Recipient payout recovery</h3>

              {!payoutRetried ? (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                  <div className="font-bold text-rose-800 flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>Nia payout failed · Bank unavailable</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Transfer PAY-NS-1042 was not completed. Customer payment remains paid; the supplier allocation is unaffected.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Payout retry dispatched</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Transfer PAY-NS-1042-R1 re-queued to Nia Stores (•••• 0142). Monnify gateway is awaiting bank confirmation.
                  </p>
                </div>
              )}

              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Beneficiary</span>
                  <span className="font-semibold text-gray-900">Nia Stores · •••• 0142</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Retry amount</span>
                  <span className="font-bold text-emerald-800">₦3,700</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Last attempt</span>
                  <span className="font-semibold text-gray-900">
                    {payoutRetried ? "Just now · Monnify NUBAN clearing" : "3 Nov · 10:23 WAT"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleRetryPayout}
                  disabled={retryPayoutLoading || payoutRetried}
                  className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {retryPayoutLoading
                    ? "Dispatching retry..."
                    : payoutRetried
                    ? "✓ Payout Re-queued"
                    : "Retry recipient payout"}
                </button>
                <button
                  onClick={() => setActiveTab("accounts")}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Check payout account
                </button>
              </div>

              <p className="text-[10px] text-gray-400">
                Retry this failed recipient only. Recheck gateway status first to avoid a duplicate transfer.
              </p>
            </div>

            {/* Refund proposal · review before submission */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Refund proposal · review before submission
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Full refund example — nothing has been refunded yet
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {refundSubmitted ? "Submitted" : "Draft only"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Refund amount (NGN)
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Reason</label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>Customer requested cancellation</option>
                    <option>Stock unavailable</option>
                    <option>Merchant agreement</option>
                  </select>
                </div>
              </div>

              <div className="divide-y divide-gray-100 p-3 bg-gray-50 rounded-xl">
                <div className="py-1.5 flex justify-between">
                  <span className="text-gray-500">Customer refund proposed</span>
                  <span className="font-semibold text-gray-900">₦{Number(refundAmount || 0).toLocaleString()}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-gray-500">Supplier recovery</span>
                  <span className="font-semibold text-gray-900">₦16,000</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-gray-500">Nia recovery</span>
                  <span className="font-semibold text-gray-900">₦4,000</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-gray-500">Nia original fee cost</span>
                  <span className="font-medium text-rose-700">₦300 · Not refunded</span>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={reviewedLiability}
                  onChange={(e) => setReviewedLiability(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] leading-relaxed">
                  I have reviewed allocations and recipient recovery. Pending or failed payouts must be reconciled before money is returned.
                </span>
              </label>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>Confirm liability before submitting</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Preview assumes supplier reverses ₦16,000 and Nia reverses ₦4,000. Original ₦300 gateway fee is non-returned and remains Nia&apos;s cost. Confirm recipient recovery and liability before authorization.
                </p>
              </div>

              {refundSubmitted && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  ✓ Refund proposal registered for settlement review.
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => alert("Refund draft saved to local proposals")}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                >
                  Save proposal
                </button>
                <button
                  onClick={() => {
                    setRefundSubmitted(true);
                    setTimeout(() => setRefundSubmitted(false), 3000);
                  }}
                  disabled={!reviewedLiability}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Confirm refund
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Gateway confirmation & timeline */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900">Gateway confirmation &amp; timeline</h3>
                {timelineRefreshing && (
                  <span className="text-[10px] text-emerald-600 font-semibold animate-pulse">
                    Checking...
                  </span>
                )}
              </div>

              {refreshNotice && (
                <div className="p-2 bg-emerald-50 text-emerald-800 text-[11px] rounded font-medium">
                  ✓ Gateway event signatures re-verified against Monnify public keys.
                </div>
              )}

              <div className="space-y-3.5 relative pl-4 border-l-2 border-emerald-500">
                <div>
                  <div className="font-bold text-gray-900">10:18 · Confirmed</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Signed payment event verified on server. Amount and currency matched: NGN 20,000.
                  </p>
                </div>

                <div>
                  <div className="font-bold text-gray-900">10:19 · Allocated</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Supplier ₦16,000; reseller net ₦3,700; fee ₦300.
                  </p>
                </div>

                <div>
                  <div className="font-bold text-amber-700">10:20 · Supplier pending</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    PAY-AW-1042 · Awaiting gateway settlement confirmation. No guaranteed date.
                  </p>
                </div>

                <div>
                  <div
                    className={`font-bold ${
                      payoutRetried ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {payoutRetried ? "10:28 · Rep payout re-dispatched" : "10:23 · Rep payout failed"}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {payoutRetried
                      ? "PAY-NS-1042-R1 · Sent to bank clearing network. Verification in progress."
                      : "PAY-NS-1042 · Bank unavailable. Retry is available."}
                  </p>
                </div>
              </div>

              <button
                onClick={handleRefreshGateway}
                disabled={timelineRefreshing}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{timelineRefreshing ? "Refreshing..." : "Refresh gateway status"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 11: Payments · Payout accounts and splits                           */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "accounts" || activeTab === "rules") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-24">
        {/* Header */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Payments / Payout accounts</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Payout accounts &amp; split setup
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Validate both recipients before enabling automated split checkout.
          </p>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("splits")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Split transactions
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`pb-2.5 ${
              activeTab === "accounts"
                ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Payout accounts
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`pb-2.5 ${
              activeTab === "rules"
                ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Split rules
          </button>
        </div>

        {/* 2 Column Grid for Supplier and Reseller */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supplier · Aroko Wholesale */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Supplier · Aroko Wholesale</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Ready
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Business identity</span>
                <span className="font-semibold text-gray-900">Verified</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Account name</span>
                <span className="font-semibold text-gray-900">Aroko Wholesale</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Bank account</span>
                <span className="font-semibold text-gray-900">Example bank · •••• 4201</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Gateway subaccount</span>
                <span className="font-mono font-semibold text-gray-900">SUB-AW-001 · Active</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Supplier payout details are managed by Aroko. You cannot change their beneficiary.
            </p>

            <button
              onClick={() => setShowVerificationModal(true)}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              View verification
            </button>
          </div>

          {/* Reseller · Nia Stores */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Reseller · Nia Stores</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  replacementValidated
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {replacementValidated ? "Verified & Ready" : "Update pending"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Business identity</span>
                <span className="font-semibold text-gray-900">Verified</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bank</label>
                <select
                  value={bankSelect}
                  onChange={(e) => setBankSelect(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
                >
                  <option>Example bank</option>
                  <option>Access Bank</option>
                  <option>Zenith Bank</option>
                  <option>GTBank</option>
                  <option>First Bank of Nigeria</option>
                  <option>Kuda Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Replacement account number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="Enter 10-digit account number"
                  value={accountNumber}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none ${
                    accountNumber.length === 10
                      ? "border-emerald-500 text-gray-900"
                      : "border-rose-300 text-rose-900"
                  }`}
                />
                {accountNumber.length !== 10 && (
                  <p className="text-[11px] text-rose-600 mt-1">
                    Enter a 10-digit Nigerian account number ({accountNumber.length}/10 digits).
                  </p>
                )}
              </div>

              <div className="flex justify-between py-1 text-xs">
                <span className="text-gray-500">Account-name match</span>
                <span
                  className={`font-semibold ${
                    accountNumber.length === 10 ? "text-emerald-700" : "text-gray-500"
                  }`}
                >
                  {accountNumber.length === 10
                    ? "✓ Nia Stores & Goods Ltd (Matched)"
                    : "Waiting for valid number"}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Current account •••• 0142 and subaccount SUB-NS-001 remain active until the replacement is verified.
            </p>

            <button
              onClick={handleValidateAccount}
              disabled={accountValidating}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              {accountValidating ? "Validating NUBAN..." : "Validate & retry"}
            </button>
          </div>
        </div>

        {/* 2 Column Bottom: Automatic Split Rule & Readiness Checks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Automatic split rule card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Automatic split rule</h3>
              <p className="text-[11px] text-gray-400">
                Supplier cost first; your markup goes to your reseller subaccount
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Applies to</label>
              <select className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white">
                <option>All linked Aroko Wholesale products</option>
              </select>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Customer pays · 2 flasks</span>
                <span className="font-semibold text-gray-900">₦20,000</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Aroko receives · 2 × ₦8,000</span>
                <span className="font-semibold text-gray-900">₦16,000</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Nia gross reseller margin</span>
                <span className="font-semibold text-gray-900">₦4,000</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Gateway fee · borne by Nia</span>
                <span className="font-semibold text-rose-600">-₦300</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Nia net allocation</span>
                <span className="font-bold text-emerald-700 text-sm">₦3,700</span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <span>ℹ</span>
                <span>Split at payment, settle separately</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Payment success does not mean bank settlement is complete. Recipient payouts can be pending or fail independently.
              </p>
            </div>
          </div>

          {/* Readiness checks card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Readiness checks</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Current checkout ready
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between">
                <span className="text-gray-600">Supplier beneficiary</span>
                <span className="font-semibold text-emerald-700">✓ Validated</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-600">Current reseller beneficiary</span>
                <span className="font-semibold text-emerald-700">✓ Validated</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-600">Replacement beneficiary</span>
                <span
                  className={`font-semibold ${
                    replacementValidated ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {replacementValidated ? "✓ Validated" : "Pending validation"}
                </span>
              </div>
            </div>

            {!gatewayTimeoutResolved ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>Gateway timeout · last attempt</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Replacement subaccount creation did not complete. Correct the account number, then retry. No duplicate subaccount was created.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Gateway subaccount ready</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  SUB-NS-002 provisioned and linked to Monnify escrow split router.
                </p>
              </div>
            )}

            <button
              onClick={handleRetryGateway}
              disabled={gatewayChecking || gatewayTimeoutResolved}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              {gatewayChecking
                ? "Checking gateway..."
                : gatewayTimeoutResolved
                ? "✓ Gateway Verified"
                : "Retry gateway check"}
            </button>
          </div>
        </div>

        {/* Verification Modal */}
        {showVerificationModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">Aroko Wholesale · Verification</h3>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="text-xs space-y-2 text-gray-700">
                <p><strong>CAC Registration:</strong> RC-982341 (Active)</p>
                <p><strong>TIN:</strong> 21980324-0001</p>
                <p><strong>Settlement NUBAN:</strong> Example bank (•••• 4201)</p>
                <p><strong>Monnify Subaccount:</strong> SUB-AW-001 (Automated splits enabled)</p>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 py-3 px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 z-30 shadow-lg text-xs">
          <span className="text-gray-400 text-[11px] text-center sm:text-left">
            Recipient changes affect future payments only. Existing transaction allocations remain recorded against their original recipients.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {configSaved && (
              <span className="text-xs font-semibold text-emerald-700 mr-2">
                ✓ Split configuration saved
              </span>
            )}
            <button
              onClick={() => setActiveTab("splits")}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Discard changes
            </button>
            <button
              onClick={() => {
                setConfigSaved(true);
                setTimeout(() => setConfigSaved(false), 2500);
              }}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0d5c3a] hover:bg-[#0b4b2f] rounded-lg transition-colors shadow-xs"
            >
              Save split configuration
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 12: Payments · Split transactions (Default Ledger)                  */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Payments / Split transactions</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Split transactions</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track customer payments separately from each recipient&apos;s settlement.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-1.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 rounded-lg text-xs font-semibold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 self-start sm:self-center cursor-pointer active:scale-95"
        >
          <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          <span>Export CSV</span>
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        <button
          onClick={() => setActiveTab("splits")}
          className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer active:scale-95"
        >
          Split transactions
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          className="pb-2.5 border-b-2 border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300 font-semibold transition-all cursor-pointer active:scale-95"
        >
          Payout accounts
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className="pb-2.5 border-b-2 border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300 font-semibold transition-all cursor-pointer active:scale-95"
        >
          Split rules
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-emerald-100 font-medium">Paid customer volume</div>
          <div className="text-3xl font-extrabold mt-1">₦50,000</div>
          <div className="text-[11px] text-emerald-200 mt-2">3 confirmed orders · Filtered period</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Supplier allocations</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">₦40,000</div>
          <div className="text-[11px] text-gray-400 mt-2">Aroko Wholesale · Before settlement</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Net rep earnings</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">₦9,250</div>
          <div className="text-[11px] text-gray-400 mt-2">₦10,000 gross less ₦750 fees</div>
        </div>
      </div>

      {/* Alert Banner: One recipient payout failed */}
      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex items-start gap-3">
        <span className="text-amber-700 font-bold text-sm">⚠</span>
        <div className="text-amber-900 flex-1">
          <span className="font-bold">One recipient payout failed</span>
          <p className="text-[11px] text-amber-800 mt-0.5">
            CT-1042 is paid. The ₦16,000 supplier payout is pending and Nia&apos;s ₦3,700 payout failed. Do not ask the customer to pay again.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("detail")}
          className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 underline shrink-0"
        >
          Review CT-1042 →
        </button>
      </div>

      {/* Transaction Ledger Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Transaction ledger</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Showing {filteredTransactions.length} of {transactions.length} transactions · {dateRange}
          </p>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <input
              type="text"
              placeholder="Search by order or reference"
              value={searchTx}
              onChange={(e) => setSearchTx(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="All statuses">All payment statuses</option>
              <option value="Paid">Paid</option>
              <option value="Payment failed">Payment failed</option>
            </select>
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="All statuses">All settlement statuses</option>
              <option value="Both settled">Both settled</option>
              <option value="Action needed">Action needed</option>
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>1–3 Nov 2026</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Order / Paid</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Rep Gross / Net</th>
                <th className="px-4 py-3">Fee · Nia</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-5 py-3">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setActiveTab("detail")}
                  className={`cursor-pointer transition-colors ${
                    tx.repSettlement === "Rep failed"
                      ? "hover:bg-amber-50/40 bg-amber-50/10"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-emerald-800 flex items-center gap-1">
                      <span>{tx.orderCode}</span>
                      <span>↗</span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      ₦{tx.amount.toLocaleString()} · {tx.gatewayRef}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-900">
                    {tx.supplierGross > 0 ? `₦${tx.supplierGross.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    {tx.repGross > 0 ? (
                      <>
                        <div className="text-gray-900 font-medium">₦{tx.repGross.toLocaleString()}</div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          ₦{tx.repNet.toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">₦{tx.fee}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.customerStatus === "Paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {tx.customerStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {tx.supplierSettlement === "Both settled" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Both settled
                      </span>
                    ) : tx.supplierSettlement === "Not created" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                        Not created
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          {tx.supplierSettlement}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            tx.repSettlement === "Settled"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}
                        >
                          {tx.repSettlement}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400 gap-2">
          <span>Fees are charged to the reseller, not deducted from supplier cost.</span>
          <div className="flex gap-2">
            <button
              onClick={() => alert("Already on first page")}
              className="px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => alert("Showing all available rows")}
              className="px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bottom 2 Cards: Payment != settlement & Filtered reconciliation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
          <h3 className="text-xs font-bold text-gray-900">Payment ≠ settlement</h3>
          <p className="text-gray-600 leading-relaxed">
            Paid means Caterlog verified the gateway&apos;s server event. Settled means a recipient&apos;s bank transfer completed. Each recipient has an independent status and reference.
          </p>
          <button
            onClick={() => setActiveTab("detail")}
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Open CT-1042 &amp; review →
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
          <h3 className="text-xs font-bold text-gray-900">Filtered reconciliation</h3>
          <div className="divide-y divide-gray-100">
            <div className="py-2 flex justify-between">
              <span className="text-gray-500">Customer funds</span>
              <span className="font-semibold text-gray-900">₦50,000</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-gray-500">Supplier + rep net</span>
              <span className="font-semibold text-gray-900">₦49,250</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-gray-500">Gateway fees</span>
              <span className="font-semibold text-gray-900">₦750</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
