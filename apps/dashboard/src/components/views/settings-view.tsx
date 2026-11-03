"use client";

import React, { useState } from "react";
import type { VendorProfile, ShippingZoneItem, DiscountItem } from "@/lib/types";

interface SettingsViewProps {
  vendor: VendorProfile;
  shippingZones: ShippingZoneItem[];
  discounts: DiscountItem[];
  initialTab?: "setup" | "conversations" | "detail" | "general";
  onUpdateSettings: (settings: {
    copilotMode?: "COPILOT" | "FULL_AUTO" | "MANUAL";
    copilotIdleSeconds?: number;
    reservationTtlMinutes?: number;
  }) => Promise<boolean>;
  onAddShippingZone: (name: string, feeNaira: number) => Promise<boolean>;
  onDeleteShippingZone: (code: number) => Promise<boolean>;
  onAddDiscount: (code: string, type: "PERCENTAGE" | "FLAT_KOBO", value: number) => Promise<boolean>;
  onDeleteDiscount: (code: string) => Promise<boolean>;
  onNavigateToOrder?: (orderCode: string) => void;
}

interface MessageItem {
  id: string;
  sender: string;
  type: "buyer" | "copilot" | "system" | "handoff" | "merchant";
  time: string;
  text: string;
}

const INITIAL_MESSAGES: MessageItem[] = [
  { id: "m1", sender: "Oluchi", type: "buyer", time: "10:14", text: "Hi, can I buy two 750ml stainless flasks for pickup?" },
  { id: "m2", sender: "Sales co-pilot · Automated", type: "copilot", time: "10:14", text: "Hello! I'm Nia Stores' automated assistant. I'll check live stock and the current price for you." },
  { id: "m3", sender: "Live inventory check", type: "system", time: "10:15", text: "Aroko Wholesale · AW-FL750 · 44 available before sale. Requested: 2 units. Price: ₦10,000 each. Stock checked successfully." },
  { id: "m4", sender: "Sales co-pilot · Automated", type: "copilot", time: "10:15", text: "Two flasks are available for ₦20,000 total, with pickup selected. Pay securely: pay.caterlog.example/CT-1042. Stock will be rechecked before payment." },
  { id: "m5", sender: "Oluchi", type: "buyer", time: "10:17", text: "I've made the transfer. I can send you a screenshot." },
  { id: "m6", sender: "Sales co-pilot · Automated", type: "copilot", time: "10:17", text: "Thank you. A screenshot can't confirm payment. I'll wait for the payment provider's secure confirmation." },
  { id: "m7", sender: "Payment verified · Server event", type: "system", time: "10:18", text: "GW-1042 · ₦20,000 NGN confirmed by signed gateway event. Order CT-1042 paid. 2 units deducted; 42 remain in shared stock." },
  { id: "m8", sender: "Sales co-pilot · Automated", type: "copilot", time: "10:18", text: "Payment confirmed. Your order CT-1042 is with Aroko Wholesale for preparation. We'll update you when pickup is confirmed." },
  { id: "m9", sender: "Supplier fulfillment update", type: "system", time: "10:24", text: "Aroko marked the order Preparing. Pickup is not confirmed yet. No dispatch or delivery time is set." },
  { id: "m10", sender: "Oluchi · Unresolved request", type: "buyer", time: "10:26", text: "Actually, can you deliver it to Lekki before 4pm today?" },
  { id: "m11", sender: "Sales co-pilot · Handoff", type: "handoff", time: "10:26", text: "I can't confirm that delivery time. I've asked Nia to help with your request. Your paid order is still being prepared." },
];

