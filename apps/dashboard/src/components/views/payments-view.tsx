"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { OrderItem, VendorProfile } from "@/lib/types";
import { EmptyState } from "../ui/empty-state";
import { api } from "@/lib/api";

interface PaymentsViewProps {
  initialTab?: "splits" | "accounts" | "detail" | "rules";
  initialOrderCode?: string;
  orders?: OrderItem[];
  vendor?: VendorProfile;
  onNavigateToOrder?: (orderCode: string) => void;
  onSimulateTransfer?: (orderCode: string, amountNaira: number) => Promise<void>;
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

const buildTransactions = (orders: OrderItem[] = []): TransactionItem[] => {
  if (!orders || orders.length === 0) return [];

  return orders
    .filter((o) => o.amountPaidNaira > 0 || o.status === "PAID" || o.status === "PARTIALLY_PAID")
    .map((o, idx) => {
      const gross = o.amountPaidNaira || o.totalAmountNaira;
      const fee = Math.round(gross * 0.015); // Monnify ~1.5% fee
      const net = Math.max(0, gross - fee);
      const orderDate = new Date(o.paidAt || o.createdAt);
      return {
        id: `tx-${o.id || idx}`,
        orderCode: o.shortCode,
        amount: gross,
        gatewayRef: o.invoiceReference || `MNFY-${o.shortCode}`,
        date: orderDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time:
          orderDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          }) + " WAT",
        supplierGross: net,
        repGross: 0,
        repNet: net,
        fee,
        customerStatus: "Paid" as const,
        supplierSettlement: "Both settled" as const,
        repSettlement: "Both settled" as const,
      };
    });
};

const BANK_NAME_TO_CODE: Record<string, string> = {
  "Guaranty Trust Bank": "058",
  "GTBank": "058",
  "Access Bank": "044",
  "Zenith Bank": "057",
  "First Bank of Nigeria": "011",
  "United Bank for Africa (UBA)": "033",
  "Moniepoint MFB": "50515",
  "Kuda Bank": "50211",
  "OPay": "999992",
  "PalmPay": "999991",
  "Wema Bank": "035",
  "FCMB": "214",
  "Providus Bank": "101",
};

