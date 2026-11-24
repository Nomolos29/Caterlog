"use client";

import React, { useState, useRef, useEffect } from "react";
import type { BuyerSession, ChatMessage, Order, Product, Vendor } from "@/lib/types";
import {
  CloseIcon,
  WhatsAppBadgeIcon,
  InstagramBadgeIcon,
  FacebookMessengerBadgeIcon,
} from "./icons";
import { resolveImageUrl } from "@/lib/api";

export interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  orders?: Order[];
  products?: Product[];
  vendor?: Vendor;
  activeBuyerSession?: BuyerSession | null;
  onSendVendorKeyword: (text: string, attachedImage?: string) => Promise<void>;
  onSendBuyerInquiry: (
    text: string,
    phash?: string,
    buyerPhone?: string,
    buyerName?: string,
    attachedImageUrl?: string,
    sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK"
  ) => Promise<void>;
  onSendVendorManualEcho: (text: string, buyerPhone?: string) => Promise<void>;
  onSimulateTransfer?: (orderCode: string, amountNaira: number) => Promise<void>;
  onNavigateToAnalytics?: () => void;
  onNavigateToOrders?: () => void;
}

const BUYER_PRESETS = [
  {
    name: "Chidinma Okafor",
    phone: "+2348099887766",
    instagramHandle: "@chidinma_style",
    facebookName: "Chidinma Okafor (Facebook)",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
  },
  {
    name: "Babatunde Adebayo",
    phone: "+2348123456789",
    instagramHandle: "@babatunde_fits",
    facebookName: "Babatunde Adebayo (Facebook)",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
  },
];

