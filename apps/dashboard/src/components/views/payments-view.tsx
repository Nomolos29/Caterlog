"use client";

import React, { useState } from "react";

interface PaymentsViewProps {
  onNavigateToOrder?: (orderCode: string) => void;
}

export function PaymentsView({ onNavigateToOrder }: PaymentsViewProps) {
  // Tabs: 'splits' | 'accounts' | 'detail' | 'rules'
  const [activeTab, setActiveTab] = useState<"splits" | "accounts" | "detail" | "rules">("splits");

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
  const [configSaved, setConfigSaved] = useState(false);

  // Detail / Refund review state
  const [retryPayoutLoading, setRetryPayoutLoading] = useState(false);
  const [payoutRetried, setPayoutRetried] = useState(false);
  const [refundAmount, setRefundAmount] = useState("20000");
  const [refundReason, setRefundReason] = useState("Customer requested cancellation");
  const [reviewedLiability, setReviewedLiability] = useState(false);
  const [refundSubmitted, setRefundSubmitted] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* Screen 13: Payments · Split detail and refund review (CT-1042)             */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "detail") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
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
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Customer payment: Paid
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Settlement: Action needed
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Refund: Not submitted
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (onNavigateToOrder) onNavigateToOrder("CT-1042");
              else alert("Navigating to Order CT-1042");
            }}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-xs"
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

              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>Nia payout failed · Bank unavailable</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Transfer PAY-NS-1042 was not completed. Customer payment remains paid; the supplier allocation is unaffected.
                </p>
              </div>

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
                  <span className="font-semibold text-gray-900">3 Nov · 10:23 WAT</span>
                </div>
              </div>

              {payoutRetried && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  ✓ Transfer re-queued to Nia Stores. Monitoring Monnify NUBAN clearing...
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setRetryPayoutLoading(true);
                    setTimeout(() => {
                      setRetryPayoutLoading(false);
                      setPayoutRetried(true);
                    }, 1200);
                  }}
                  disabled={retryPayoutLoading}
                  className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {retryPayoutLoading ? "Retrying..." : "Retry recipient payout"}
                </button>
                <button
                  onClick={() => setActiveTab("accounts")}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
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
                  <h3 className="text-sm font-bold text-gray-900">Refund proposal · review before submission</h3>
                  <p className="text-[11px] text-gray-400">Full refund example — nothing has been refunded yet</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  Draft only
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
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Reason
                  </label>
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
                  <span className="font-semibold text-gray-900">₦20,000</span>
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
                <span>
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
                  onClick={() => alert("Refund proposal saved as draft")}
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
              <h3 className="text-xs font-bold text-gray-900">Gateway confirmation &amp; timeline</h3>

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
                  <div className="font-bold text-rose-700">10:23 · Rep payout failed</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    PAY-NS-1042 · Bank unavailable. Retry is available.
                  </p>
                </div>
              </div>

              <button
                onClick={() => alert("Gateway status refreshed. All server signatures valid.")}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                Refresh gateway status
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
  if (activeTab === "accounts") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-20">
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
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Payout accounts
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
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
              onClick={() => alert("Viewing Aroko Wholesale verified credentials")}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              View verification
            </button>
          </div>

          {/* Reseller · Nia Stores */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Reseller · Nia Stores</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Update pending
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-gray-500">Business identity: </span>
                <span className="font-semibold text-gray-900">Verified</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bank</label>
                <select
                  value={bankSelect}
                  onChange={(e) => setBankSelect(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                >
                  <option>Example bank</option>
                  <option>Access Bank</option>
                  <option>Zenith Bank</option>
                  <option>GTBank</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Replacement account number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-rose-300 rounded-lg focus:outline-none focus:border-rose-500"
                />
                <p className="text-[11px] text-rose-600 mt-1">
                  Enter a 10-digit Nigerian account number.
                </p>
              </div>

              <div className="flex justify-between py-1 text-xs">
                <span className="text-gray-500">Account-name match</span>
                <span className="text-gray-700 font-medium">Waiting for valid number</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Current account •••• 0142 and subaccount SUB-NS-001 remain active until the replacement is verified.
            </p>

            <button
              onClick={() => {
                setAccountValidating(true);
                setTimeout(() => setAccountValidating(false), 1500);
              }}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
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
                <span className="font-semibold text-amber-700">Pending validation</span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠</span>
                <span>Gateway timeout · last attempt</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Replacement subaccount creation did not complete. Correct the account number, then retry. No duplicate subaccount was created.
              </p>
            </div>

            <button
              onClick={() => {
                setGatewayChecking(true);
                setTimeout(() => setGatewayChecking(false), 1200);
              }}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              {gatewayChecking ? "Checking gateway..." : "Retry gateway check"}
            </button>
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 py-3 px-8 flex items-center justify-between z-10 shadow-lg text-xs">
          <span className="text-gray-400 text-[11px]">
            Recipient changes affect future payments only. Existing transaction allocations remain recorded against their original recipients.
          </span>
          <div className="flex items-center gap-2">
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
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
          onClick={() => alert("Exporting Split Transactions CSV")}
          className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium"
        >
          Export CSV
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
        <button
          onClick={() => setActiveTab("splits")}
          className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
        >
          Split transactions
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Payout accounts
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
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
        <div className="text-amber-900">
          <span className="font-bold">One recipient payout failed</span>
          <p className="text-[11px] text-amber-800 mt-0.5">
            CT-1042 is paid. The ₦16,000 supplier payout is pending and Nia&apos;s ₦3,700 payout failed. Do not ask the customer to pay again.
          </p>
        </div>
      </div>

      {/* Transaction Ledger Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Transaction ledger</h3>
          <p className="text-xs text-gray-400 mt-0.5">1–4 of 4 transactions · 1–3 Nov 2026</p>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
            <input
              type="text"
              placeholder="Search transactions"
              value={searchTx}
              onChange={(e) => setSearchTx(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>All statuses</option>
              <option>Paid</option>
              <option>Payment failed</option>
            </select>
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>All statuses</option>
              <option>Both settled</option>
              <option>Action needed</option>
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
          <table className="w-full text-left text-xs">
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
              {/* Row 1: CT-1042 */}
              <tr
                onClick={() => setActiveTab("detail")}
                className="hover:bg-amber-50/30 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-emerald-800 flex items-center gap-1">
                    <span>CT-1042</span>
                    <span>↗</span>
                  </div>
                  <div className="text-[11px] text-gray-400">₦20,000 · GW-1042</div>
                </td>
                <td className="px-4 py-3.5 font-medium text-gray-900">₦16,000</td>
                <td className="px-4 py-3.5">
                  <div className="text-gray-900 font-medium">₦4,000</div>
                  <div className="text-[11px] text-emerald-700 font-semibold">₦3,700</div>
                </td>
                <td className="px-4 py-3.5 text-gray-500">₦300</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Paid
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      Supplier pending
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                      Rep failed
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row 2: CT-1041 */}
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-gray-900">CT-1041</div>
                  <div className="text-[11px] text-gray-400">₦10,000 · GW-1041</div>
                </td>
                <td className="px-4 py-3.5 font-medium text-gray-900">₦8,000</td>
                <td className="px-4 py-3.5">
                  <div className="text-gray-900 font-medium">₦2,000</div>
                  <div className="text-[11px] text-emerald-700 font-semibold">₦1,850</div>
                </td>
                <td className="px-4 py-3.5 text-gray-500">₦150</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Paid
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Both settled
                  </span>
                </td>
              </tr>

              {/* Row 3: CT-1040 */}
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-gray-900">CT-1040</div>
                  <div className="text-[11px] text-gray-400">₦20,000 · GW-1040</div>
                </td>
                <td className="px-4 py-3.5 font-medium text-gray-900">₦16,000</td>
                <td className="px-4 py-3.5">
                  <div className="text-gray-900 font-medium">₦4,000</div>
                  <div className="text-[11px] text-emerald-700 font-semibold">₦3,700</div>
                </td>
                <td className="px-4 py-3.5 text-gray-500">₦300</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Paid
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Both settled
                  </span>
                </td>
              </tr>

              {/* Row 4: CT-1039 */}
              <tr className="hover:bg-gray-50 transition-colors opacity-70">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-gray-900">CT-1039</div>
                  <div className="text-[11px] text-gray-400">₦10,000 · No capture</div>
                </td>
                <td className="px-4 py-3.5 font-medium text-gray-400">—</td>
                <td className="px-4 py-3.5 font-medium text-gray-400">—</td>
                <td className="px-4 py-3.5 text-gray-400">₦0</td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    Payment failed
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                    Not created
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span>Fees are charged to the reseller, not deducted from supplier cost.</span>
          <div className="flex gap-2">
            <button className="px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
              Previous
            </button>
            <button className="px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">
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
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
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