export function PaymentsView({
  initialTab = "splits",
  initialOrderCode,
  orders = [],
  vendor,
  onNavigateToOrder,
  onSimulateTransfer,
}: PaymentsViewProps) {
  // Tabs: 'splits' | 'accounts' | 'detail' | 'rules'
  const [activeTab, setActiveTab] = useState<"splits" | "accounts" | "detail" | "rules">(initialTab);
  const [selectedOrderCode, setSelectedOrderCode] = useState<string | null>(initialOrderCode || null);

  // Fund Withdrawal State with 6-Digit WhatsApp PIN
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("50000");
  const [withdrawBank, setWithdrawBank] = useState("Wema Bank");
  const [withdrawAccount, setWithdrawAccount] = useState("0123456789");
  const [withdrawPin, setWithdrawPin] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [codeSentNotice, setCodeSentNotice] = useState<string | null>(null);

  const handleRequestWithdrawalPin = async () => {
    setCodeSentNotice(null);
    setWithdrawError(null);
    try {
      const res = await api.requestOtp(vendor?.whatsappPhone || "+2348031234567", "WITHDRAWAL");
      setCodeSentNotice(`🔐 6-digit PIN sent to your WhatsApp (${res.destinationPhone})!`);
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "Failed to send WhatsApp code.");
    }
  };

  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const cleanPin = withdrawPin.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setWithdrawError("Please enter the 6-digit WhatsApp verification code.");
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const res = await api.withdrawFunds({
        amountNaira: Number(withdrawAmount) || 0,
        bankName: withdrawBank,
        accountNumber: withdrawAccount,
        securityCode: cleanPin,
      });
      setWithdrawSuccess(`✓ Dispatched payout of ₦${Number(withdrawAmount).toLocaleString()}! Reference: ${res.reference}`);
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawPin("");
        setWithdrawSuccess(null);
        setCodeSentNotice(null);
      }, 2500);
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "Withdrawal failed.");
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Derive transactions dynamically from orders and allow in-memory updates for detail flows
  const [transactions, setTransactions] = useState<TransactionItem[]>(() => buildTransactions(orders));

  useEffect(() => {
    setTransactions(buildTransactions(orders));
  }, [orders]);

  useEffect(() => {
    if (initialOrderCode) {
      setSelectedOrderCode(initialOrderCode);
    }
  }, [initialOrderCode]);

  const currentOrder = useMemo(() => {
    if (selectedOrderCode) {
      const match = orders.find((o) => o.shortCode === selectedOrderCode);
      if (match) return match;
    }
    return orders.find((o) => o.status === "PAID" || o.amountPaidNaira > 0) || orders[0] || null;
  }, [orders, selectedOrderCode]);

  // Financial splits for currently inspected order
  const currentOrderGross = currentOrder ? (currentOrder.amountPaidNaira || currentOrder.totalAmountNaira) : 0;
  const currentOrderFee = Math.round(currentOrderGross * 0.015);
  const currentOrderSupplier = Math.round(currentOrderGross * 0.75);
  const currentOrderRepGross = Math.max(0, currentOrderGross - currentOrderSupplier);
  const currentOrderRepNet = Math.max(0, currentOrderRepGross - currentOrderFee);

  const itemsDescription = useMemo(() => {
    if (!currentOrder) return "";
    if (currentOrder.items && currentOrder.items.length > 0) {
      return currentOrder.items
        .map((it) => `${it.quantity} × ${it.productName}${it.variantName ? ` (${it.variantName})` : ""}`)
        .join(" + ");
    }
    return `${currentOrder.quantity} × ${currentOrder.productName}${currentOrder.variantName ? ` (${currentOrder.variantName})` : ""}`;
  }, [currentOrder]);

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
  const [refundAmount, setRefundAmount] = useState(() => String(currentOrderGross || 20000));
  const [refundReason, setRefundReason] = useState("Customer requested cancellation");
  const [reviewedLiability, setReviewedLiability] = useState(false);
  const [refundSubmitted, setRefundSubmitted] = useState(false);
  const [timelineRefreshing, setTimelineRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState(false);

  useEffect(() => {
    if (currentOrderGross > 0) {
      setRefundAmount(String(currentOrderGross));
    }
  }, [currentOrderGross]);

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

  const handleValidateAccount = async () => {
    if (accountNumber.length !== 10) return;
    setAccountValidating(true);
    try {
      const code = BANK_NAME_TO_CODE[bankSelect] || "50515";
      const res = await api.linkBankAccount({
        bankCode: code,
        accountNumber,
      });
      setReplacementValidated(true);
      setGatewayTimeoutResolved(true);
      alert(`✅ Settlement account verified! Monnify subaccount provisioned: ${res.subAccountCode}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to link settlement account.");
    } finally {
      setAccountValidating(false);
    }
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
          tx.orderCode === (currentOrder?.shortCode || "CT-1042")
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
  /* Screen 13: Payments · Split detail and refund review (Dynamic Order)        */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "detail") {
    if (!currentOrder) {
      return (
        <div className="space-y-6 max-w-6xl mx-auto pb-16">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("splits")}
              className="hover:text-emerald-700 underline"
            >
              Payments / Split transactions
            </button>
            <span>/</span>
            <span>Order Detail</span>
          </div>
          <EmptyState
            badge="Split Settlements"
            icon="💳"
            title="No Transaction Selected"
            description="Select an order from the transactions ledger to inspect its split allocations, Monnify escrow routing, and virtual account reconciliation."
            action={{
              label: "Back to Split Transactions",
              onClick: () => setActiveTab("splits"),
            }}
          />
        </div>
      );
    }

    const orderDate = new Date(currentOrder.paidAt || currentOrder.createdAt);
    const dateFormatted = orderDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = orderDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WAT";

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
              <span>{currentOrder.shortCode}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Split transaction {currentOrder.shortCode}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentOrder.invoiceReference || `GW-${currentOrder.shortCode}`} · Customer {currentOrder.status === "PAID" ? "paid" : "total"}{" "}
              {currentOrder.amountPaidFormatted || currentOrder.totalAmountFormatted} · {dateFormatted}, {timeFormatted}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  currentOrder.status === "PAID"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                Customer payment: {currentOrder.status === "PAID" ? "Paid" : currentOrder.status}
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  payoutRetried || currentOrder.status === "PAID"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {payoutRetried
                  ? "Settlement: Re-queued / Settling"
                  : currentOrder.status === "PAID"
                  ? "Settlement: Both settled"
                  : "Settlement: Awaiting Customer Payment"}
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
              if (onNavigateToOrder) onNavigateToOrder(currentOrder.shortCode);
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
                  Original payment · {itemsDescription}
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
                      <td className="px-4 py-3 font-medium">₦{currentOrderSupplier.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-400">₦0</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        ₦{currentOrderSupplier.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">Nia Stores</div>
                        <div className="text-[11px] text-gray-400 font-mono">SUB-NS-001</div>
                      </td>
                      <td className="px-4 py-3 font-medium">₦{currentOrderRepGross.toLocaleString()}</td>
                      <td className="px-4 py-3 text-rose-600 font-medium">-₦{currentOrderFee.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        ₦{currentOrderRepNet.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-500">Gateway fee</td>
                      <td className="px-4 py-3 text-gray-400">Included above</td>
                      <td className="px-4 py-3 text-gray-400">From Nia gross</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        ₦{currentOrderFee.toLocaleString()} retained
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row justify-between text-xs text-gray-600 gap-2">
                <span>Customer payment reconciliation</span>
                <span className="font-mono font-semibold text-gray-900">
                  ₦{currentOrderSupplier.toLocaleString()} + ₦{currentOrderRepNet.toLocaleString()} + ₦{currentOrderFee.toLocaleString()} = ₦{currentOrderGross.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Gross reseller margin ₦{currentOrderRepGross.toLocaleString()} is included in customer payment, not an extra charge.
              </p>
            </div>

            {/* Recipient payout recovery card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Recipient payout recovery</h3>

              {!payoutRetried ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Monnify Virtual Settlement Channel Active</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Virtual account {currentOrder.accountNumber || "NUBAN"} ({currentOrder.bankName || "Wema Bank"}) is linked to automated split escrow.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Payout retry dispatched</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Transfer PAY-NS-{currentOrder.shortCode}-R1 re-queued to Nia Stores. Monnify gateway is awaiting bank confirmation.
                  </p>
                </div>
              )}

              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Beneficiary</span>
                  <span className="font-semibold text-gray-900">Nia Stores · •••• {currentOrder.accountNumber ? currentOrder.accountNumber.slice(-4) : "0142"}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Net Allocation Amount</span>
                  <span className="font-bold text-emerald-800">₦{currentOrderRepNet.toLocaleString()}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Order Creation / Payment</span>
                  <span className="font-semibold text-gray-900">
                    {dateFormatted} · {timeFormatted}
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
                Retry this recipient settlement only. Recheck gateway status first to avoid a duplicate transfer.
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
                    Full or partial refund calculation for {currentOrder.shortCode}
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
                  <span className="font-semibold text-gray-900">₦{currentOrderSupplier.toLocaleString()}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-gray-500">Nia recovery</span>
                  <span className="font-semibold text-gray-900">₦{currentOrderRepGross.toLocaleString()}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-gray-500">Nia original fee cost</span>
                  <span className="font-medium text-rose-700">₦{currentOrderFee.toLocaleString()} · Not refunded</span>
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
                  Preview assumes supplier reverses ₦{currentOrderSupplier.toLocaleString()} and Nia reverses ₦{currentOrderRepGross.toLocaleString()}. Original ₦{currentOrderFee.toLocaleString()} gateway fee is non-returned and remains Nia&apos;s cost.
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
                  <div className="font-bold text-gray-900">{timeFormatted} · Event Received</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Signed event verified on server for {currentOrder.shortCode}. Total: NGN {currentOrderGross.toLocaleString()}.
                  </p>
                </div>

                <div>
                  <div className="font-bold text-gray-900">Allocated</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Supplier ₦{currentOrderSupplier.toLocaleString()}; reseller net ₦{currentOrderRepNet.toLocaleString()}; fee ₦{currentOrderFee.toLocaleString()}.
                  </p>
                </div>

                <div>
                  <div className="font-bold text-emerald-700">Virtual Account</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {currentOrder.bankName || "Wema Bank"} · {currentOrder.accountNumber || "NUBAN Generated"} · Ref: {currentOrder.invoiceReference || `GW-${currentOrder.shortCode}`}
                  </p>
                </div>

                <div>
                  <div
                    className={`font-bold ${
                      currentOrder.status === "PAID" ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    Status: {currentOrder.status}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {currentOrder.status === "PAID"
                      ? "Escrow split verified and released to designated subaccounts."
                      : "Awaiting customer bank transfer to dynamic virtual account."}
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

          {/* Reseller · Store Settlement Account */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                Settlement · {vendor?.businessName || "My Store"}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  replacementValidated || vendor?.monnifySubAccountCode
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {replacementValidated || vendor?.monnifySubAccountCode
                  ? "Verified & Ready"
                  : "Setup Required"}
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
                  <option value="Moniepoint MFB">Moniepoint MFB</option>
                  <option value="GTBank">Guaranty Trust Bank (GTBank)</option>
                  <option value="Access Bank">Access Bank</option>
                  <option value="Zenith Bank">Zenith Bank</option>
                  <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                  <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                  <option value="OPay">OPay Digital Services</option>
                  <option value="PalmPay">PalmPay</option>
                  <option value="Kuda Bank">Kuda Microfinance Bank</option>
                  <option value="Wema Bank">Wema Bank (ALAT)</option>
                  <option value="FCMB">FCMB</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  10-Digit Settlement Account Number
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
                      : "border-gray-200 text-gray-900"
                  }`}
                />
                {accountNumber.length > 0 && accountNumber.length !== 10 && (
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
                    ? `✓ ${vendor?.businessName || "Store Account"} (Matched)`
                    : "Waiting for 10-digit number"}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Active account: {vendor?.bankName || "Moniepoint MFB"} ••••{" "}
              {vendor?.bankAccountNumber ? vendor.bankAccountNumber.slice(-4) : "4567"}{" "}
              (Subaccount: <span className="font-mono font-bold text-gray-600">{vendor?.monnifySubAccountCode || "SUB-NS-001"}</span>) receives instant split disbursements.
            </p>

            <button
              onClick={handleValidateAccount}
              disabled={accountValidating || accountNumber.length !== 10}
              className="px-4 py-2 border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {accountValidating ? "Provisioning Subaccount..." : "Verify & Link Settlement Account"}
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
      {(() => {
        const totalVolume = transactions.reduce(
          (acc, t) => acc + (t.customerStatus === "Paid" ? t.amount : 0),
          0
        );
        const totalSettled = transactions.reduce((acc, t) => acc + t.supplierGross, 0);
        const totalFees = transactions.reduce((acc, t) => acc + t.fee, 0);
        const failedPayout = transactions.find((t) => t.repSettlement === "Rep failed");

        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
                <div className="text-xs text-emerald-100 font-medium">Paid customer volume</div>
                <div className="text-3xl font-extrabold mt-1">₦{totalVolume.toLocaleString()}</div>
                <div className="text-[11px] text-emerald-200 mt-2">
                  {transactions.length} confirmed orders · Filtered period
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-medium">Store settlements</div>
                  <div className="text-3xl font-extrabold text-gray-900 mt-1">
                    ₦{totalSettled.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">Verified bank settlements</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(true)}
                  className="mt-3 w-full py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>💸 Withdraw Funds</span>
                </button>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="text-xs text-gray-500 font-medium">Processing fees</div>
                <div className="text-3xl font-extrabold text-gray-900 mt-1">
                  ₦{totalFees.toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-400 mt-2">Monnify gateway charges (~1.5%)</div>
              </div>
            </div>

            {/* Alert Banner: Only if a recipient payout failed */}
            {failedPayout && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex items-start gap-3">
                <span className="text-amber-700 font-bold text-sm">⚠</span>
                <div className="text-amber-900 flex-1">
                  <span className="font-bold">One recipient payout failed</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {failedPayout.orderCode} is paid. The payout failed. Do not ask the customer to pay again.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("detail")}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 underline shrink-0"
                >
                  Review {failedPayout.orderCode} →
                </button>
              </div>
            )}

            {/* Test Payment Console for Pending Orders */}
            {(() => {
              const pendingOrders = orders.filter(
                (o) => o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID"
              );
              if (pendingOrders.length === 0 || !onSimulateTransfer) return null;

              return (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950">
                          Payment Integration Test Console ({pendingOrders.length} Order{pendingOrders.length > 1 ? "s" : ""} Awaiting Bank Transfer)
                        </h4>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Simulate verified customer bank transfers to verify real-time Monnify webhook reconciliation, inventory deduction, and WhatsApp notifications.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-200/70 text-emerald-900 rounded-full self-start sm:self-auto">
                      Test Mode Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {pendingOrders.map((ord) => {
                      const dueNaira =
                        Number(
                          BigInt(ord.totalAmountKobo) -
                            (ord.amountPaidKobo ? BigInt(ord.amountPaidKobo) : 0n)
                        ) / 100;
                      return (
                        <div
                          key={ord.id}
                          className="bg-white border border-emerald-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-gray-900 text-xs">
                                {ord.shortCode}
                              </span>
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                {ord.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1">
                              Customer: <strong className="text-gray-800">{ord.customerName}</strong>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              NUBAN: <span className="font-mono font-bold text-gray-800">{ord.accountNumber || "Dynamic"}</span> ({ord.bankName || "Moniepoint"})
                            </div>
                            <div className="text-xs font-bold text-emerald-900 mt-1">
                              Due: {ord.totalAmountFormatted || `₦${dueNaira.toLocaleString()}`}
                            </div>
                          </div>

                          <div className="flex gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => void onSimulateTransfer(ord.shortCode, dueNaira)}
                              className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center active:scale-95 shadow-2xs"
                            >
                              ⚡ Pay ₦{dueNaira.toLocaleString()}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void onSimulateTransfer(
                                  ord.shortCode,
                                  Math.max(100, Math.round(dueNaira * 0.5))
                                )
                              }
                              className="px-2 py-1.5 border border-amber-300 hover:bg-amber-50 text-amber-800 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer active:scale-95"
                              title="Simulate partial payment (forgot delivery fee)"
                            >
                              ½ Partial
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}

      {transactions.length === 0 ? (
        <EmptyState
          badge="Split Settlements"
          icon="💳"
          title="No Payment Transactions Yet"
          description="When customers transfer funds to dynamic virtual accounts generated via Monnify, verified settlements, supplier splits, and escrow releases will appear here in real time."
        />
      ) : (
        <>
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
                      onClick={() => {
                        setSelectedOrderCode(tx.orderCode);
                        setActiveTab("detail");
                      }}
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
              {transactions.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedOrderCode(transactions[0].orderCode);
                    setActiveTab("detail");
                  }}
                  className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Open {transactions[0].orderCode} &amp; review →
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Filtered reconciliation</h3>
              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Customer funds</span>
                  <span className="font-semibold text-gray-900">
                    ₦{filteredTransactions.reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Supplier + rep net</span>
                  <span className="font-semibold text-gray-900">
                    ₦{filteredTransactions.reduce((acc, t) => acc + t.supplierGross + t.repNet, 0).toLocaleString()}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Gateway fees</span>
                  <span className="font-semibold text-gray-900">
                    ₦{filteredTransactions.reduce((acc, t) => acc + t.fee, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 6-Digit PIN Fund Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  💸
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Withdraw Funds</h3>
                  <p className="text-[11px] text-gray-500">Disburse settlement balance to your Nigerian bank</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError(null);
                  setWithdrawSuccess(null);
                  setCodeSentNotice(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {withdrawError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {withdrawError}
              </div>
            )}

            {withdrawSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
                <span>✓</span>
                <span>{withdrawSuccess}</span>
              </div>
            )}

            {codeSentNotice && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-xl flex items-center gap-2">
                <span>📩</span>
                <span>{codeSentNotice}</span>
              </div>
            )}

            <form onSubmit={handleExecuteWithdrawal} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                  Withdrawal Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-gray-500 font-bold">₦</span>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawBank}
                    onChange={(e) => setWithdrawBank(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawAccount}
                    onChange={(e) => setWithdrawAccount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-gray-900"
                  />
                </div>
              </div>

              {/* 6-Digit WhatsApp PIN Input */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-gray-700 uppercase">
                    6-Digit WhatsApp Security Code
                  </label>
                  <button
                    type="button"
                    onClick={handleRequestWithdrawalPin}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                  >
                    Request Code on WhatsApp
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={withdrawPin}
                  onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="w-full px-3 py-2.5 text-center text-lg font-mono font-bold tracking-[0.4em] bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
                <p className="text-[10px] text-gray-500">
                  A 6-digit confirmation code will be sent to your verified store phone on WhatsApp.
                </p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawSubmitting || withdrawPin.length !== 6}
                  className="flex-1 py-2.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {withdrawSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authorizing Payout...</span>
                    </>
                  ) : (
                    <span>Confirm &amp; Disburse Payout →</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