export function SettingsView({
  vendor,
  shippingZones,
  discounts,
  initialTab = "setup",
  onUpdateSettings,
  onAddShippingZone,
  onDeleteShippingZone,
  onAddDiscount,
  onDeleteDiscount,
  onNavigateToOrder,
}: SettingsViewProps) {
  // Tabs: 'setup' | 'conversations' | 'detail' | 'general'
  const [activeTab, setActiveTab] = useState<"setup" | "conversations" | "detail" | "general">(initialTab);

  // Setup form states
  const [copilotEnabled, setCopilotEnabled] = useState(true);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [showIgModal, setShowIgModal] = useState(false);
  const [startReplyingAfter, setStartReplyingAfter] = useState("15 minutes without merchant reply");
  const [timezone, setTimezone] = useState("Africa/Lagos · WAT");
  const [awayNow, setAwayNow] = useState(true);
  const [useAwayHours, setUseAwayHours] = useState(true);
  const [stopWhenIReply, setStopWhenIReply] = useState(true);
  const [requireLiveInventory, setRequireLiveInventory] = useState(true);
  const [usePriceFrom, setUsePriceFrom] = useState("Published reseller price");
  const [maxDiscount, setMaxDiscount] = useState("0% · No discounts");
  const [minSellingPrice, setMinSellingPrice] = useState("10000");
  const [promiseDeliveryDate, setPromiseDeliveryDate] = useState(false);
  const [primaryContact, setPrimaryContact] = useState("Nia · Shop owner");
  const [notifyPhone, setNotifyPhone] = useState("+234 800 000 0142");
  const [backupEmail, setBackupEmail] = useState("owner@nia.example");
  const [savedNotice, setSavedNotice] = useState(false);

  // Conversations filters
  const [searchConv, setSearchConv] = useState("");
  const [channelFilter, setChannelFilter] = useState("All channels");
  const [stateFilter, setStateFilter] = useState("All states");
  const [outcomeFilter, setOutcomeFilter] = useState("All outcomes");
  const [sessionModalContent, setSessionModalContent] = useState<{ title: string; body: string } | null>(null);

  // Conversation detail reply state
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [merchantReplyText, setMerchantReplyText] = useState("");
  const [threadTakenOver, setThreadTakenOver] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // General settings legacy state
  const [copilotMode, setCopilotMode] = useState(vendor.copilotMode);
  const [idleSeconds, setIdleSeconds] = useState(vendor.copilotIdleSeconds);
  const [holdMinutes, setHoldMinutes] = useState(vendor.reservationTtlMinutes);
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSetup = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleSaveGeneral = async () => {
    setSavingSettings(true);
    try {
      await onUpdateSettings({
        copilotMode,
        copilotIdleSeconds: Number(idleSeconds),
        reservationTtlMinutes: Number(holdMinutes),
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantReplyText.trim()) return;
    const newMsg: MessageItem = {
      id: `m-${Date.now()}`,
      sender: "Nia · Shop owner",
      type: "merchant",
      time: "Just now",
      text: merchantReplyText.trim(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setMerchantReplyText("");
    setThreadTakenOver(true);
    setReplySuccess(true);
    setTimeout(() => setReplySuccess(false), 3000);
  };

  /* -------------------------------------------------------------------------- */
  /* Screen 3: Settings · Sales co-pilot conversation detail                     */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "detail") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("conversations")}
                className="hover:text-emerald-700 underline"
              >
                ← Back to conversations
              </button>
              <span>/</span>
              <span>WA-0882</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Oluchi Adeyemi</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              WhatsApp · WA-0882 · Linked order CT-1042
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Sale: Paid
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Request: Needs you
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  threadTakenOver
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {threadTakenOver ? "You are active (Co-pilot paused)" : "Automation paused"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-center">
            <button
              onClick={() => setThreadTakenOver(!threadTakenOver)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                threadTakenOver
                  ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                  : "bg-[#0d5c3a] text-white hover:bg-[#0b4b2f]"
              }`}
            >
              {threadTakenOver ? "✓ Thread Active (Human Replying)" : "Take over conversation"}
            </button>
          </div>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: WhatsApp Conversation Thread */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">WhatsApp conversation</h3>
                  <p className="text-[11px] text-gray-400">3 Nov 2026 · All times WAT · Replies sync to the native thread</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  WA
                </span>
              </div>

              {/* Message List */}
              <div className="space-y-3.5 text-xs">
                {messages.map((m) => {
                  if (m.type === "system") {
                    const isPayment = m.sender.includes("Payment");
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl p-3 text-[11px] border ${
                          isPayment
                            ? "bg-[#ecfdf5] border-emerald-200 text-emerald-950"
                            : "bg-[#f0f4ff] border-blue-100 text-blue-900"
                        }`}
                      >
                        <div
                          className={`flex justify-between items-center font-semibold mb-0.5 ${
                            isPayment ? "text-emerald-800" : "text-blue-700"
                          }`}
                        >
                          <span>{m.sender}</span>
                          <span>{m.time}</span>
                        </div>
                        <p>{m.text}</p>
                      </div>
                    );
                  }

                  if (m.type === "buyer") {
                    const isUnresolved = m.sender.includes("Unresolved");
                    return (
                      <div
                        key={m.id}
                        className={`border rounded-xl p-3 max-w-[85%] ${
                          isUnresolved
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        <div
                          className={`flex justify-between items-center text-[11px] mb-1 ${
                            isUnresolved ? "text-amber-800 font-semibold" : "text-gray-400"
                          }`}
                        >
                          <span className="font-semibold text-gray-900">{m.sender}</span>
                          <span>{m.time}</span>
                        </div>
                        <p className={isUnresolved ? "text-gray-900 font-medium" : "text-gray-800"}>
                          {m.text}
                        </p>
                      </div>
                    );
                  }

                  if (m.type === "merchant") {
                    return (
                      <div
                        key={m.id}
                        className="ml-auto bg-[#0d5c3a] text-white border border-[#0d5c3a] rounded-xl p-3 max-w-[85%]"
                      >
                        <div className="flex justify-between items-center text-[11px] text-emerald-100 mb-1">
                          <span className="font-semibold">{m.sender}</span>
                          <span>{m.time}</span>
                        </div>
                        <p className="text-white">{m.text}</p>
                      </div>
                    );
                  }

                  // Copilot or handoff
                  return (
                    <div
                      key={m.id}
                      className="ml-auto bg-emerald-50 border border-emerald-100 rounded-xl p-3 max-w-[85%]"
                    >
                      <div className="flex justify-between items-center text-[11px] text-emerald-700 mb-1">
                        <span className="font-semibold">{m.sender}</span>
                        <span>{m.time}</span>
                      </div>
                      <p className="text-gray-800">{m.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Actions & Order Context */}
          <div className="space-y-4">
            {/* Merchant handoff card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900">Merchant handoff</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    threadTakenOver ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {threadTakenOver ? "Active Handled" : "Open"}
                </span>
              </div>

              {!threadTakenOver ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>Delivery promise requires you</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Customer changed from pickup to delivery and asked for a guaranteed time. Co-pilot cannot agree to this request.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>You are handling this customer thread</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Automation is paused. You can respond directly in the box below.
                  </p>
                </div>
              )}

              <div className="text-xs divide-y divide-gray-100 pt-1">
                <div className="py-2 flex justify-between text-gray-600">
                  <span>Automation</span>
                  <span className="font-semibold text-gray-900">
                    {threadTakenOver ? "Paused by Nia" : "Paused for this thread"}
                  </span>
                </div>
                <div className="py-2 flex justify-between text-gray-600">
                  <span>Assigned to</span>
                  <span className="font-semibold text-gray-900">Nia · Shop owner</span>
                </div>
                <div className="py-2 flex justify-between text-gray-600">
                  <span>Notification</span>
                  <span className="font-semibold text-gray-900">Sent at 10:26 WAT</span>
                </div>
              </div>

              <button
                onClick={() => setThreadTakenOver(true)}
                className={`w-full py-2 text-white text-xs font-semibold rounded-lg transition-colors ${
                  threadTakenOver ? "bg-emerald-700 hover:bg-emerald-800" : "bg-[#0d5c3a] hover:bg-[#0b4b2f]"
                }`}
              >
                {threadTakenOver ? "Thread Taken Over" : "Take over conversation"}
              </button>
            </div>

            {/* Order Context card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Order context</h3>
              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Order</span>
                  <span className="font-semibold text-gray-900">CT-1042</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Customer paid</span>
                  <span className="font-semibold text-gray-900">₦20,000</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Supplier cost</span>
                  <span className="font-semibold text-gray-900">₦16,000</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Net rep earnings</span>
                  <span className="font-semibold text-emerald-700 font-bold">₦3,700</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Fulfillment</span>
                  <span className="font-semibold text-amber-700">Preparing for pickup</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onNavigateToOrder) onNavigateToOrder("CT-1042");
                }}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
              >
                Open order →
              </button>
            </div>

            {/* Reply as Nia */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-gray-900">Reply as Nia</h3>
              <form onSubmit={handleSendReply} className="space-y-3">
                <textarea
                  value={merchantReplyText}
                  onChange={(e) => setMerchantReplyText(e.target.value)}
                  placeholder="Take over to write a reply..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 resize-none"
                />
                {replySuccess && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded">
                    ✓ Reply sent to Oluchi on WhatsApp thread.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!merchantReplyText.trim()}
                  className="w-full py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Send reply
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 2: Settings · Sales co-pilot conversations                          */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "conversations") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Co-pilot conversations</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Review automated selling sessions, paid outcomes and merchant handoffs.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("setup")}
            className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors self-start sm:self-center"
          >
            Edit setup
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("setup")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Setup
          </button>
          <button
            onClick={() => setActiveTab("conversations")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Conversations
          </button>
          <button
            onClick={() => {
              setStateFilter("Needs you");
              setActiveTab("conversations");
            }}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Escalations (1)
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 ml-auto"
          >
            Shop &amp; Webhooks
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-emerald-100 font-medium">Co-pilot sessions</div>
            <div className="text-3xl font-extrabold mt-1">4</div>
            <div className="text-[11px] text-emerald-200 mt-2">Today · 3 WhatsApp, 1 Instagram</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Confirmed sales</div>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">₦20,000</div>
            <div className="text-[11px] text-gray-400 mt-2">1 paid order · Gateway verified</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Needs your attention</div>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">1</div>
            <div className="text-[11px] text-amber-700 mt-2">Delivery request · Take over</div>
          </div>
        </div>

        {/* Alert Banner */}
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-amber-700 font-bold text-sm">⚠</span>
            <div className="text-amber-900">
              <span className="font-bold">Handoff needed · Oluchi Adeyemi</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Order CT-1042 is paid. A new request for same-day delivery is outside your guardrails. Automation is paused for that request; open the conversation to respond.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("detail")}
            className="px-3.5 py-1.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shrink-0"
          >
            Open WA-0882 →
          </button>
        </div>

        {/* Session Inbox Table Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Session inbox</h3>
            <p className="text-xs text-gray-400 mt-0.5">Session outcomes and automation states are tracked independently</p>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <input
                type="text"
                placeholder="Search customer, order or thread"
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option>All channels</option>
                <option>WhatsApp</option>
                <option>Instagram</option>
              </select>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option>All states</option>
                <option>Needs you</option>
                <option>Automated</option>
                <option>Handed over</option>
              </select>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
              >
                <option>All outcomes</option>
                <option>Paid</option>
                <option>Not paid</option>
                <option>No sale</option>
                <option>Enquiry only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Customer / Thread</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Sale Outcome</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {/* Row 1: Oluchi Adeyemi */}
                <tr className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Oluchi Adeyemi</div>
                    <div className="text-[11px] text-gray-400">WA-0882</div>
                  </td>
                  <td className="px-4 py-3.5">WhatsApp</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Needs you
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">Paid · CT-1042</div>
                    <div className="text-[11px] text-gray-500">₦20,000</div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">10:26 WAT</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setActiveTab("detail")}
                      className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Open thread →
                    </button>
                  </td>
                </tr>

                {/* Row 2: Tunde Bello */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Tunde Bello</div>
                    <div className="text-[11px] text-gray-400">WA-0884</div>
                  </td>
                  <td className="px-4 py-3.5">WhatsApp</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Automated
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">Payment link sent</div>
                    <div className="text-[11px] text-gray-500">Not paid</div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">10:21 WAT</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() =>
                        setSessionModalContent({
                          title: "Tunde Bello (WA-0884)",
                          body: "Session Log: Customer inquired about Stainless flask 750ml. Co-pilot generated dynamic NUBAN checkout link. Payment pending.",
                        })
                      }
                      className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs rounded-lg"
                    >
                      Review
                    </button>
                  </td>
                </tr>

                {/* Row 3: Ada Okafor */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Ada Okafor</div>
                    <div className="text-[11px] text-gray-400">IG-0241</div>
                  </td>
                  <td className="px-4 py-3.5">Instagram</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                      Handed over
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">No sale</div>
                    <div className="text-[11px] text-gray-500">Connection lost</div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">09:58 WAT</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() =>
                        setSessionModalContent({
                          title: "Ada Okafor (IG-0241)",
                          body: "Session Log: Inquired via Instagram DM. Co-pilot sent product catalog. Instagram channel connection expired at 09:58 WAT.",
                        })
                      }
                      className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs rounded-lg"
                    >
                      Review
                    </button>
                  </td>
                </tr>

                {/* Row 4: Zainab Musa */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">Zainab Musa</div>
                    <div className="text-[11px] text-gray-400">WA-0879</div>
                  </td>
                  <td className="px-4 py-3.5">WhatsApp</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                      Handed over
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">Enquiry only</div>
                    <div className="text-[11px] text-gray-500">Merchant replied</div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">09:42 WAT</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() =>
                        setSessionModalContent({
                          title: "Zainab Musa (WA-0879)",
                          body: "Session Log: Customer asked about bulk wholesale discounts. Nia replied manually: 'We offer wholesale discounts for orders above 20 units!'",
                        })
                      }
                      className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs rounded-lg"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400">
            Showing 4 of 4 sessions · Customer messages remain in their native channel threads.
          </div>
        </div>

        {/* Bottom Cards: When co-pilot stops & Channel health */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="sm:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-900">When co-pilot stops</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Taking over a thread pauses all automated replies in that conversation. Unresolved requests remain visible until you resolve them; the sale outcome stays paid if an order was already confirmed.
            </p>
            <button
              onClick={() => setStateFilter("Needs you")}
              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              View escalation queue →
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-900">Channel health</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">WhatsApp</span>
                <span className="text-emerald-700 font-semibold">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Instagram</span>
                <span className={`font-semibold ${instagramConnected ? "text-emerald-700" : "text-amber-700"}`}>
                  {instagramConnected ? "Connected · Enabled" : "Reconnect required"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("setup")}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium pt-2 block"
            >
              Settings → Sales co-pilot → Setup ↗
            </button>
          </div>
        </div>

        {/* Session Review Modal */}
        {sessionModalContent && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm">{sessionModalContent.title}</h3>
                <button onClick={() => setSessionModalContent(null)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl">
                {sessionModalContent.body}
              </p>
              <button
                onClick={() => setSessionModalContent(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 1: Settings · Sales co-pilot setup                                  */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "setup") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sales co-pilot</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Sell from live inventory when you&apos;re away, with clear limits and a human handoff.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("detail")}
            className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium self-start sm:self-center"
          >
            Preview conversation
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("setup")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Setup
          </button>
          <button
            onClick={() => setActiveTab("conversations")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Conversations
          </button>
          <button
            onClick={() => {
              setStateFilter("Needs you");
              setActiveTab("conversations");
            }}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Escalations (1)
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className="pb-2.5 text-gray-500 hover:text-gray-900 ml-auto"
          >
            Shop &amp; Webhooks
          </button>
        </div>

        {/* Section 1: Automation & connected channels */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Automation &amp; connected channels</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Enabled
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-xs font-semibold text-gray-900">Enable Sales co-pilot</div>
              <p className="text-[11px] text-gray-500">Only replies on selected channels when the away rule is met.</p>
            </div>
            <button
              onClick={() => setCopilotEnabled(!copilotEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                copilotEnabled ? "bg-[#0d5c3a]" : "bg-gray-200"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  copilotEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* WhatsApp */}
            <div className="bg-[#f0fdf4] border border-emerald-100 rounded-xl p-4">
              <div className="text-xs font-bold text-gray-900">WhatsApp · +234 800 000 0142</div>
              <div className="mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200/60 text-emerald-800">
                  Connected · Enabled
                </span>
              </div>
            </div>

            {/* Instagram */}
            <div className="bg-[#fef2f2] border border-rose-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-900">Instagram · Nia Stores</div>
                <div className="mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      instagramConnected ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {instagramConnected ? "Connected · Enabled" : "Connection expired"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowIgModal(true)}
                className="px-3 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-xs font-medium rounded-lg text-gray-700 shadow-xs"
              >
                {instagramConnected ? "Reconnected" : "Reconnect"}
              </button>
            </div>
          </div>
        </div>

        {/* 2 Columns: Away Rules & Escalation Contacts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Away & inactivity rules */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Away &amp; inactivity rules</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Start replying after
                  </label>
                  <select
                    value={startReplyingAfter}
                    onChange={(e) => setStartReplyingAfter(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>15 minutes without merchant reply</option>
                    <option>5 minutes without merchant reply</option>
                    <option>30 minutes without merchant reply</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>Africa/Lagos · WAT</option>
                    <option>Africa/Accra · GMT</option>
                    <option>Africa/Nairobi · EAT</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">I&apos;m away now</div>
                    <div className="text-[11px] text-gray-400">Manually away since 09:30 WAT. Co-pilot can reply immediately.</div>
                  </div>
                  <button
                    onClick={() => setAwayNow(!awayNow)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      awayNow ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        awayNow ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Use away hours</div>
                    <div className="text-[11px] text-gray-400">18:00–08:00, every day. Activates during set away hours.</div>
                  </div>
                  <button
                    onClick={() => setUseAwayHours(!useAwayHours)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      useAwayHours ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        useAwayHours ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Stop when I reply</div>
                    <div className="text-[11px] text-gray-400">Pause automation for the thread as soon as you take over.</div>
                  </div>
                  <button
                    onClick={() => setStopWhenIReply(!stopWhenIReply)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      stopWhenIReply ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        stopWhenIReply ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 pt-1">
                Rule: manual away, scheduled hours OR inactivity. One automated session per conversation.
              </p>
            </div>

            {/* Stock, pricing & delivery guardrails */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Stock, pricing &amp; delivery guardrails</h3>

              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Require live inventory</div>
                  <p className="text-[11px] text-gray-400">Always on. Block checkout when stock is unavailable or sync fails.</p>
                </div>
                <button
                  onClick={() => setRequireLiveInventory(!requireLiveInventory)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    requireLiveInventory ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      requireLiveInventory ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Use price from</label>
                  <select
                    value={usePriceFrom}
                    onChange={(e) => setUsePriceFrom(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>Published reseller price</option>
                    <option>Fixed markup catalog</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Maximum discount</label>
                  <select
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>0% · No discounts</option>
                    <option>5% · Discretionary</option>
                    <option>10% · Maximum limit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Minimum selling price · featured flask
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-gray-500">₦</span>
                  <input
                    type="number"
                    value={minSellingPrice}
                    onChange={(e) => setMinSellingPrice(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">₦10,000 · Your configured price</p>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Promise a delivery date automatically</div>
                  <p className="text-[11px] text-gray-400">Off. Escalate delivery dates, courier fees and custom requests.</p>
                </div>
                <button
                  onClick={() => setPromiseDeliveryDate(!promiseDeliveryDate)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    promiseDeliveryDate ? "bg-[#0d5c3a]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      promiseDeliveryDate ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-gray-400 pt-1">
                Never negotiate below supplier cost. Payment is confirmed only by verified gateway events, not customer screenshots.
              </p>
            </div>
          </div>

          {/* Right Column (1 Col) */}
          <div className="space-y-6">
            {/* Escalation contacts */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Escalation contacts</h3>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Primary contact</label>
                <input
                  type="text"
                  value={primaryContact}
                  onChange={(e) => setPrimaryContact(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Notify on WhatsApp</label>
                <input
                  type="text"
                  value={notifyPhone}
                  onChange={(e) => setNotifyPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Backup email</label>
                <input
                  type="email"
                  value={backupEmail}
                  onChange={(e) => setBackupEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <p className="text-[11px] text-gray-400">
                Escalate stock uncertainty, requested delivery guarantees, discounts outside limits, refund requests and payment mismatches.
              </p>
            </div>

            {/* Customer preview */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Customer preview</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                WhatsApp · Away response
              </span>

              <div className="bg-[#ecfdf5] border border-emerald-100 rounded-xl p-3.5 text-xs text-gray-800 leading-relaxed">
                Thanks for messaging Nia Stores. I&apos;m the shop&apos;s automated assistant. I can check live availability and share a secure payment link. Nia will help with delivery arrangements.
              </div>

              <div className="divide-y divide-gray-100 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Live stock check</span>
                  <span className="font-semibold text-gray-900">Required</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Price changes</span>
                  <span className="font-semibold text-gray-900">Not allowed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instagram Reconnect Modal */}
        {showIgModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Instagram Graph Reconnect</h3>
                <button onClick={() => setShowIgModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Authorize Caterlog to read messages and send live inventory responses on behalf of @niastores.
              </p>
              <button
                onClick={() => {
                  setInstagramConnected(true);
                  setShowIgModal(false);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-xs rounded-xl shadow-xs"
              >
                Authenticate with Instagram
              </button>
            </div>
          </div>
        )}

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 py-3 px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-end gap-3 z-30 shadow-lg">
          {savedNotice && (
            <span className="text-xs font-semibold text-emerald-700 mr-auto">
              ✓ Co-pilot settings saved successfully
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("conversations")}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Discard changes
            </button>
            <button
              onClick={handleSaveSetup}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0d5c3a] hover:bg-[#0b4b2f] rounded-lg transition-colors shadow-xs"
            >
              Save co-pilot settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* General Shop & Webhook Settings                                            */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shop Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your shop profile, WhatsApp Coexistence, delivery zones, and Monnify webhooks.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("setup")}
          className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors self-start sm:self-center"
        >
          Open Sales co-pilot →
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
        <button
          onClick={() => setActiveTab("setup")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Sales co-pilot
        </button>
        <button
          onClick={() => setActiveTab("conversations")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Conversations
        </button>
        <button
          onClick={() => setActiveTab("general")}
          className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold ml-auto"
        >
          Shop &amp; Webhooks
        </button>
      </div>

      {/* General Settings form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="text-sm font-bold text-gray-900">
          WhatsApp Coexistence Mode
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="p-4 border rounded-xl cursor-pointer hover:border-emerald-500 flex flex-col justify-between">
            <div>
              <input
                type="radio"
                name="copilotMode"
                value="COPILOT"
                checked={copilotMode === "COPILOT"}
                onChange={() => setCopilotMode("COPILOT")}
                className="text-emerald-600 mr-2"
              />
              <span className="font-bold text-sm text-gray-900">Smart Co-pilot</span>
              <p className="text-xs text-gray-500 mt-2">
                Automated assistant answers when vendor is idle; steps down immediately when human vendor replies.
              </p>
            </div>
          </label>

          <label className="p-4 border rounded-xl cursor-pointer hover:border-emerald-500 flex flex-col justify-between">
            <div>
              <input
                type="radio"
                name="copilotMode"
                value="MANUAL"
                checked={copilotMode === "MANUAL"}
                onChange={() => setCopilotMode("MANUAL")}
                className="text-emerald-600 mr-2"
              />
              <span className="font-bold text-sm text-gray-900">Manual Only</span>
              <p className="text-xs text-gray-500 mt-2">
                Co-pilot is completely disabled. Only human vendor answers customer WhatsApp inquiries.
              </p>
            </div>
          </label>

          <label className="p-4 border rounded-xl cursor-pointer hover:border-emerald-500 flex flex-col justify-between">
            <div>
              <input
                type="radio"
                name="copilotMode"
                value="FULL_AUTO"
                checked={copilotMode === "FULL_AUTO"}
                onChange={() => setCopilotMode("FULL_AUTO")}
                className="text-emerald-600 mr-2"
              />
              <span className="font-bold text-sm text-gray-900">Full Auto</span>
              <p className="text-xs text-gray-500 mt-2">
                Co-pilot always responds instantly without waiting for idle timeout period.
              </p>
            </div>
          </label>
        </div>

        <button
          onClick={handleSaveGeneral}
          disabled={savingSettings}
          className="px-5 py-2.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          {savingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