export function ChatDrawer({
  isOpen,
  onClose,
  chatMessages,
  orders = [],
  products = [],
  vendor,
  activeBuyerSession,
  onSendVendorKeyword,
  onSendBuyerInquiry: rawOnSendBuyerInquiry,
  onSendVendorManualEcho,
  onSimulateTransfer,
  onNavigateToAnalytics,
  onNavigateToOrders,
}: ChatDrawerProps) {
  // Mode: Customer Shopping Mode vs Store Owner Admin Mode
  const [activeChannel, setActiveChannel] = useState<"BUYER_SHOP_WA" | "VENDOR_ADMIN_WA">("BUYER_SHOP_WA");
  // Social Channel: WhatsApp, Instagram, or Facebook
  const [activeSocialChannel, setActiveSocialChannel] = useState<"WHATSAPP" | "INSTAGRAM" | "FACEBOOK">("WHATSAPP");
  // Frame Mode: Side Drawer vs Smartphone Device Mockup
  const [frameMode, setFrameMode] = useState<"drawer" | "phone">("drawer");
  // Thread Filter: Active channel only vs All omnichannel messages
  const [threadFilter, setThreadFilter] = useState<"ACTIVE_CHANNEL" | "ALL_CHANNELS">("ACTIVE_CHANNEL");

  const [senderRole, setSenderRole] = useState<"CUSTOMER" | "VENDOR_ASSIST">("CUSTOMER");
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Phone & Identity simulator state for customer mode
  const [selectedBuyerIndex, setSelectedBuyerIndex] = useState(0); // 0 = Chidinma, 1 = Babatunde, 2 = Custom
  const [customPhone, setCustomPhone] = useState("+2348011223344");
  const [customName, setCustomName] = useState("Amina Bello");
  const [customIgHandle, setCustomIgHandle] = useState("@amina_shopper");

  const currentBuyerPhone =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].phone
      : customPhone;

  const currentBuyerName =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].name
      : customName;

  const currentBuyerHandle =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].instagramHandle
      : customIgHandle;

  const currentBuyerFb =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].facebookName
      : `${customName} (Facebook)`;

  const currentAvatar =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].avatar
      : "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80";

  // Filter messages based on active channel and social filter
  const filteredMessages = chatMessages.filter((m) => {
    if (m.channel !== activeChannel) return false;
    if (activeChannel === "VENDOR_ADMIN_WA") return true;
    if (threadFilter === "ALL_CHANNELS") return true;
    // Active channel only
    return (m.sourceChannel ?? "WHATSAPP") === activeSocialChannel;
  });

  // Auto-scroll chat smoothly to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredMessages.length, isOpen, activeSocialChannel, activeChannel]);

  // Check if there is an order awaiting payment
  const pendingPaymentOrder =
    orders.find((o) => o.status === "PENDING_PAYMENT" && o.customerPhone === currentBuyerPhone) ||
    orders.find((o) => o.status === "PENDING_PAYMENT");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setAttachedImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachedImage.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      if (activeChannel === "VENDOR_ADMIN_WA") {
        await onSendVendorKeyword(inputText.trim(), attachedImage.trim() || undefined);
      } else if (senderRole === "VENDOR_ASSIST") {
        await onSendVendorManualEcho(inputText.trim(), currentBuyerPhone);
      } else {
        const effectiveBuyerName =
          activeSocialChannel === "INSTAGRAM"
            ? currentBuyerHandle
            : activeSocialChannel === "FACEBOOK"
            ? currentBuyerFb
            : currentBuyerName;

        await rawOnSendBuyerInquiry(
          inputText.trim(),
          undefined,
          currentBuyerPhone,
          effectiveBuyerName,
          attachedImage.trim() || undefined,
          activeSocialChannel
        );
      }
      setInputText("");
      setAttachedImage("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send message. Check API connection.");
    } finally {
      setSending(false);
    }
  };

  const sendQuickMessage = async (msg: string) => {
    setSending(true);
    setSendError(null);
    try {
      if (activeChannel === "VENDOR_ADMIN_WA") {
        await onSendVendorKeyword(msg);
      } else {
        const effectiveBuyerName =
          activeSocialChannel === "INSTAGRAM"
            ? currentBuyerHandle
            : activeSocialChannel === "FACEBOOK"
            ? currentBuyerFb
            : currentBuyerName;

        await rawOnSendBuyerInquiry(
          msg,
          undefined,
          currentBuyerPhone,
          effectiveBuyerName,
          undefined,
          activeSocialChannel
        );
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send quick message.");
    } finally {
      setSending(false);
    }
  };

  const handleSimulatePayment = async (order: Order) => {
    if (!onSimulateTransfer) return;
    setTransferring(true);
    setTransferSuccess(null);
    try {
      const amountNaira = Number(order.totalAmountKobo) / 100;
      await onSimulateTransfer(order.shortCode, amountNaira);
      setTransferSuccess(`Paid ₦${amountNaira.toLocaleString()} for ${order.shortCode} via ${order.salesChannel || activeSocialChannel}!`);
      setTimeout(() => setTransferSuccess(null), 5000);
    } finally {
      setTransferring(false);
    }
  };

  // Theming definitions based on activeSocialChannel
  const isInstagram = activeSocialChannel === "INSTAGRAM" && activeChannel === "BUYER_SHOP_WA";
  const isFacebook = activeSocialChannel === "FACEBOOK" && activeChannel === "BUYER_SHOP_WA";
  const isWhatsApp = activeSocialChannel === "WHATSAPP" || activeChannel === "VENDOR_ADMIN_WA";

  const channelTitle = isInstagram
    ? "Instagram Direct"
    : isFacebook
    ? "Facebook Messenger"
    : activeChannel === "VENDOR_ADMIN_WA"
    ? "WhatsApp Store Owner"
    : "WhatsApp Business";

  const channelBadgeClass = isInstagram
    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white"
    : isFacebook
    ? "bg-blue-600 text-white"
    : "bg-emerald-600 text-white";

  // Renders the entire simulator viewport content
  const simulatorContent = (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden bg-white">
      {/* 1. Header Toolbar */}
      <div
        className={`px-3 sm:px-4 py-2.5 sm:py-3 text-white transition-colors duration-200 shrink-0 ${
          isInstagram
            ? "bg-gradient-to-r from-[#262626] via-[#1a1a1a] to-[#000000] border-b border-gray-800"
            : isFacebook
            ? "bg-gradient-to-r from-[#0084FF] to-[#0062BD] border-b border-blue-700"
            : "bg-[#075E54] border-b border-[#054D44]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Channel Logo / Avatar */}
            <div className="relative shrink-0">
              {isInstagram ? (
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888]">
                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                    <InstagramBadgeIcon className="w-4 h-4 text-pink-400" />
                  </div>
                </div>
              ) : isFacebook ? (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <FacebookMessengerBadgeIcon className="w-5 h-5 text-white" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-800/80 flex items-center justify-center text-emerald-200">
                  <WhatsAppBadgeIcon className="w-5 h-5 text-emerald-300" />
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-gray-900" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-bold text-xs truncate">
                  {activeChannel === "VENDOR_ADMIN_WA"
                    ? `${vendor?.businessName || "Caterlog"} (Owner Admin)`
                    : isInstagram
                    ? `@${(vendor?.businessName || "caterlog_store").toLowerCase().replace(/\s+/g, "_")}`
                    : isFacebook
                    ? `${vendor?.businessName || "Caterlog"} Store Page`
                    : `${vendor?.businessName || "Caterlog"} WhatsApp Co-Pilot`}
                </span>
                <span className="text-[10px] text-emerald-300">✓</span>
              </div>
              <div className="text-[10px] opacity-80 truncate flex items-center gap-1">
                <span>{channelTitle}</span>
                <span>·</span>
                <span className="text-emerald-300 font-medium">Co-Pilot Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Device / Frame Mode Toggle */}
            <button
              onClick={() => setFrameMode((m) => (m === "drawer" ? "phone" : "drawer"))}
              className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-[11px] font-semibold transition-colors cursor-pointer"
              title={frameMode === "drawer" ? "Switch to Smartphone Device Frame" : "Switch to Slide-over Drawer"}
            >
              <span className="sm:hidden">{frameMode === "drawer" ? "📱" : "📑"}</span>
              <span className="hidden sm:inline">{frameMode === "drawer" ? "📱 Phone Frame" : "📑 Drawer"}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 transition-colors cursor-pointer"
              title="Close simulator"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Controls & Channel Switcher */}
      <div className="bg-gray-50 border-b border-gray-200/80 px-3 py-2 space-y-2 shrink-0">
        {/* Mode Selector: Customer vs Store Owner */}
        <div className="flex items-center gap-1.5 bg-gray-200/60 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveChannel("BUYER_SHOP_WA")}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeChannel === "BUYER_SHOP_WA"
                ? "bg-white text-gray-900 shadow-2xs font-bold"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>🛍️</span>
            <span>Customer Shopper</span>
          </button>
          <button
            onClick={() => setActiveChannel("VENDOR_ADMIN_WA")}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
              activeChannel === "VENDOR_ADMIN_WA"
                ? "bg-white text-emerald-900 shadow-2xs font-bold"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>👑</span>
            <span>Store Owner Admin</span>
          </button>
        </div>

        {/* Customer Channel Tabs (WhatsApp | Instagram | Facebook) */}
        {activeChannel === "BUYER_SHOP_WA" && (
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <div className="flex items-center gap-1 w-full">
              <button
                onClick={() => setActiveSocialChannel("WHATSAPP")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  activeSocialChannel === "WHATSAPP"
                    ? "bg-[#075E54] text-white border-[#075E54] shadow-2xs"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <WhatsAppBadgeIcon className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setActiveSocialChannel("INSTAGRAM")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  activeSocialChannel === "INSTAGRAM"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-500 shadow-2xs"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <InstagramBadgeIcon className="w-3.5 h-3.5" />
                <span>Instagram</span>
              </button>

              <button
                onClick={() => setActiveSocialChannel("FACEBOOK")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  activeSocialChannel === "FACEBOOK"
                    ? "bg-[#0084FF] text-white border-[#0084FF] shadow-2xs"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <FacebookMessengerBadgeIcon className="w-3.5 h-3.5" />
                <span>Facebook</span>
              </button>
            </div>
          </div>
        )}

        {/* Identity & Persona Bar */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-xs">
          {activeChannel === "BUYER_SHOP_WA" ? (
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentAvatar}
                    alt={currentBuyerName}
                    className="w-5 h-5 rounded-full object-cover border border-gray-300"
                  />
                  <span className="font-semibold text-gray-800 text-[11px] truncate">
                    {activeSocialChannel === "INSTAGRAM"
                      ? currentBuyerHandle
                      : activeSocialChannel === "FACEBOOK"
                      ? currentBuyerFb
                      : `${currentBuyerName} (${currentBuyerPhone})`}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-gray-500">Filter:</span>
                  <button
                    onClick={() =>
                      setThreadFilter((f) =>
                        f === "ACTIVE_CHANNEL" ? "ALL_CHANNELS" : "ACTIVE_CHANNEL"
                      )
                    }
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer"
                  >
                    {threadFilter === "ACTIVE_CHANNEL" ? "Active Only" : "All Channels"}
                  </button>
                </div>
              </div>

              {/* Persona switch buttons */}
              <div className="flex items-center gap-1 text-[10px]">
                {BUYER_PRESETS.map((p, idx) => (
                  <button
                    key={p.phone}
                    onClick={() => setSelectedBuyerIndex(idx)}
                    className={`px-2 py-0.5 rounded-md border font-medium transition-colors cursor-pointer ${
                      selectedBuyerIndex === idx
                        ? channelBadgeClass
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {p.name.split(" ")[0]}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedBuyerIndex(BUYER_PRESETS.length)}
                  className={`px-2 py-0.5 rounded-md border font-medium transition-colors cursor-pointer ${
                    selectedBuyerIndex === BUYER_PRESETS.length
                      ? channelBadgeClass
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  Custom Persona
                </button>
              </div>

              {/* Custom Persona Editor */}
              {selectedBuyerIndex === BUYER_PRESETS.length && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Phone: +234..."
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-900 min-w-0"
                  />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-900 min-w-0"
                  />
                  <input
                    type="text"
                    placeholder="IG: @handle"
                    value={customIgHandle}
                    onChange={(e) => setCustomIgHandle(e.target.value)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-900 min-w-0"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-semibold text-gray-600">
                Verified Store Owner Number:
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                {vendor?.whatsappPhone || "+2348101123098"} (✓ Verified Admin)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Human Escalation / Co-Pilot Status Banner */}
      {activeChannel === "BUYER_SHOP_WA" && (
        <div className="px-3 py-1.5 bg-gray-50/70 border-b border-gray-200 text-xs shrink-0">
          {activeBuyerSession?.state === "NEEDS_ASSISTANCE" ? (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-2 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span className="truncate">Customer Requested Human Store Owner!</span>
                </div>
                <div className="text-[10px] text-amber-700 truncate">
                  &ldquo;{activeBuyerSession.assistanceInquiry || "Buyer requested assistance"}&rdquo;
                </div>
              </div>
              <button
                onClick={() => setSenderRole("VENDOR_ASSIST")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shrink-0 cursor-pointer shadow-2xs"
              >
                💬 Assist Customer
              </button>
            </div>
          ) : activeBuyerSession?.state === "ASSISTING" || activeBuyerSession?.copilotPaused ? (
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-2 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <span className="truncate">Human Owner Assisting · Co-Pilot Paused</span>
                </div>
                <div className="text-[10px] text-blue-700 truncate">
                  Live 1-on-1 human support session active
                </div>
              </div>
              <button
                onClick={() => onSendVendorManualEcho("resume", currentBuyerPhone)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shrink-0 cursor-pointer shadow-2xs"
              >
                🤖 Resume Co-Pilot
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-gray-700">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-semibold text-emerald-900">Co-Pilot Automated Sales Active</span>
              </div>
              <button
                onClick={() => setSenderRole((r) => (r === "CUSTOMER" ? "VENDOR_ASSIST" : "CUSTOMER"))}
                className="text-[10px] font-bold text-gray-600 hover:text-gray-950 underline cursor-pointer"
              >
                {senderRole === "VENDOR_ASSIST" ? "Switch to Customer" : "Step in as Owner"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Dynamic Monnify Settlement Simulator Card */}
      {pendingPaymentOrder && onSimulateTransfer && (
        <div className="p-3 bg-emerald-50 border-b border-emerald-200 space-y-1.5 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-base">⚡</span>
              <span className="font-bold text-emerald-950">
                Awaiting Payment: {pendingPaymentOrder.shortCode}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200">
                {pendingPaymentOrder.salesChannel || activeSocialChannel}
              </span>
            </div>
            <span className="font-extrabold text-emerald-900 text-sm">
              ₦{(Number(pendingPaymentOrder.totalAmountKobo) / 100).toLocaleString()}
            </span>
          </div>

          <div className="text-[11px] text-emerald-800 flex justify-between bg-white/80 p-1.5 rounded-lg border border-emerald-200/80">
            <span>Dynamic Monnify Account:</span>
            <span className="font-mono font-bold text-emerald-950">
              {pendingPaymentOrder.accountNumber} ({pendingPaymentOrder.bankName})
            </span>
          </div>

          {/* Dropship / Reseller Split preview if applicable */}
          {pendingPaymentOrder.supplierShareKobo && Number(pendingPaymentOrder.supplierShareKobo) > 0 && (
            <div className="text-[10px] text-emerald-700 flex justify-between px-1">
              <span>Split Settlement:</span>
              <span>
                Supplier: ₦{(Number(pendingPaymentOrder.supplierShareKobo) / 100).toLocaleString()} | Reseller: ₦{(Number(pendingPaymentOrder.resellerShareKobo) / 100).toLocaleString()}
              </span>
            </div>
          )}

          {transferSuccess ? (
            <div className="p-2 bg-emerald-600 text-white rounded-lg text-xs font-bold text-center animate-in zoom-in-95">
              ✓ {transferSuccess}
            </div>
          ) : (
            <button
              onClick={() => handleSimulatePayment(pendingPaymentOrder)}
              disabled={transferring}
              className="w-full bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span>💳</span>
              <span>
                {transferring
                  ? "Processing Instant Monnify Settlement..."
                  : `Simulate ₦${(Number(pendingPaymentOrder.totalAmountKobo) / 100).toLocaleString()} Transfer (Orders & Analytics Update)`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* 5. Channel-Specific Quick Action Scenarios */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex sm:flex-wrap items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
        {activeChannel === "BUYER_SHOP_WA" ? (
          <>
            {isInstagram ? (
              <>
                <button
                  onClick={() => sendQuickMessage("📸 Saw this on your IG Story! Is size 39 in stock?")}
                  className="px-2 py-1 bg-white border border-pink-200 rounded-lg text-pink-700 hover:bg-pink-50 font-medium cursor-pointer shadow-2xs"
                >
                  📸 Story Reply
                </button>
                <button
                  onClick={() => sendQuickMessage("Price for Zara Block Heel (SHOE-01)?")}
                  className="px-2 py-1 bg-white border border-pink-200 rounded-lg text-pink-700 hover:bg-pink-50 font-medium cursor-pointer shadow-2xs"
                >
                  🛍️ Product DM
                </button>
                <button
                  onClick={() => sendQuickMessage("How much is shipping to Lekki Phase 1?")}
                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium cursor-pointer shadow-2xs"
                >
                  🚚 Shipping to Lekki
                </button>
                <button
                  onClick={() => sendQuickMessage("checkout Lekki")}
                  className="px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:opacity-90 cursor-pointer shadow-2xs"
                >
                  ⚡ IG Checkout
                </button>
                <button
                  onClick={() => sendQuickMessage("track")}
                  className="px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 hover:bg-purple-100 font-medium cursor-pointer shadow-2xs"
                >
                  📍 Track Order
                </button>
              </>
            ) : isFacebook ? (
              <>
                <button
                  onClick={() => sendQuickMessage("Get Started")}
                  className="px-2 py-1 bg-[#0084FF] text-white rounded-lg font-bold hover:bg-blue-600 cursor-pointer shadow-2xs"
                >
                  🚀 Get Started
                </button>
                <button
                  onClick={() => sendQuickMessage("Show me shoes and bags in stock")}
                  className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 font-medium cursor-pointer shadow-2xs"
                >
                  🛍️ Browse Catalog
                </button>
                <button
                  onClick={() => sendQuickMessage("Order 2 SHOE-01")}
                  className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 font-medium cursor-pointer shadow-2xs"
                >
                  📦 Order 2 Units
                </button>
                <button
                  onClick={() => sendQuickMessage("checkout Abuja")}
                  className="px-2 py-1 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 font-bold hover:bg-blue-100 cursor-pointer shadow-2xs"
                >
                  ⚡ Checkout Abuja
                </button>
                <button
                  onClick={() => sendQuickMessage("track")}
                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium cursor-pointer shadow-2xs"
                >
                  📍 Track Order
                </button>
              </>
            ) : (
              <>
                {products.length > 0 ? (
                  products.slice(0, 2).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => sendQuickMessage(`I want ${p.name}`)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium shadow-2xs"
                    >
                      Buy {p.name.slice(0, 14)}...
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => sendQuickMessage("I want Zara Block Heel (SHOE-01)")}
                    className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium shadow-2xs"
                  >
                    Buy Zara Heel
                  </button>
                )}
                <button
                  onClick={() => sendQuickMessage("Order 2 SHOE-01")}
                  className="px-2 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium shadow-2xs"
                >
                  Order 2 Units
                </button>
                <button
                  onClick={() => sendQuickMessage("view cart")}
                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium shadow-2xs"
                >
                  🛒 View Cart
                </button>
                <button
                  onClick={() => sendQuickMessage("checkout Lekki")}
                  className="px-2 py-1 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 cursor-pointer shadow-2xs"
                >
                  ⚡ Checkout
                </button>
                <button
                  onClick={() => sendQuickMessage("track")}
                  className="px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 hover:bg-purple-100 font-medium cursor-pointer shadow-2xs"
                >
                  📍 Track
                </button>
                <button
                  onClick={() =>
                    sendQuickMessage("Can I talk to the store owner? I need custom sizing")
                  }
                  className="px-2 py-1 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 font-medium cursor-pointer shadow-2xs"
                >
                  🔔 Ask Store Owner
                </button>
              </>
            )}
          </>
        ) : (
          /* Store Owner Admin Keywords */
          <>
            <button
              onClick={() => sendQuickMessage("#help")}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 font-mono cursor-pointer shadow-2xs"
            >
              #help
            </button>
            <button
              onClick={() => sendQuickMessage("sales")}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 font-mono cursor-pointer shadow-2xs"
            >
              sales
            </button>
            <button
              onClick={() => sendQuickMessage("stock")}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 font-mono cursor-pointer shadow-2xs"
            >
              stock
            </button>
            <button
              onClick={() => sendQuickMessage("ship Lekki 3500")}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 font-mono cursor-pointer shadow-2xs"
            >
              ship Lekki 3500
            </button>
            <button
              onClick={() => sendQuickMessage("discount add PAYDAY 10%")}
              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-emerald-800 hover:bg-emerald-50 font-mono cursor-pointer shadow-2xs"
            >
              discount PAYDAY 10%
            </button>
            <button
              type="button"
              onClick={() => {
                setInputText("Zara Block Heel, #25000, sizes: 38 (2), 39 (3), 40 (5)");
                setAttachedImage(
                  "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80"
                );
              }}
              className="px-2 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 hover:bg-emerald-100 font-medium cursor-pointer shadow-2xs"
            >
              📸 + Shoes SKU
            </button>
          </>
        )}
      </div>

      {/* 6. Main Chat Message Viewport */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 transition-colors ${
          isInstagram
            ? "bg-[#fafafa]"
            : isFacebook
            ? "bg-[#f5f7fa]"
            : "bg-[#efeae2]"
        }`}
      >
        {filteredMessages.length === 0 ? (
          <div className="text-center py-16 text-gray-400 space-y-2">
            <div className="text-3xl">
              {isInstagram ? "📸" : isFacebook ? "🔵" : "💬"}
            </div>
            <div className="text-xs font-bold text-gray-700">
              No messages in this {channelTitle} thread yet
            </div>
            <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
              {activeChannel === "BUYER_SHOP_WA"
                ? `Send an inquiry or tap a quick chip above to test ${channelTitle} orders and dynamic Monnify settlement.`
                : "Send admin commands like #help, sales, stock, or ship Lekki 3500 to test WhatsApp store operations."}
            </p>
          </div>
        ) : (
          filteredMessages.map((m) => {
            const isVendor = m.sender === "VENDOR";
            const isBuyer = m.sender === "BUYER";
            const isBot = m.sender === "CATERLOG_BOT";
            const isRight = activeChannel === "BUYER_SHOP_WA" ? isBuyer : isVendor;

            // Channel-specific bubble styling
            let bubbleStyle = "bg-white text-gray-900 border border-gray-200 rounded-2xl";

            if (isRight) {
              if (isInstagram) {
                bubbleStyle =
                  "bg-gradient-to-tr from-[#833ab4] via-[#c13584] to-[#405de6] text-white rounded-3xl shadow-xs";
              } else if (isFacebook) {
                bubbleStyle = "bg-[#0084FF] text-white rounded-2xl shadow-xs";
              } else {
                // WhatsApp
                bubbleStyle = "bg-[#dcf8c6] text-gray-900 rounded-xl shadow-2xs border border-[#c3e6aa]";
              }
            } else {
              // Incoming message (Bot or Vendor)
              if (isInstagram) {
                bubbleStyle = "bg-gray-100 text-gray-900 border border-gray-200/60 rounded-3xl";
              } else if (isFacebook) {
                bubbleStyle = "bg-[#F0F2F5] text-gray-900 rounded-2xl";
              } else {
                bubbleStyle = "bg-white text-gray-900 border border-gray-200 rounded-xl shadow-2xs";
              }
            }

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isRight ? "items-end ml-auto" : "items-start"} max-w-[88%] sm:max-w-[85%] min-w-0`}
              >
                <div className={`p-3 text-xs leading-relaxed max-w-full min-w-0 ${bubbleStyle}`}>
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(m.imageUrl)}
                      alt="Attachment"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80";
                      }}
                      className="w-full max-h-48 object-cover rounded-xl mb-2"
                    />
                  )}

                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.text}</div>

                  {/* Interactive Quick Replies */}
                  {m.quickReplies && m.quickReplies.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-black/10 space-y-1">
                      {m.quickReplies.map((qr, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendQuickMessage(qr.replyText)}
                          className="w-full text-left bg-black/5 hover:bg-black/10 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] block transition-colors cursor-pointer whitespace-normal break-words"
                        >
                          {qr.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bubble Metadata */}
                <div className="flex items-center gap-1.5 text-[9px] text-gray-500 mt-0.5 px-1">
                  {/* Channel Tag if viewing unified thread */}
                  {threadFilter === "ALL_CHANNELS" && m.sourceChannel && (
                    <span className="font-bold uppercase tracking-wider text-[8px] px-1 py-0.2 rounded bg-gray-200 text-gray-700">
                      {m.sourceChannel}
                    </span>
                  )}

                  {isBot ? (
                    <span className="font-semibold text-emerald-700">🤖 Co-Pilot</span>
                  ) : isVendor ? (
                    <span className="font-semibold text-blue-700">👑 Store Owner</span>
                  ) : (
                    <span>
                      {isInstagram ? currentBuyerHandle : isFacebook ? currentBuyerFb : m.sender}
                    </span>
                  )}

                  <span>·</span>
                  <span>
                    {m.timestamp
                      ? new Date(m.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Just now"}
                  </span>

                  {isRight && isWhatsApp && <span className="text-blue-500 font-bold">✓✓</span>}
                </div>
              </div>
            );
          })
        )}
        {sending && (
          <div className="flex items-start max-w-[80%]">
            <div className="px-3 py-2 rounded-2xl bg-white border border-gray-200 text-xs text-gray-500 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              <span>Sales Co-Pilot is replying...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 7. Input Form & Composer */}
      <form onSubmit={handleSend} className="p-2.5 sm:p-3 bg-white border-t border-gray-200 space-y-2 shrink-0">
        {sendError && (
          <div className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 flex items-center justify-between gap-2">
            <span className="truncate">{sendError}</span>
            <button type="button" onClick={() => setSendError(null)} className="font-bold shrink-0 cursor-pointer">✕</button>
          </div>
        )}
        {/* Attached photo preview */}
        {attachedImage && (
          <div className="flex items-center gap-2 p-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachedImage}
              alt="Attachment preview"
              className="w-9 h-9 object-cover rounded-lg border border-emerald-300 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-emerald-900 truncate">
                Photo attached
              </div>
              <div className="text-[10px] text-emerald-700 truncate">{attachedImage}</div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage("")}
              className="w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-xs cursor-pointer shrink-0"
              title="Remove photo"
            >
              ✕
            </button>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
            title="Attach photo from disk"
          >
            📷
          </button>

          <input
            type="text"
            required
            placeholder={
              activeChannel === "VENDOR_ADMIN_WA"
                ? "Send command (e.g. Zara Heel, #25000, sizes: 38 (2), 39 (3))..."
                : senderRole === "VENDOR_ASSIST"
                ? `Reply as Store Owner to ${currentBuyerName}...`
                : isInstagram
                ? `Send message to @${(vendor?.businessName || "caterlog").toLowerCase().replace(/\s+/g, "_")}...`
                : isFacebook
                ? "Send a message on Messenger..."
                : `Message as ${currentBuyerName}...`
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={sending}
            className={`font-bold text-xs px-3.5 sm:px-4 py-2 rounded-xl text-white cursor-pointer active:scale-95 transition-all shrink-0 ${
              isInstagram
                ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
                : isFacebook
                ? "bg-[#0084FF] hover:bg-blue-600"
                : "bg-[#0d5c3a] hover:bg-[#0b4b2f]"
            }`}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>

        {/* Analytics Live Attribution Jump Bar */}
        {(onNavigateToAnalytics || onNavigateToOrders) && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px] text-gray-500">
            <span>💡 Live attribution synced to Dashboard</span>
            <div className="flex items-center gap-2">
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToOrders();
                    onClose();
                  }}
                  className="font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  View Orders →
                </button>
              )}
              {onNavigateToAnalytics && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToAnalytics();
                    onClose();
                  }}
                  className="font-bold text-purple-700 hover:underline cursor-pointer"
                >
                  View Analytics →
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 transition-opacity animate-in fade-in duration-150"
      />

      {frameMode === "drawer" ? (
        /* Slide-over Drawer Mode */
        <div className="fixed inset-y-0 right-0 h-[100dvh] w-full sm:max-w-md bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
          {simulatorContent}
        </div>
      ) : (
        /* Realistic Smartphone Device Mockup Mode */
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none">
          <div className="pointer-events-auto relative w-full max-w-[390px] h-[94dvh] sm:h-[780px] sm:max-h-[92vh] bg-black rounded-[32px] sm:rounded-[48px] p-2 sm:p-3 shadow-2xl ring-8 sm:ring-12 ring-gray-900/40 border border-gray-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Phone Notch / Dynamic Island */}
            <div className="hidden sm:flex absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-20 items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-950 border border-gray-800" />
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-black text-white text-[10px] font-semibold px-5 sm:px-6 flex items-center justify-between shrink-0 select-none z-10">
              <span>9:41</span>
              <div className="flex items-center gap-1.5 text-[9px]">
                <span>5G</span>
                <span>📶</span>
                <span>100% 🔋</span>
              </div>
            </div>

            {/* Viewport Frame */}
            <div className="flex-1 min-h-0 rounded-[24px] sm:rounded-[36px] overflow-hidden flex flex-col relative border border-gray-800">
              {simulatorContent}
            </div>

            {/* Home Indicator Bar */}
            <div className="h-4 flex items-center justify-center shrink-0">
              <div className="w-28 sm:w-32 h-1 bg-gray-500 rounded-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
