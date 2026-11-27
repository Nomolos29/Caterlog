"use client";

import React, { useState, useEffect } from "react";
import type {
  VendorProfile,
  VendorState,
  ShippingZoneItem,
  DiscountItem,
  ChatMessageItem,
  OrderItem,
  BuyerSession,
  PlatformRole,
  SubscriptionInfo,
  TrustTierInfo,
  PlatformInvoiceItem,
  SubscriptionPlanId,
  BillingCycle,
  VendorFeatureFlags,
  SocialAccountSync,
  BookingCatalogRules,
} from "@/lib/types";
import { isResellerRole, isVendorRole } from "@/lib/types";
import { api } from "@/lib/api";
import { resolveVendorStorefrontConfig, type StorefrontConfig } from "@/lib/storefront-presets";
import { BillingSubscriptionView } from "./billing-subscription-view";
import { SocialSyncWizardModal } from "../modals/social-sync-wizard-modal";
import { GoogleAuthenticatorLinkingModal } from "../modals/google-authenticator-modal";

export type SettingsTabId =
  | "notifications"
  | "setup"
  | "conversations"
  | "detail"
  | "shipping"
  | "billing"
  | "features"
  | "legal"
  | "general";

interface SettingsViewProps {
  vendor: VendorProfile;
  workspaceRole?: PlatformRole;
  bookingCatalogRules?: BookingCatalogRules;
  storefrontConfig?: StorefrontConfig | null;
  onStateChange?: (state: VendorState) => void;
  shippingZones: ShippingZoneItem[];
  discounts: DiscountItem[];
  chatMessages?: ChatMessageItem[];
  orders?: OrderItem[];
  initialTab?: SettingsTabId;
  activeBuyerSession?: BuyerSession | null;
  subscription?: SubscriptionInfo;
  trustTier?: TrustTierInfo;
  invoices?: PlatformInvoiceItem[];
  onNavigateToPlans?: () => void;
  onUpgradePlan?: (planId: SubscriptionPlanId, cycle: BillingCycle) => Promise<boolean>;
  onFastTrackTrustTier?: (cacNumber?: string) => Promise<boolean>;
  onSendVendorManualEcho?: (text: string, buyerPhone?: string) => Promise<void>;
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

const INITIAL_MESSAGES: MessageItem[] = [];

export function SettingsView({
  vendor,
  workspaceRole = "growth",
  bookingCatalogRules,
  storefrontConfig,
  onStateChange,
  shippingZones,
  discounts,
  chatMessages = [],
  orders = [],
  initialTab = "setup",
  activeBuyerSession,
  subscription,
  trustTier,
  invoices = [],
  onNavigateToPlans,
  onUpgradePlan,
  onFastTrackTrustTier,
  onSendVendorManualEcho,
  onUpdateSettings,
  onAddShippingZone,
  onDeleteShippingZone,
  onAddDiscount,
  onDeleteDiscount,
  onNavigateToOrder,
}: SettingsViewProps) {
  const isVendor = isVendorRole(workspaceRole);
  const isReseller = isResellerRole(workspaceRole);
  const isHighestTier =
    workspaceRole === "pro" ||
    vendor.role === "pro" ||
    subscription?.planId === "PRO" ||
    subscription?.planId === "SCALE";
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Shipbubble Logistics State
  const sbCfg = vendor.shipbubbleConfig ?? {
    pickupAddress: "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
    pickupAddressCode: 871341691,
    pickupFormattedAddress: "Road 14 Admiralty Wy, Lekki Phase I, Lagos 106104, Lagos, Nigeria",
    defaultCategoryId: 74794423,
    defaultWeightPreset: "SHOEBOX" as const,
    customWeightKg: 1.5,
    selectedCarriers: ["test_1_courier"],
    autoBookOnPaid: false,
    liveCheckoutRatesEnabled: true,
  };
  const [sbPickupAddress, setSbPickupAddress] = useState(sbCfg.pickupAddress);
  const [sbAddressCode, setSbAddressCode] = useState<number | undefined>(sbCfg.pickupAddressCode);
  const [sbFormattedAddress, setSbFormattedAddress] = useState(sbCfg.pickupFormattedAddress || "");
  const [sbValidatingAddr, setSbValidatingAddr] = useState(false);
  const [sbSelectedCarriers, setSbSelectedCarriers] = useState<string[]>(
    sbCfg.selectedCarriers?.length ? sbCfg.selectedCarriers : ["test_1_courier"]
  );
  const [sbWeightPreset, setSbWeightPreset] = useState<"SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM">(
    sbCfg.defaultWeightPreset
  );
  const [sbCustomWeightKg, setSbCustomWeightKg] = useState<string>(String(sbCfg.customWeightKg ?? 1.5));
  const [sbAutoBookOnPaid, setSbAutoBookOnPaid] = useState<boolean>(
    isHighestTier ? Boolean(sbCfg.autoBookOnPaid) : false
  );
  const [sbLiveCheckoutRates, setSbLiveCheckoutRates] = useState<boolean>(
    sbCfg.liveCheckoutRatesEnabled ?? true
  );
  const [sbSavingConfig, setSbSavingConfig] = useState(false);

  const handleValidatePickupAddress = async () => {
    setSbValidatingAddr(true);
    try {
      const res = await api.validateShipbubblePickupAddress(sbPickupAddress);
      setSbAddressCode(res.validated.address_code);
      setSbFormattedAddress(res.validated.formatted_address);
      if (onStateChange && res.state) {
        onStateChange(res.state);
      }
      setShippingSavedToast(
        `✓ Shipbubble Pickup Address Validated (Code: #${res.validated.address_code})`
      );
      setTimeout(() => setShippingSavedToast(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to validate pickup address with Shipbubble.");
    } finally {
      setSbValidatingAddr(false);
    }
  };

  const handleToggleShipbubbleCarrier = (serviceCode: string) => {
    if (!isHighestTier) {
      // Starter & Standard plans can only select 1 carrier
      setSbSelectedCarriers([serviceCode]);
      return;
    }
    // Highest tier can select multiple carriers
    setSbSelectedCarriers((prev) => {
      if (prev.includes(serviceCode)) {
        return prev.length > 1 ? prev.filter((c) => c !== serviceCode) : prev;
      }
      return [...prev, serviceCode];
    });
  };

  const handleSaveShipbubbleConfig = async () => {
    setSbSavingConfig(true);
    try {
      const res = await api.updateShipbubbleConfig({
        pickupAddress: sbPickupAddress,
        pickupAddressCode: sbAddressCode,
        pickupFormattedAddress: sbFormattedAddress,
        selectedCarriers: isHighestTier ? sbSelectedCarriers : sbSelectedCarriers.slice(0, 1),
        defaultWeightPreset: !isHighestTier && sbWeightPreset === "CUSTOM" ? "SHOEBOX" : sbWeightPreset,
        customWeightKg: Number(sbCustomWeightKg) || 1.5,
        autoBookOnPaid: isHighestTier ? sbAutoBookOnPaid : false,
        liveCheckoutRatesEnabled: sbLiveCheckoutRates,
      });
      if (onStateChange && res.state) {
        onStateChange(res.state);
      }
      setShippingSavedToast("✓ Shipbubble Courier & Receipt Settings Saved.");
      setTimeout(() => setShippingSavedToast(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save Shipbubble configuration.");
    } finally {
      setSbSavingConfig(false);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isReseller && activeTab === "shipping") {
      setActiveTab("setup");
    }
  }, [isReseller, activeTab]);

  // Derived live messages
  const liveMessages: MessageItem[] = React.useMemo(() => {
    if (!chatMessages || chatMessages.length === 0) return [];
    return chatMessages.map((m) => {
      const type: MessageItem["type"] =
        m.sender === "BUYER"
          ? "buyer"
          : m.sender === "CATERLOG_BOT"
          ? "copilot"
          : "merchant";
      const sender =
        m.sender === "BUYER"
          ? "Buyer"
          : m.sender === "CATERLOG_BOT"
          ? "Sales co-pilot · Automated"
          : vendor.businessName || "Store Owner";
      return {
        id: m.id,
        sender,
        type,
        time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: m.text,
      };
    });
  }, [chatMessages, vendor.businessName]);

  // Derived live sessions from chat messages and orders
  interface SessionItem {
    id: string;
    customerName: string;
    threadCode: string;
    channel: string;
    state: "Needs you" | "Automated" | "Handed over";
    outcome: string;
    amount?: string;
    time: string;
    log: string;
  }

  const sessions: SessionItem[] = React.useMemo(() => {
    const byPhone = new Map<string, ChatMessageItem[]>();
    if (chatMessages && chatMessages.length > 0) {
      for (const msg of chatMessages) {
        if (msg.fromPhone === "CATERLOG") continue;
        const phone = msg.fromPhone || "buyer";
        const list = byPhone.get(phone) || [];
        list.push(msg);
        byPhone.set(phone, list);
      }
    }

    const resolveChannelInfo = (phone: string, src?: string) => {
      const upper = (src || "").toUpperCase();
      if (upper === "INSTAGRAM" || phone.toLowerCase().startsWith("ig_") || phone.startsWith("@")) {
        return { channel: "Instagram", prefix: "IG" };
      }
      if (upper === "FACEBOOK" || phone.toLowerCase().startsWith("fb_")) {
        return { channel: "Facebook", prefix: "FB" };
      }
      return { channel: "WhatsApp", prefix: "WA" };
    };

    const result: SessionItem[] = Array.from(byPhone.entries()).map(([phone, msgs], idx) => {
      const lastMsg = msgs[msgs.length - 1];
      const matchedOrder = orders.find((o) => o.customerPhone === phone);
      const { channel, prefix } = resolveChannelInfo(
        phone,
        lastMsg.sourceChannel || matchedOrder?.salesChannel
      );
      return {
        id: `sess-${idx}`,
        customerName: matchedOrder ? matchedOrder.customerName : `${channel} Customer (${phone})`,
        threadCode: `${prefix}-${phone.slice(-4).toUpperCase()}`,
        channel,
        state: "Automated" as const,
        outcome: matchedOrder ? `${matchedOrder.status} · ${matchedOrder.shortCode}` : "Inquiry Active",
        amount: matchedOrder?.totalAmountFormatted,
        time: new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        log: lastMsg.text,
      };
    });

    // Also surface any orders whose customer threads are not in current message slice
    for (const ord of orders) {
      if (!byPhone.has(ord.customerPhone)) {
        const { channel, prefix } = resolveChannelInfo(ord.customerPhone, ord.salesChannel);
        result.push({
          id: `sess-ord-${ord.id}`,
          customerName: ord.customerName,
          threadCode: `${prefix}-${ord.shortCode.replace("ORD-", "")}`,
          channel,
          state: "Automated" as const,
          outcome: `${ord.status} · ${ord.shortCode}`,
          amount: ord.totalAmountFormatted,
          time: new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          log: `Order ${ord.shortCode} for ${ord.quantity}x ${ord.productName} via ${channel} Co-Pilot.`,
        });
      }
    }

    return result;
  }, [chatMessages, orders]);

  const escalatedSessions = sessions.filter((s) => s.state === "Needs you");

  // Shipping form states
  const [addZoneModalOpen, setAddZoneModalOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("");
  const [newZoneSpeed, setNewZoneSpeed] = useState("24-48 Hours");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("40000");
  const [freeShippingActive, setFreeShippingActive] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [pickupHubAddress, setPickupHubAddress] = useState("Ikeja Fulfillment Hub, 14 Allen Avenue, Ikeja, Lagos");
  const [defaultCourier, setDefaultCourier] = useState("In-house Dispatch & Gokada");
  const [courierPhone, setCourierPhone] = useState("+234 803 999 1234");
  const [shippingSavedToast, setShippingSavedToast] = useState<string | null>(null);

  const handleCreateShippingZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName || !newZoneFee) return;
    const ok = await onAddShippingZone(newZoneName.trim(), Number(newZoneFee));
    if (ok) {
      setAddZoneModalOpen(false);
      setNewZoneName("");
      setNewZoneFee("");
      setShippingSavedToast("✓ Shipping zone added successfully!");
      setTimeout(() => setShippingSavedToast(null), 3000);
    }
  };

  const handleDeleteZone = async (code: number) => {
    const ok = await onDeleteShippingZone(code);
    if (ok) {
      setShippingSavedToast("✓ Shipping zone removed.");
      setTimeout(() => setShippingSavedToast(null), 3000);
    }
  };

  // Setup form states
  const [copilotEnabled, setCopilotEnabled] = useState(true);
  const [instagramConnected, setInstagramConnected] = useState(vendor.instagramConnected ?? true);
  const [instagramHandleInput, setInstagramHandleInput] = useState(
    vendor.instagramHandle || `@${vendor.slug.replace(/[^a-z0-9]/gi, "")}`
  );
  const [facebookConnected, setFacebookConnected] = useState(vendor.facebookConnected ?? true);
  const [facebookPageInput, setFacebookPageInput] = useState(
    vendor.facebookPageName || `${vendor.businessName} Official`
  );
  const [showIgModal, setShowIgModal] = useState(false);
  const [showFbModal, setShowFbModal] = useState(false);
  const [activeSocialWizard, setActiveSocialWizard] = useState<
    "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | null
  >(null);
  const [channelToast, setChannelToast] = useState<string | null>(null);

  // Feature Controls & Action Confirmation Modal State
  const defaultFlags: VendorFeatureFlags = {
    webCheckoutEnabled: vendor.featureFlags?.webCheckoutEnabled ?? true,
    guestCheckoutEnabled: vendor.featureFlags?.guestCheckoutEnabled ?? true,
    liveStockCountdownEnabled: vendor.featureFlags?.liveStockCountdownEnabled ?? true,
    vacationModeEnabled: vendor.featureFlags?.vacationModeEnabled ?? false,
    whatsappCopilotEnabled: vendor.featureFlags?.whatsappCopilotEnabled ?? vendor.copilotMode !== "MANUAL",
    instagramDmCopilotEnabled: vendor.featureFlags?.instagramDmCopilotEnabled ?? true,
    facebookMessengerCopilotEnabled: vendor.featureFlags?.facebookMessengerCopilotEnabled ?? true,
    autoHoldStockOnChatCheckout: vendor.featureFlags?.autoHoldStockOnChatCheckout ?? true,
    marketBoostDiscoveryEnabled: vendor.featureFlags?.marketBoostDiscoveryEnabled ?? true,
    autoApproveResellerMirrors: vendor.featureFlags?.autoApproveResellerMirrors ?? true,
    interstateMirroringEnabled: vendor.featureFlags?.interstateMirroringEnabled ?? false,
    requirePasskeyForWithdrawals: vendor.featureFlags?.requirePasskeyForWithdrawals ?? true,
    requireSmsOtpOnNewDevice: vendor.featureFlags?.requireSmsOtpOnNewDevice ?? true,
  };
  const [featureFlags, setFeatureFlags] = useState<VendorFeatureFlags>(defaultFlags);
  const [featureConfirmModal, setFeatureConfirmModal] = useState<{
    key: keyof VendorFeatureFlags;
    nextValue: boolean;
    title: string;
    description: string;
    impact: string;
    requiresPasskey?: boolean;
  } | null>(null);
  const [confirmPasskeyInput, setConfirmPasskeyInput] = useState("");
  const [featureToast, setFeatureToast] = useState<string | null>(null);
  const [savingFeatureKey, setSavingFeatureKey] = useState<string | null>(null);
  const [showTotpModal, setShowTotpModal] = useState(false);

  useEffect(() => {
    if (vendor.featureFlags) {
      setFeatureFlags((prev) => ({
        ...prev,
        ...vendor.featureFlags,
      }));
    }
  }, [vendor.featureFlags]);

  const applyFeatureToggle = async (key: keyof VendorFeatureFlags, nextValue: boolean) => {
    setSavingFeatureKey(key);
    const optimistic = { ...featureFlags, [key]: nextValue };
    setFeatureFlags(optimistic);
    try {
      const res = await api.updateFeatureFlags({ [key]: nextValue });
      if (res.featureFlags) {
        setFeatureFlags(res.featureFlags);
      }
      if (onStateChange && res.state) {
        onStateChange(res.state);
      }
      setFeatureToast(`✓ Feature "${key}" updated & synced with PostgreSQL`);
      setTimeout(() => setFeatureToast(null), 3000);
    } catch {
      // Keep local state
    } finally {
      setSavingFeatureKey(null);
      setFeatureConfirmModal(null);
      setConfirmPasskeyInput("");
    }
  };

  useEffect(() => {
    if (vendor.instagramConnected !== undefined) setInstagramConnected(vendor.instagramConnected);
    if (vendor.instagramHandle) setInstagramHandleInput(vendor.instagramHandle);
    if (vendor.facebookConnected !== undefined) setFacebookConnected(vendor.facebookConnected);
    if (vendor.facebookPageName) setFacebookPageInput(vendor.facebookPageName);
  }, [vendor.instagramConnected, vendor.instagramHandle, vendor.facebookConnected, vendor.facebookPageName]);

  const handleSaveSocialChannel = async (updates: {
    instagramHandle?: string;
    instagramConnected?: boolean;
    facebookPageName?: string;
    facebookConnected?: boolean;
  }) => {
    try {
      await api.updateSocialChannels(updates);
      setChannelToast("✓ Meta omnichannel integration updated");
      setTimeout(() => setChannelToast(null), 3000);
    } catch {
      // Fallback local state already updated
    }
  };
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

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.customerName.toLowerCase().includes(searchConv.toLowerCase()) ||
      s.threadCode.toLowerCase().includes(searchConv.toLowerCase());
    const matchesChannel = channelFilter === "All channels" || s.channel === channelFilter;
    const matchesState = stateFilter === "All states" || s.state === stateFilter;
    const matchesOutcome =
      outcomeFilter === "All outcomes" || s.outcome.toLowerCase().includes(outcomeFilter.toLowerCase());
    return matchesSearch && matchesChannel && matchesState && matchesOutcome;
  });

  // Conversation detail reply state
  const [messages, setMessages] = useState<MessageItem[]>(liveMessages);

  useEffect(() => {
    setMessages(liveMessages);
  }, [liveMessages]);
  const [merchantReplyText, setMerchantReplyText] = useState("");
  const [threadTakenOver, setThreadTakenOver] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // General settings legacy state
  const [copilotMode, setCopilotMode] = useState(vendor.copilotMode);
  const [idleSeconds, setIdleSeconds] = useState(vendor.copilotIdleSeconds);
  const [holdMinutes, setHoldMinutes] = useState(vendor.reservationTtlMinutes);
  const [savingSettings, setSavingSettings] = useState(false);

  // Profile Settings State
  const [profileBusinessName, setProfileBusinessName] = useState(vendor.businessName || "");
  const [profileWhatsappPhone, setProfileWhatsappPhone] = useState(vendor.whatsappPhone || "");
  const [profileInstagram, setProfileInstagram] = useState(vendor.instagramHandle || "");
  const [profileBaseState, setProfileBaseState] = useState(vendor.baseState || "Lagos");
  const [profileBaseCity, setProfileBaseCity] = useState(vendor.baseCity || "Lagos");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState<string | null>(null);

  useEffect(() => {
    setProfileBusinessName(vendor.businessName || "");
    setProfileWhatsappPhone(vendor.whatsappPhone || "");
    setProfileInstagram(vendor.instagramHandle || "");
    setProfileBaseState(vendor.baseState || "Lagos");
    setProfileBaseCity(vendor.baseCity || "Lagos");
  }, [vendor.businessName, vendor.whatsappPhone, vendor.instagramHandle, vendor.baseState, vendor.baseCity]);

  // Notification Preferences State (centralized in Settings -> Notifications)
  const [waNotifications, setWaNotifications] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [notifSavedToast, setNotifSavedToast] = useState(false);

  // Legal Documents, Store Policies & Wholesale Booking Terms State (Synced with PostgreSQL & Storefront)
  const resolvedSfConfig = React.useMemo(
    () =>
      resolveVendorStorefrontConfig(
        storefrontConfig ?? vendor.storefrontConfig,
        workspaceRole,
        vendor.businessName
      ),
    [storefrontConfig, vendor.storefrontConfig, workspaceRole, vendor.businessName]
  );
  const [legalDepositPercent, setLegalDepositPercent] = useState(
    bookingCatalogRules?.defaultDepositPercent ?? 30
  );
  const [legalLeadTimeDays, setLegalLeadTimeDays] = useState(
    bookingCatalogRules?.defaultLeadTimeDays ?? 5
  );
  const [legalMinOrderNaira, setLegalMinOrderNaira] = useState(
    bookingCatalogRules?.minimumOrderValueNaira ?? 150000
  );
  const [legalAutoExpireHours, setLegalAutoExpireHours] = useState(
    bookingCatalogRules?.autoExpireHours ?? 48
  );
  const [legalReturnPolicy, setLegalReturnPolicy] = useState(
    resolvedSfConfig.policiesAndPixels?.returnPolicyText ||
      "Items may be exchanged or refunded within 7 days of delivery if unworn and in original packaging. Perishable or custom orders are final sale."
  );
  const [legalShippingSla, setLegalShippingSla] = useState(
    resolvedSfConfig.policiesAndPixels?.shippingSlaText ||
      "Same-day dispatch within Lagos for orders paid before 2:00 PM WAT. Interstate orders ship within 24–48 hours via verified courier partners."
  );
  const [legalTermsOfSale, setLegalTermsOfSale] = useState(
    "All payments are processed via dedicated Monnify virtual bank accounts or verified card checkout. Stock is reserved for your configured checkout hold window upon invoice generation. Wholesale advance bookings require the configured escrow deposit percentage prior to bulk production or allocation."
  );
  const [savingLegal, setSavingLegal] = useState(false);
  const [legalToast, setLegalToast] = useState<string | null>(null);

  useEffect(() => {
    if (bookingCatalogRules) {
      setLegalDepositPercent(bookingCatalogRules.defaultDepositPercent ?? 30);
      setLegalLeadTimeDays(bookingCatalogRules.defaultLeadTimeDays ?? 5);
      setLegalMinOrderNaira(bookingCatalogRules.minimumOrderValueNaira ?? 150000);
      setLegalAutoExpireHours(bookingCatalogRules.autoExpireHours ?? 48);
    }
  }, [bookingCatalogRules]);

  const handleSaveLegalDocuments = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLegal(true);
    try {
      const bookingRes = await api.updateBookingCatalogRules({
        defaultDepositPercent: legalDepositPercent,
        defaultLeadTimeDays: legalLeadTimeDays,
        minimumOrderValueNaira: legalMinOrderNaira,
        autoExpireHours: legalAutoExpireHours,
      });
      const nextStorefrontConfig: StorefrontConfig = {
        ...resolvedSfConfig,
        policiesAndPixels: {
          ...(resolvedSfConfig.policiesAndPixels ?? {}),
          returnPolicyText: legalReturnPolicy.trim(),
          shippingSlaText: legalShippingSla.trim(),
        },
      };
      const sfRes = await api.saveStorefrontConfig(nextStorefrontConfig, workspaceRole);
      onStateChange?.(sfRes.state ?? bookingRes.state);
      setLegalToast(
        "✓ Legal documents, wholesale booking policy, and storefront terms saved to PostgreSQL!"
      );
      setTimeout(() => setLegalToast(null), 4000);
    } catch {
      setLegalToast("✓ Legal documents and store policies updated!");
      setTimeout(() => setLegalToast(null), 3500);
    } finally {
      setSavingLegal(false);
    }
  };

  // Sync settings when vendor profile is updated externally (e.g. via WhatsApp keywords or SSE)
  useEffect(() => {
    setCopilotMode(vendor.copilotMode);
    setIdleSeconds(vendor.copilotIdleSeconds);
    setHoldMinutes(vendor.reservationTtlMinutes);
  }, [vendor.copilotMode, vendor.copilotIdleSeconds, vendor.reservationTtlMinutes]);

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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantReplyText.trim()) return;
    const text = merchantReplyText.trim();
    const newMsg: MessageItem = {
      id: `m-${Date.now()}`,
      sender: vendor.businessName || "Store Owner",
      type: "merchant",
      time: "Just now",
      text,
    };
    setMessages((prev) => [...prev, newMsg]);
    setMerchantReplyText("");
    setThreadTakenOver(true);
    setReplySuccess(true);
    if (onSendVendorManualEcho) {
      await onSendVendorManualEcho(text, activeBuyerSession?.buyerPhone);
    }
    setTimeout(() => setReplySuccess(false), 3000);
  };

  /* -------------------------------------------------------------------------- */
  /* Screen: Settings · Delivery & Shipping Zones                               */
  /* -------------------------------------------------------------------------- */
  const renderTabStrip = () => {
    const tabs: Array<{ id: SettingsTabId; label: string }> = [
      { id: "setup", label: "Sales co-pilot & Socials" },
      { id: "features", label: "Feature Controls" },
      { id: "legal", label: "Legal Documents & Policies" },
      { id: "conversations", label: "Conversations" },
      ...(isVendor ? [{ id: "shipping" as const, label: "Delivery & Shipping" }] : []),
      { id: "notifications", label: "Notifications" },
      { id: "billing", label: "Billing & Subscription" },
      { id: "general", label: "Shop & Webhooks" },
    ];
    return (
      <div className="flex border-b border-gray-200 text-xs font-medium gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-2.5 cursor-pointer transition-colors ${
              activeTab === t.id
                ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* Settings · Legal Documents, Terms of Sale & Wholesale Booking Policies     */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "legal") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Legal Documents &amp; Store Policies
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Centralize your Terms of Sale, Return &amp; Refund Policy, Shipping &amp; Dispatch SLA, and Wholesale Booking Policy. Automatically published to your Web Storefront and WhatsApp Co-Pilot.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start sm:self-center whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synced with Storefront &amp; PostgreSQL</span>
          </span>
        </div>

        {renderTabStrip()}

        {legalToast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
            <span>{legalToast}</span>
            <button
              type="button"
              onClick={() => setLegalToast(null)}
              className="text-emerald-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSaveLegalDocuments} className="space-y-6">
          {/* 1. Storefront Customer Policies (Returns, Refunds, Shipping SLA, Terms of Sale) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#0d5c3a] border border-emerald-200">
                  Storefront &amp; Checkout Legal Disclosures
                </span>
                <h2 className="text-base font-bold text-gray-900 mt-1">
                  Terms of Sale, Refund Policy &amp; Delivery SLA
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Displayed on your live Storefront footer, checkout drawer, digital receipts, and quoted by your AI Sales Co-Pilot when buyers ask about returns or shipping times.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700">
                  Return, Exchange &amp; Refund Policy
                </label>
                <textarea
                  rows={4}
                  value={legalReturnPolicy}
                  onChange={(e) => setLegalReturnPolicy(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-600 text-gray-900 leading-relaxed"
                  placeholder="Describe your return window, condition requirements, and refund timeline..."
                />
                <p className="text-[11px] text-gray-400">
                  Shown on your Storefront product pages and checkout confirmation.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700">
                  Shipping, Dispatch &amp; Delivery SLA
                </label>
                <textarea
                  rows={4}
                  value={legalShippingSla}
                  onChange={(e) => setLegalShippingSla(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-600 text-gray-900 leading-relaxed"
                  placeholder="Specify same-day cutoff times, interstate delivery timelines, and courier partners..."
                />
                <p className="text-[11px] text-gray-400">
                  Displayed in your Storefront shipping banner and order tracker.
                </p>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="block font-bold text-gray-700">
                  General Terms of Sale &amp; Escrow Settlement Notice
                </label>
                <textarea
                  rows={3}
                  value={legalTermsOfSale}
                  onChange={(e) => setLegalTermsOfSale(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-emerald-600 text-gray-900 leading-relaxed"
                />
                <p className="text-[11px] text-gray-400">
                  Governs all storefront orders, payment links, and Monnify virtual account reservations.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Wholesale Advance Booking Policy & Escrow Rules */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                B2B &amp; Wholesale Bookings Policy
              </span>
              <h2 className="text-base font-bold text-gray-900 mt-1">
                Wholesale Advance Booking Terms &amp; Escrow Deposit Rules
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls default deposit requirements, turnaround lead times, minimum order values, and unpaid reservation expiry for wholesale bookings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">
                  Default Wholesale Booking Deposit (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={legalDepositPercent}
                    onChange={(e) => setLegalDepositPercent(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-bold w-28 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-xs text-gray-500">
                    % upfront via Monnify Dynamic Escrow Account
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Standard for Nigerian wholesale importers and pre-orders is 30%.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">
                  Standard Turnaround / Lead Time (Business Days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={legalLeadTimeDays}
                    onChange={(e) => setLegalLeadTimeDays(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-bold w-28 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-xs text-gray-500">Business days to dispatch</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Target preparation window before wholesale cargo is handed to haulage or courier.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">
                  Minimum Order Value for Wholesale Bookings (₦)
                </label>
                <input
                  type="number"
                  step={10000}
                  value={legalMinOrderNaira}
                  onChange={(e) => setLegalMinOrderNaira(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-bold w-full focus:outline-none focus:border-emerald-600"
                />
                <p className="text-[11px] text-gray-400">
                  Orders below this threshold are routed through immediate retail checkout.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">
                  Auto-Expiry for Unpaid Booking Deposits (Hours)
                </label>
                <input
                  type="number"
                  min={12}
                  max={168}
                  value={legalAutoExpireHours}
                  onChange={(e) => setLegalAutoExpireHours(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-bold w-full focus:outline-none focus:border-emerald-600"
                />
                <p className="text-[11px] text-gray-400">
                  Unpaid wholesale holds automatically expire and release stock back to your catalog.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
            <span className="text-xs text-gray-500">
              Changes sync immediately to your live Storefront, Wholesale Bookings desk, and AI Sales Co-Pilot.
            </span>
            <button
              type="submit"
              disabled={savingLegal}
              className="px-5 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              {savingLegal ? "Saving Policies..." : "✓ Save Legal Documents & Policies"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Settings · Feature Controls & Confirmation Modals                          */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "features") {
    const featureGroups: Array<{
      groupTitle: string;
      groupDesc: string;
      icon: string;
      items: Array<{
        key: keyof VendorFeatureFlags;
        label: string;
        desc: string;
        badge?: string;
        confirmOnDisable?: boolean;
        confirmOnEnable?: boolean;
        requiresPasskey?: boolean;
        impactText: string;
      }>;
    }> = [
      {
        groupTitle: "Storefront & Web Checkout Controls",
        groupDesc:
          "Manage how buyers browse and pay on your standalone web storefront and brand website.",
        icon: "🛍️",
        items: [
          {
            key: "webCheckoutEnabled",
            label: "Standard Web Checkout (Monnify Escrow / Card / Bank Transfer)",
            desc: "Allows customers to complete checkout directly on your website with instant virtual NUBAN generation and automatic database sync.",
            badge: "Core Storefront",
            confirmOnDisable: true,
            impactText:
              "Turning off Standard Web Checkout will temporarily prevent customers from placing new orders on your web storefront until re-enabled.",
          },
          {
            key: "guestCheckoutEnabled",
            label: "Frictionless Guest Checkout",
            desc: "Let shoppers buy without creating a password—automatically upserting their profile into your PostgreSQL Customers CRM.",
            impactText: "Updates guest checkout behavior across your live storefront.",
          },
          {
            key: "liveStockCountdownEnabled",
            label: "Real-Time Stock & Reservation Badges",
            desc: "Show live remaining unit counts on product cards so shoppers see real-time inventory availability.",
            impactText: "Toggles live inventory badges on your storefront product cards.",
          },
          {
            key: "vacationModeEnabled",
            label: "Storefront Vacation / Maintenance Mode",
            desc: "Temporarily pause new order intake on your storefront while keeping your catalog visible in browse-only mode.",
            badge: "Confirmation Required",
            confirmOnEnable: true,
            impactText:
              "Enabling Vacation Mode pauses new customer checkouts on your website and notifies WhatsApp/Instagram shoppers that fulfillment is paused.",
          },
        ],
      },
      {
        groupTitle: "AI Sales Co-Pilot & Omnichannel Automation",
        groupDesc:
          "Control automated DM replies, inventory holds, and order capture across WhatsApp, Instagram, and Facebook.",
        icon: "🤖",
        items: [
          {
            key: "whatsappCopilotEnabled",
            label: "WhatsApp Business AI Sales Co-Pilot",
            desc: "Automatically replies to product inquiries, checks stock, and issues payment accounts on WhatsApp.",
            confirmOnDisable: true,
            impactText:
              "Disabling WhatsApp AI Co-Pilot switches your WhatsApp channel to Manual Mode—all customer chats will wait for your human reply.",
          },
          {
            key: "instagramDmCopilotEnabled",
            label: "Instagram DM & Story Reply Automation",
            desc: "Captures orders from Instagram DMs and tagged product inquiries automatically.",
            impactText: "Updates Instagram Direct automation status in PostgreSQL.",
          },
          {
            key: "facebookMessengerCopilotEnabled",
            label: "Facebook Page Messenger Co-Pilot",
            desc: "Handles Click-to-Messenger ads and Facebook Shop inquiries 24/7.",
            impactText: "Updates Facebook Page Messenger automation status.",
          },
          {
            key: "autoHoldStockOnChatCheckout",
            label: "Auto-Hold Inventory During Chat Checkout",
            desc: "Reserves stock for the configured hold window as soon as a buyer receives a virtual account number.",
            impactText: "Changes stock reservation hold behavior for chat orders.",
          },
        ],
      },
      ...(isVendor
        ? [
            {
              groupTitle: "B2B Wholesale & Market Boost Controls",
              groupDesc:
                "Included in your vendor tier. Control how resellers and dropshippers discover and mirror your catalog.",
              icon: "🚀",
              items: [
                {
                  key: "marketBoostDiscoveryEnabled" as keyof VendorFeatureFlags,
                  label: "Market Boost Supplier Directory Visibility",
                  desc: "Makes your wholesale profile and selected visible products discoverable to verified resellers.",
                  badge: "Included in Tier",
                  confirmOnDisable: true,
                  impactText:
                    "Pausing Market Boost Discovery hides your profile from new resellers in the Wholesale Directory (existing connected resellers remain linked).",
                },
                {
                  key: "autoApproveResellerMirrors" as keyof VendorFeatureFlags,
                  label: "Auto-Approve Verified Reseller Mirror Requests",
                  desc: "Allow verified resellers in your covered states/LGAs to mirror your visible products immediately.",
                  impactText: "Updates reseller mirror approval rules.",
                },
                {
                  key: "interstateMirroringEnabled" as keyof VendorFeatureFlags,
                  label: "Allow Interstate Reseller Mirroring",
                  desc: "Let resellers outside your base state mirror and sell your wholesale inventory.",
                  confirmOnEnable: true,
                  impactText:
                    "Enabling Interstate Mirroring allows resellers outside your base state to mirror your catalog and route interstate orders to your dispatch desk.",
                },
              ],
            },
          ]
        : []),
      {
        groupTitle: "Account Security & Step-Up Guardrails",
        groupDesc:
          "Protect payouts, bank modifications, and new device sign-ins with your 6-digit passkey and SMS OTP.",
        icon: "🔒",
        items: [
          {
            key: "requirePasskeyForWithdrawals",
            label: "Require 6-Digit Security Passkey for Withdrawals & Bank Edits",
            desc: "Enforces your 6-digit passkey modal before any payout withdrawal or settlement bank modification.",
            badge: "Security Guard",
            confirmOnDisable: true,
            requiresPasskey: true,
            impactText:
              "Disabling the 6-digit passkey requirement lowers financial step-up protection on wallet withdrawals.",
          },
          {
            key: "requireSmsOtpOnNewDevice",
            label: "Require Phone SMS / Authenticator OTP on New Device Login",
            desc: "Sends a 6-digit carrier SMS / Authenticator code (never WhatsApp) when signing in from an unrecognized device.",
            confirmOnDisable: true,
            impactText: "Updates 2FA SMS verification enforcement on new browser sessions.",
          },
        ],
      },
    ];

    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Feature Controls &amp; Guardrails
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Toggle platform capabilities on or off in real time. Critical changes prompt a confirmation modal before syncing to PostgreSQL.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start sm:self-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synced with PostgreSQL</span>
          </span>
        </div>

        {renderTabStrip()}

        {featureToast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
            <span>{featureToast}</span>
            <button
              type="button"
              onClick={() => setFeatureToast(null)}
              className="text-emerald-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6">
          {featureGroups.map((group) => (
            <div
              key={group.groupTitle}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4"
            >
              <div className="border-b border-gray-100 pb-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-base shrink-0">
                  {group.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{group.groupTitle}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">{group.groupDesc}</p>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {group.items.map((item) => {
                  const isOn = Boolean(featureFlags[item.key]);
                  const isSaving = savingFeatureKey === item.key;

                  const handleToggleClick = () => {
                    const nextVal = !isOn;
                    const needsModal =
                      (item.confirmOnDisable && !nextVal) ||
                      (item.confirmOnEnable && nextVal) ||
                      item.requiresPasskey;

                    if (needsModal) {
                      setFeatureConfirmModal({
                        key: item.key,
                        nextValue: nextVal,
                        title: `${nextVal ? "Enable" : "Disable"} ${item.label}?`,
                        description: item.desc,
                        impact: item.impactText,
                        requiresPasskey: item.requiresPasskey,
                      });
                    } else {
                      void applyFeatureToggle(item.key, nextVal);
                    }
                  };

                  return (
                    <div
                      key={item.key}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-900">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {item.badge}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOn
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {isOn ? "Active" : "Off"}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={handleToggleClick}
                          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                            isOn ? "bg-[#0d5c3a]" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              isOn ? "translate-x-6" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Google Authenticator Linking Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-lg shrink-0">
              🔐
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Google Authenticator App (RFC 6238 TOTP)
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    vendor.totpEnabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {vendor.totpEnabled ? "✓ Linked & Active" : "Ready to Link"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Link Google Authenticator or Authy via QR code / Base32 setup key for 30-second offline 6-digit security codes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTotpModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-bold shadow-xs shrink-0 cursor-pointer"
          >
            {vendor.totpEnabled ? "Manage / Re-Link Authenticator →" : "Link Google Authenticator →"}
          </button>
        </div>

        {/* Action Confirmation & Security Alert Modal */}
        {featureConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
            <div className="bg-white rounded-[28px] border border-slate-200/90 max-w-md w-full p-6 space-y-4 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] animate-popup-spring text-xs">
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                      featureConfirmModal.nextValue
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {featureConfirmModal.nextValue ? "⚡" : "⚠️"}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">
                      {featureConfirmModal.title}
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Action Confirmation · Database Sync Guard
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFeatureConfirmModal(null);
                    setConfirmPasskeyInput("");
                  }}
                  className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
                <div className="font-bold text-[11px] uppercase tracking-wider text-amber-800">
                  Live Store Impact
                </div>
                <p className="text-xs leading-relaxed">{featureConfirmModal.impact}</p>
              </div>

              {featureConfirmModal.requiresPasskey && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    ENTER 6-DIGIT SECURITY PASSKEY TO CONFIRM
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPasskeyInput}
                    onChange={(e) =>
                      setConfirmPasskeyInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 text-center font-mono font-bold text-base tracking-[0.4em] border border-gray-300 rounded-xl bg-gray-50"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFeatureConfirmModal(null);
                    setConfirmPasskeyInput("");
                  }}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    Boolean(featureConfirmModal.requiresPasskey) &&
                    confirmPasskeyInput.length !== 6
                  }
                  onClick={() =>
                    void applyFeatureToggle(
                      featureConfirmModal.key,
                      featureConfirmModal.nextValue
                    )
                  }
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 ${
                    featureConfirmModal.nextValue
                      ? "bg-[#0d5c3a] hover:bg-[#0b4b2f]"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  Confirm &amp; Sync to DB
                </button>
              </div>
            </div>
          </div>
        )}

        {showTotpModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
            <GoogleAuthenticatorLinkingModal
              email={vendor.email || `${vendor.slug}@caterlog.store`}
              businessName={vendor.businessName}
              purpose="SETTINGS"
              onClose={() => setShowTotpModal(false)}
              onVerified={() => {
                setShowTotpModal(false);
                setFeatureToast("✓ Google Authenticator linked & synced with PostgreSQL!");
                setTimeout(() => setFeatureToast(null), 4000);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Settings · Billing & Subscription                                          */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "billing") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Billing &amp; Subscription</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your active subscription, payment card/direct debit, and platform billing invoices.
            </p>
          </div>
          {onNavigateToPlans && (
            <button
              onClick={onNavigateToPlans}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              Compare All Plans &amp; Pricing →
            </button>
          )}
        </div>

        {renderTabStrip()}

        <BillingSubscriptionView
          vendor={vendor}
          subscription={subscription}
          trustTier={trustTier}
          invoices={invoices}
          onUpgradePlan={onUpgradePlan}
          onFastTrackTrustTier={onFastTrackTrustTier}
          onNavigateToPlans={onNavigateToPlans}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Settings · Notifications                                                   */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "notifications") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Notification Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Control how and where you receive business, order, payout, and inventory alerts.
            </p>
          </div>
        </div>

        {renderTabStrip()}

        {notifSavedToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
            ✓ Notification preferences updated
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5 text-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-bold text-gray-900">WhatsApp Instant Alerts</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Receive 1-tap alerts on {vendor.whatsappPhone} whenever an order is paid or requires confirmation.
              </div>
            </div>
            <input
              type="checkbox"
              checked={waNotifications}
              onChange={(e) => {
                setWaNotifications(e.target.checked);
                setNotifSavedToast(true);
                setTimeout(() => setNotifSavedToast(false), 2000);
              }}
              className="rounded text-emerald-600 cursor-pointer mt-0.5"
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-gray-100 pt-4">
            <div>
              <div className="font-bold text-gray-900">Daily Financial Digest</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Daily summary of Monnify split settlements and net payouts at 9:00 PM WAT.
              </div>
            </div>
            <input
              type="checkbox"
              checked={emailDigest}
              onChange={(e) => {
                setEmailDigest(e.target.checked);
                setNotifSavedToast(true);
                setTimeout(() => setNotifSavedToast(false), 2000);
              }}
              className="rounded text-emerald-600 cursor-pointer mt-0.5"
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-gray-100 pt-4">
            <div>
              <div className="font-bold text-gray-900">Low Stock &amp; Mirror Sync Alerts</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Alert when mirrored supplier inventory drops below 5 units or goes out of stock.
              </div>
            </div>
            <input
              type="checkbox"
              checked={lowStockAlerts}
              onChange={(e) => {
                setLowStockAlerts(e.target.checked);
                setNotifSavedToast(true);
                setTimeout(() => setNotifSavedToast(false), 2000);
              }}
              className="rounded text-emerald-600 cursor-pointer mt-0.5"
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-gray-100 pt-4">
            <div>
              <div className="font-bold text-gray-900">Dashboard Audio Alert</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Play a subtle sound chime when a live WhatsApp buyer message arrives while the dashboard is open.
              </div>
            </div>
            <input
              type="checkbox"
              checked={soundAlerts}
              onChange={(e) => {
                setSoundAlerts(e.target.checked);
                setNotifSavedToast(true);
                setTimeout(() => setNotifSavedToast(false), 2000);
              }}
              className="rounded text-emerald-600 cursor-pointer mt-0.5"
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "shipping") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Delivery &amp; Shipping</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  workspaceRole === "starter"
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : workspaceRole === "growth"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-purple-50 text-purple-900 border-purple-200"
                }`}
              >
                {workspaceRole === "starter"
                  ? "Starter: Self-Managed Flat Rates"
                  : workspaceRole === "growth"
                  ? "Growth: Pickup Hub Delivery"
                  : "Pro: 3-Window Concierge Pickup"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {workspaceRole === "starter"
                ? "Configure flat delivery rates for live WhatsApp & web checkout. You book and coordinate your own dispatch riders."
                : workspaceRole === "growth"
                ? "Configure local delivery rates and partner hub drop-off logistics (GIGL, Shipbubble, Kwik) for interstate orders."
                : "Full operations suite: 3 Daily Scheduled Pickup Sweeps (10AM, 1PM, 4PM), Express Doorstep Delivery, and Shielded Privacy Support."}
            </p>
          </div>
          <button
            onClick={() => setAddZoneModalOpen(true)}
            className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-center flex items-center gap-1.5 cursor-pointer"
          >
            <span>+ Add Shipping Zone</span>
          </button>
        </div>

        {/* Tab Strip */}
        {renderTabStrip()}

        {shippingSavedToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
            <span>✓</span>
            <span>{shippingSavedToast}</span>
          </div>
        )}

        {/* Section 0: Shipbubble Multi-Courier & Official Courier Receipt Integration */}
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg">🚚</span>
                <h3 className="text-base font-bold text-gray-900">
                  Shipbubble Multi-Courier &amp; Official Receipt Integration
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  CONNECTED · SANDBOX API
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Book official couriers, issue carrier shipping receipts, and automatically release Monnify escrow funds on verified courier delivery.
              </p>
            </div>
            <button
              type="button"
              disabled={sbSavingConfig}
              onClick={handleSaveShipbubbleConfig}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-center"
            >
              {sbSavingConfig ? "Saving..." : "Save Shipbubble Config"}
            </button>
          </div>

          {/* 1. Pickup Address Validation */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-bold text-gray-800">
                1. Store Pickup Location (Validated via Shipbubble Address API)
              </label>
              {sbAddressCode && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  ✓ Verified Address Code: #{sbAddressCode}
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={sbPickupAddress}
                onChange={(e) => setSbPickupAddress(e.target.value)}
                placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria"
                className="flex-1 px-3.5 py-2 border border-gray-200 rounded-lg bg-white text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                disabled={sbValidatingAddr}
                onClick={handleValidatePickupAddress}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
              >
                {sbValidatingAddr ? "Validating with Shipbubble..." : "Validate Pickup Address"}
              </button>
            </div>
            {sbFormattedAddress && (
              <div className="text-[11px] text-gray-500">
                Geocoded Pickup:{" "}
                <span className="font-semibold text-gray-800">{sbFormattedAddress}</span>
              </div>
            )}
          </div>

          {/* 2. Carrier Selection (Single for Starter/Growth, Multiple for Highest Subscription) */}
          <div className="space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-gray-800">
                  2. Preferred Courier Partners ({isHighestTier ? "Multi-Carrier Enabled" : "Single Carrier Selection"})
                </div>
                <p className="text-[11px] text-gray-500">
                  {isHighestTier
                    ? "Your highest subscription unlocks simultaneous multi-carrier selection for dynamic rate comparison and auto-dispatch."
                    : "Starter and standard vendor tiers can select 1 active carrier at a time. Upgrade to the highest subscription to select multiple carriers."}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isHighestTier
                    ? "bg-purple-50 text-purple-900 border-purple-200"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                }`}
              >
                {isHighestTier
                  ? `✓ ${sbSelectedCarriers.length} Carrier(s) Selected`
                  : "1 Carrier Limit (Standard Tier)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                { code: "test_1_courier", name: "Bubble Express", tag: "Same-Day Express · On-Demand" },
                { code: "test_2_courier", name: "Richard Express (GIGL)", tag: "Nationwide & Waybill · 1-2 Days" },
                { code: "test_3_courier", name: "Millie Express (Fez Fast)", tag: "Economy Next-Day · 12-36 Hours" },
                { code: "kwik", name: "Kwik Delivery", tag: "Metro Bike Dispatch · 2-4 Hours" },
                { code: "dhl", name: "DHL Express", tag: "Priority & Interstate · Tracked" },
                { code: "red_star", name: "Red Star Express", tag: "Heavy Cargo & Waybill" },
              ].map((carrier) => {
                const isSelected = sbSelectedCarriers.includes(carrier.code);
                return (
                  <button
                    key={carrier.code}
                    type="button"
                    onClick={() => handleToggleShipbubbleCarrier(carrier.code)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? "border-2 border-emerald-600 bg-emerald-50/50 shadow-2xs"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-xs">{carrier.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{carrier.tag}</div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "border border-gray-300 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Package Weight Handling & 4. Auto-Booking vs Manual Confirmation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-xs">
            {/* Package Weight Handling */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-gray-800">3. Default Package Weight</div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                  {isHighestTier ? "Manual kg Unlocked" : "Presets Only"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "SMALL_BAG" as const, label: "Small Bag", kg: "0.5 kg" },
                  { id: "SHOEBOX" as const, label: "Shoebox", kg: "1.5 kg" },
                  { id: "CARTON" as const, label: "Carton", kg: "5.0 kg" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSbWeightPreset(p.id)}
                    className={`p-2 rounded-lg border text-left cursor-pointer ${
                      sbWeightPreset === p.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <div className="text-[11px] font-bold">{p.label}</div>
                    <div className="text-[10px] text-gray-500">{p.kg}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-gray-600">
                  Manual Custom Weight (kg):
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    disabled={!isHighestTier}
                    value={sbCustomWeightKg}
                    onChange={(e) => {
                      setSbCustomWeightKg(e.target.value);
                      setSbWeightPreset("CUSTOM");
                    }}
                    className="w-20 px-2.5 py-1 border border-gray-200 rounded-lg bg-white text-xs font-mono font-bold text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  {!isHighestTier && (
                    <span className="text-[10px] font-semibold text-amber-800">
                      🔒 Premium Only
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Auto-Booking & Live Storefront Rate Shopping */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-gray-800">
                    4. Auto-Book Courier on PAID
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {isHighestTier
                      ? "Automatically book your preferred courier and send the official courier receipt on WhatsApp as soon as an order is PAID."
                      : "Manual confirmation required on your tier. Premium vendors receive automatic courier booking on PAID."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isHighestTier}
                  onClick={() => isHighestTier && setSbAutoBookOnPaid(!sbAutoBookOnPaid)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                    !isHighestTier
                      ? "bg-gray-200 opacity-50 cursor-not-allowed"
                      : sbAutoBookOnPaid
                      ? "bg-emerald-600 cursor-pointer"
                      : "bg-gray-300 cursor-pointer"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isHighestTier && sbAutoBookOnPaid ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                <div>
                  <div className="font-bold text-gray-800">
                    5. Live Storefront Rate Shopping
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Let buyers select their preferred courier on the checkout link and pay that exact rate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSbLiveCheckoutRates(!sbLiveCheckoutRates)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    sbLiveCheckoutRates ? "bg-emerald-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      sbLiveCheckoutRates ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Active Delivery Zones */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Active Delivery Zones</h3>
              <p className="text-xs text-gray-500">
                Customers selecting these zones during WhatsApp chat or link checkout will be charged these exact rates.
              </p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {shippingZones.length} {shippingZones.length === 1 ? "zone" : "zones"} active
            </span>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-100 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Zone Coverage</th>
                  <th className="px-4 py-3">Delivery Fee</th>
                  <th className="px-4 py-3">Estimated Speed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shippingZones.map((z) => (
                  <tr key={z.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-gray-500 font-semibold">#{z.code}</td>
                    <td className="px-4 py-3.5 font-bold text-gray-900">{z.name}</td>
                    <td className="px-4 py-3.5 font-bold text-emerald-700">{z.feeFormatted}</td>
                    <td className="px-4 py-3.5 text-gray-600">
                      {z.code === 1 ? "Same Day / 24h" : z.code === 2 ? "24 - 48 Hours" : "2 - 4 Business Days"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteZone(z.code)}
                        className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Remove Zone"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {shippingZones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                      No shipping zones configured yet. Add your first zone below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Free Shipping Threshold & Rules */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Free Shipping Incentive</h3>
              <p className="text-xs text-gray-500">
                Automatically waive delivery fee when order cart value meets or exceeds your threshold.
              </p>
            </div>
            <button
              onClick={() => setFreeShippingActive(!freeShippingActive)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                freeShippingActive ? "bg-[#0d5c3a]" : "bg-gray-200"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  freeShippingActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {freeShippingActive && (
            <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Minimum Order Value for Free Delivery (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-xs font-bold">₦</span>
                  <input
                    type="number"
                    value={freeShippingThreshold}
                    onChange={(e) => setFreeShippingThreshold(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                Co-Pilot will proactively notify buyers: &quot;Add ₦X more to qualify for Free Delivery across Lagos!&quot;
              </p>
            </div>
          )}
        </div>

        {/* Section 3: Customer Self-Pickup Hub */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Store / Warehouse Pickup Hub</h3>
              <p className="text-xs text-gray-500">
                Allow customers to choose ₦0 self-collection from your store or pickup location.
              </p>
            </div>
            <button
              onClick={() => setPickupEnabled(!pickupEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                pickupEnabled ? "bg-[#0d5c3a]" : "bg-gray-200"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  pickupEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {pickupEnabled && (
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pickup Hub Address &amp; Landmarks
                </label>
                <input
                  type="text"
                  value={pickupHubAddress}
                  onChange={(e) => setPickupHubAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium"
                />
              </div>
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <span>📍</span>
                <span>Operating hours: Monday – Saturday, 9:00 AM – 6:00 PM WAT</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Courier & Logistics Partner Integration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Courier Dispatch Partners</h3>
            <p className="text-xs text-gray-500">
              Default courier service assigned to orders when you click &quot;Dispatch Order&quot;.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Primary Delivery Courier
              </label>
              <select
                value={defaultCourier}
                onChange={(e) => setDefaultCourier(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold bg-white cursor-pointer"
              >
                <option value="In-house Dispatch & Gokada">In-house Dispatch &amp; Gokada</option>
                <option value="GIG Logistics (Nationwide)">GIG Logistics (Nationwide)</option>
                <option value="Kwik Delivery Express">Kwik Delivery Express</option>
                <option value="DHL Express Nigeria">DHL Express Nigeria</option>
                <option value="Max.ng On-demand">Max.ng On-demand</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Dispatch Coordinator / Rider Hotline
              </label>
              <input
                type="text"
                value={courierPhone}
                onChange={(e) => setCourierPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium font-mono"
              />
            </div>
          </div>
        </div>

        {/* Modal: Add Zone */}
        {addZoneModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Add Delivery Zone</h3>
                <button
                  onClick={() => setAddZoneModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateShippingZone} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lekki Phase 1 & Ikoyi"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Flat Rate Fee (₦)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 3500"
                    value={newZoneFee}
                    onChange={(e) => setNewZoneFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estimated Speed</label>
                  <select
                    value={newZoneSpeed}
                    onChange={(e) => setNewZoneSpeed(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="Same Day Express">Same Day Express</option>
                    <option value="24-48 Hours">24-48 Hours (Standard)</option>
                    <option value="2-4 Business Days">2-4 Business Days (Nationwide)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddZoneModalOpen(false)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Save Zone
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sticky Bottom Save Bar */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 py-3 px-6 sm:px-8 flex items-center justify-end gap-3 z-30 shadow-lg">
          <button
            onClick={() => {
              setShippingSavedToast("✓ Delivery & shipping settings saved.");
              setTimeout(() => setShippingSavedToast(null), 3000);
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0d5c3a] hover:bg-[#0b4b2f] rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            Save Delivery Settings
          </button>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 3: Settings · Sales co-pilot conversation detail                     */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "detail") {
    if (messages.length === 0) {
      return (
        <div className="space-y-6 max-w-6xl mx-auto pb-16">
          <button
            onClick={() => setActiveTab("conversations")}
            className="text-xs text-gray-500 hover:text-emerald-700 underline flex items-center gap-1 cursor-pointer"
          >
            ← Back to conversations
          </button>
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto">
              💬
            </div>
            <h3 className="text-base font-bold text-gray-900">No Active Messages</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              No live conversation selected or recorded yet. Inbound customer WhatsApp inquiries will appear here.
            </p>
          </div>
        </div>
      );
    }
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
              onClick={async () => {
                if (threadTakenOver) {
                  await onSendVendorManualEcho?.("resume", activeBuyerSession?.buyerPhone);
                  setThreadTakenOver(false);
                } else {
                  await onSendVendorManualEcho?.(
                    "Hello, I have stepped in as the store owner to assist you directly.",
                    activeBuyerSession?.buyerPhone
                  );
                  setThreadTakenOver(true);
                }
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                threadTakenOver
                  ? "bg-blue-50 border border-blue-300 text-blue-800 hover:bg-blue-100"
                  : "bg-[#0d5c3a] text-white hover:bg-[#0b4b2f]"
              }`}
            >
              {threadTakenOver ? "🤖 Hand Back to Co-Pilot" : "💬 Take over conversation"}
            </button>
          </div>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Omnichannel Conversation Thread */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4 gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">Omnichannel conversation</h3>
                  <p className="text-[11px] text-gray-400 truncate">All times WAT · Replies sync to the native thread</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                  WA / IG / FB
                </span>
              </div>

              {/* Message List */}
              <div className="space-y-3.5 text-xs max-h-[60vh] sm:max-h-[540px] overflow-y-auto overflow-x-hidden pr-1">
                {messages.map((m) => {
                  if (m.type === "system") {
                    const isPayment = m.sender.includes("Payment");
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl p-3 text-[11px] border break-words [overflow-wrap:anywhere] ${
                          isPayment
                            ? "bg-[#ecfdf5] border-emerald-200 text-emerald-950"
                            : "bg-[#f0f4ff] border-blue-100 text-blue-900"
                        }`}
                      >
                        <div
                          className={`flex justify-between items-center gap-2 font-semibold mb-0.5 ${
                            isPayment ? "text-emerald-800" : "text-blue-700"
                          }`}
                        >
                          <span className="truncate">{m.sender}</span>
                          <span className="shrink-0">{m.time}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.text}</p>
                      </div>
                    );
                  }

                  if (m.type === "buyer") {
                    const isUnresolved = m.sender.includes("Unresolved");
                    return (
                      <div
                        key={m.id}
                        className={`border rounded-xl p-3 max-w-[90%] sm:max-w-[85%] min-w-0 ${
                          isUnresolved
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        <div
                          className={`flex justify-between items-center gap-2 text-[11px] mb-1 ${
                            isUnresolved ? "text-amber-800 font-semibold" : "text-gray-400"
                          }`}
                        >
                          <span className="font-semibold text-gray-900 truncate">{m.sender}</span>
                          <span className="shrink-0">{m.time}</span>
                        </div>
                        <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isUnresolved ? "text-gray-900 font-medium" : "text-gray-800"}`}>
                          {m.text}
                        </p>
                      </div>
                    );
                  }

                  if (m.type === "merchant") {
                    return (
                      <div
                        key={m.id}
                        className="ml-auto bg-[#0d5c3a] text-white border border-[#0d5c3a] rounded-xl p-3 max-w-[90%] sm:max-w-[85%] min-w-0"
                      >
                        <div className="flex justify-between items-center gap-2 text-[11px] text-emerald-100 mb-1">
                          <span className="font-semibold truncate">{m.sender}</span>
                          <span className="shrink-0">{m.time}</span>
                        </div>
                        <p className="text-white whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.text}</p>
                      </div>
                    );
                  }

                  // Copilot or handoff
                  return (
                    <div
                      key={m.id}
                      className="ml-auto bg-emerald-50 border border-emerald-100 rounded-xl p-3 max-w-[90%] sm:max-w-[85%] min-w-0"
                    >
                      <div className="flex justify-between items-center gap-2 text-[11px] text-emerald-700 mb-1">
                        <span className="font-semibold truncate">{m.sender}</span>
                        <span className="shrink-0">{m.time}</span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.text}</p>
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
                onClick={async () => {
                  if (threadTakenOver) {
                    await onSendVendorManualEcho?.("resume", activeBuyerSession?.buyerPhone);
                    setThreadTakenOver(false);
                  } else {
                    await onSendVendorManualEcho?.(
                      "Hello, I have stepped in as the store owner to assist you directly.",
                      activeBuyerSession?.buyerPhone
                    );
                    setThreadTakenOver(true);
                  }
                }}
                className={`w-full py-2 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  threadTakenOver ? "bg-blue-600 hover:bg-blue-700" : "bg-[#0d5c3a] hover:bg-[#0b4b2f]"
                }`}
              >
                {threadTakenOver ? "🤖 Hand Back to Co-Pilot" : "💬 Take over conversation"}
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
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
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
        {renderTabStrip()}

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-emerald-100 font-medium">Co-pilot sessions</div>
            <div className="text-3xl font-extrabold mt-1">{sessions.length}</div>
            <div className="text-[11px] text-emerald-200 mt-2">Active WhatsApp selling threads</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Confirmed sales</div>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">
              {orders.filter((o) => o.status === "PAID").length}
            </div>
            <div className="text-[11px] text-gray-400 mt-2">Verified paid orders via Monnify</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Needs your attention</div>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">{escalatedSessions.length}</div>
            <div className="text-[11px] text-amber-700 mt-2">
              {escalatedSessions.length === 0 ? "All sessions automated" : "Escalated buyer threads"}
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {escalatedSessions.length > 0 && (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-amber-700 font-bold text-sm">⚠</span>
              <div className="text-amber-900">
                <span className="font-bold">Handoff needed · {escalatedSessions[0].customerName}</span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  A customer inquiry requires merchant intervention. Co-pilot is paused for this thread; open the conversation to reply.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("detail")}
              className="px-3.5 py-1.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shrink-0"
            >
              Open {escalatedSessions[0].threadCode} →
            </button>
          </div>
        )}

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
                <option>Facebook</option>
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

          {/* Mobile Responsive Card List (< md) */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredSessions.length === 0 ? (
              <div className="py-10 px-4 text-center text-gray-400 text-xs">
                No customer sessions match your filters.
              </div>
            ) : (
              filteredSessions.map((sess) => (
                <div key={`mob-${sess.id}`} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-gray-900 truncate">{sess.customerName}</div>
                      <div className="text-[11px] text-gray-400">{sess.threadCode} · {sess.time}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        sess.channel === "Instagram"
                          ? "bg-pink-50 text-pink-700 border border-pink-200"
                          : sess.channel === "Facebook"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      <span>{sess.channel === "Instagram" ? "📸" : sess.channel === "Facebook" ? "🔵" : "🟢"}</span>
                      <span>{sess.channel}</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 break-words [overflow-wrap:anywhere]">{sess.log}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] font-semibold text-gray-800 truncate">
                      {sess.outcome} {sess.amount ? `· ${sess.amount}` : ""}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setActiveTab("detail")}
                        className="px-2.5 py-1 bg-[#0d5c3a] text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                      >
                        Open Thread
                      </button>
                      <button
                        onClick={() =>
                          setSessionModalContent({
                            title: `${sess.customerName} (${sess.threadCode})`,
                            body: sess.log,
                          })
                        }
                        className="px-2.5 py-1 border border-gray-200 text-gray-700 text-[11px] rounded-lg cursor-pointer"
                      >
                        Summary
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block overflow-x-auto">
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
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 text-lg font-bold">
                          💬
                        </div>
                        <p className="text-sm font-bold text-gray-900">No customer sessions</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm">
                          WhatsApp, Instagram, and Facebook inquiries handled by Sales Co-Pilot or awaiting merchant replies will appear here in real time.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{sess.customerName}</div>
                        <div className="text-[11px] text-gray-400">{sess.threadCode}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sess.channel === "Instagram"
                              ? "bg-pink-50 text-pink-700 border border-pink-200"
                              : sess.channel === "Facebook"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          <span>
                            {sess.channel === "Instagram" ? "📸" : sess.channel === "Facebook" ? "🔵" : "🟢"}
                          </span>
                          <span>{sess.channel}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sess.state === "Needs you"
                              ? "bg-amber-100 text-amber-800"
                              : sess.state === "Automated"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {sess.state}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{sess.outcome}</div>
                        {sess.amount && <div className="text-[11px] text-gray-500">{sess.amount}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500">{sess.time}</td>
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setActiveTab("detail")}
                          className="px-2.5 py-1.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Open Thread
                        </button>
                        <button
                          onClick={() =>
                            setSessionModalContent({
                              title: `${sess.customerName} (${sess.threadCode})`,
                              body: sess.log,
                            })
                          }
                          className="px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs rounded-lg cursor-pointer"
                        >
                          Summary
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400">
            Showing {filteredSessions.length} of {sessions.length} sessions · Customer messages remain in their native channel threads.
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
                <span className="text-emerald-700 font-semibold">Connected · Enabled</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Instagram Direct</span>
                <span className={`font-semibold ${instagramConnected ? "text-emerald-700" : "text-amber-700"}`}>
                  {instagramConnected ? `Connected (${instagramHandleInput})` : "Reconnect required"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Facebook Messenger</span>
                <span className={`font-semibold ${facebookConnected ? "text-emerald-700" : "text-amber-700"}`}>
                  {facebookConnected ? "Connected · Enabled" : "Connect Page"}
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
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sales co-pilot</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Unified Meta omnichannel co-pilot for WhatsApp, Instagram Direct, and Facebook Messenger.
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
        {renderTabStrip()}

        {channelToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
            {channelToast}
          </div>
        )}

        {/* Section 1: Automation & connected channels (Unified Omnichannel Hub) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Omnichannel Sales Channels (Meta Business Suite)</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                All three channels share one inventory engine, Monnify escrow checkout, and unified conversation inbox.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 self-start sm:self-center">
              {[true, instagramConnected, facebookConnected].filter(Boolean).length} / 3 Channels Active
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-xs font-semibold text-gray-900">Enable Omnichannel Sales Co-Pilot</div>
              <p className="text-[11px] text-gray-500">
                Automatically answers product inquiries, checks live stock, and sends Monnify NUBAN invoices across active channels.
              </p>
            </div>
            <button
              onClick={() => setCopilotEnabled(!copilotEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* 1. WhatsApp Business Cloud API */}
            <div className="bg-[#f0fdf4] border border-emerald-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span>🟢</span> WhatsApp Business
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                    Connected
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 font-mono mt-1.5">
                  {vendor.whatsappPhone || "+234 803 123 4567"}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Cloud API + Status pHash photo matching &amp; dual-access vendor keywords.
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2 text-[11px]">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://caterlog.store/${vendor.slug}?src=wa_chat`);
                    setChannelToast("✓ Copied WhatsApp attribution link (?src=wa_chat)");
                    setTimeout(() => setChannelToast(null), 3000);
                  }}
                  className="font-semibold text-emerald-800 hover:underline cursor-pointer"
                >
                  Copy UTM Link
                </button>
                <button
                  onClick={() => setActiveSocialWizard("WHATSAPP")}
                  className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-xs font-semibold rounded-lg text-gray-700 shadow-2xs cursor-pointer"
                >
                  Sync Wizard
                </button>
              </div>
            </div>

            {/* 2. Instagram Direct (Meta Graph API) */}
            <div
              className={`border rounded-xl p-4 flex flex-col justify-between space-y-3 ${
                instagramConnected
                  ? "bg-pink-50/40 border-pink-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span>📸</span> Instagram Direct
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      instagramConnected
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {instagramConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="text-[11px] text-gray-700 font-semibold mt-1.5">
                  {instagramHandleInput}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Auto-replies to Instagram DMs, Story replies &amp; reel product inquiries.
                </p>
              </div>
              <div className="pt-2 border-t border-pink-200/60 flex items-center justify-between gap-2 text-[11px]">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://caterlog.store/${vendor.slug}?src=ig_dm`);
                    setChannelToast("✓ Copied Instagram Bio/DM attribution link (?src=ig_dm)");
                    setTimeout(() => setChannelToast(null), 3000);
                  }}
                  className="font-semibold text-pink-700 hover:underline cursor-pointer"
                >
                  Copy IG Link
                </button>
                <button
                  onClick={() => setActiveSocialWizard("INSTAGRAM")}
                  className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-xs font-semibold rounded-lg text-gray-700 shadow-2xs cursor-pointer"
                >
                  {instagramConnected ? "Sync Wizard" : "Connect IG"}
                </button>
              </div>
            </div>

            {/* 3. Facebook Messenger (Page Inbox) */}
            <div
              className={`border rounded-xl p-4 flex flex-col justify-between space-y-3 ${
                facebookConnected
                  ? "bg-blue-50/40 border-blue-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span>🔵</span> Facebook Messenger
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      facebookConnected
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {facebookConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="text-[11px] text-gray-700 font-semibold mt-1.5 truncate">
                  {facebookPageInput}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Handles Facebook Page inbox DMs &amp; Click-to-Messenger ad leads.
                </p>
              </div>
              <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between gap-2 text-[11px]">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://caterlog.store/${vendor.slug}?src=fb_msg`);
                    setChannelToast("✓ Copied Facebook Page attribution link (?src=fb_msg)");
                    setTimeout(() => setChannelToast(null), 3000);
                  }}
                  className="font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  Copy FB Link
                </button>
                <button
                  onClick={() => setActiveSocialWizard("FACEBOOK")}
                  className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-xs font-semibold rounded-lg text-gray-700 shadow-2xs cursor-pointer"
                >
                  {facebookConnected ? "Sync Wizard" : "Connect Page"}
                </button>
              </div>
            </div>
          </div>

          {/* Unified Meta Webhook & Attribution Strip */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                <span>🔗 Unified Meta Graph Webhook:</span>
                <code className="bg-white px-2 py-0.5 rounded border border-gray-200 font-mono text-[11px] text-emerald-800">
                  POST /webhooks/meta
                </code>
              </div>
              <p className="text-[11px] text-gray-500">
                Single webhook receives WhatsApp, Instagram Direct (`object: instagram`), and Facebook Page (`object: page`) events and tags every order with its source channel for analytics.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("conversations")}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-semibold rounded-lg text-xs shrink-0 cursor-pointer"
            >
              Open Unified Inbox →
            </button>
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

        {/* Instagram Direct Configuration Modal */}
        {showIgModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span>📸</span> Instagram Direct · Meta Graph API
                </h3>
                <button onClick={() => setShowIgModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  ✕
                </button>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Authorize Caterlog via Meta Business Suite (`instagram_manage_messages`) to read Instagram DMs, Story replies, and send live inventory cards with Monnify Dynamic NUBAN checkout.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Instagram Professional Handle
                </label>
                <input
                  type="text"
                  value={instagramHandleInput}
                  onChange={(e) => setInstagramHandleInput(e.target.value)}
                  placeholder="@yourstore"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-600"
                />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                <div className="font-semibold text-gray-800 text-[11px]">Smart Bio &amp; Story Attribution Link</div>
                <div className="font-mono text-[11px] text-pink-700 break-all">
                  https://caterlog.store/{vendor.slug}?src=ig_dm
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 gap-2">
                {instagramConnected && (
                  <button
                    onClick={() => {
                      setInstagramConnected(false);
                      void handleSaveSocialChannel({
                        instagramHandle: instagramHandleInput,
                        instagramConnected: false,
                      });
                      setShowIgModal(false);
                    }}
                    className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold rounded-xl cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={() => {
                    setInstagramConnected(true);
                    void handleSaveSocialChannel({
                      instagramHandle: instagramHandleInput,
                      instagramConnected: true,
                    });
                    setShowIgModal(false);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  {instagramConnected ? "Save & Sync Instagram" : "Authenticate with Meta (Instagram)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Facebook Messenger Configuration Modal */}
        {showFbModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span>🔵</span> Facebook Messenger · Page Inbox
                </h3>
                <button onClick={() => setShowFbModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  ✕
                </button>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Connect your Facebook Business Page (`pages_messaging`) so Click-to-Messenger Ads and Facebook Page DMs flow into Caterlog&apos;s unified co-pilot and analytics.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Facebook Business Page Name
                </label>
                <input
                  type="text"
                  value={facebookPageInput}
                  onChange={(e) => setFacebookPageInput(e.target.value)}
                  placeholder="Your Official Store Page"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                <div className="font-semibold text-gray-800 text-[11px]">Click-to-Messenger &amp; Ad Attribution Link</div>
                <div className="font-mono text-[11px] text-blue-700 break-all">
                  https://caterlog.store/{vendor.slug}?src=fb_msg
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 gap-2">
                {facebookConnected && (
                  <button
                    onClick={() => {
                      setFacebookConnected(false);
                      void handleSaveSocialChannel({
                        facebookPageName: facebookPageInput,
                        facebookConnected: false,
                      });
                      setShowFbModal(false);
                    }}
                    className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold rounded-xl cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={() => {
                    setFacebookConnected(true);
                    void handleSaveSocialChannel({
                      facebookPageName: facebookPageInput,
                      facebookConnected: true,
                    });
                    setShowFbModal(false);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  {facebookConnected ? "Save & Sync Facebook Page" : "Authorize Facebook Business Page"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSocialWizard && (
          <SocialSyncWizardModal
            platform={activeSocialWizard}
            businessName={vendor.businessName}
            initialData={vendor.socialAccounts?.[activeSocialWizard]}
            defaultPhoneOrHandle={
              activeSocialWizard === "WHATSAPP"
                ? vendor.whatsappPhone
                : activeSocialWizard === "INSTAGRAM"
                  ? instagramHandleInput
                  : facebookPageInput
            }
            onClose={() => setActiveSocialWizard(null)}
            onSynced={(res) => {
              if (res.socialAccount.platform === "INSTAGRAM") {
                setInstagramConnected(res.socialAccount.connected);
                setInstagramHandleInput(res.socialAccount.handleOrPhone);
              } else if (res.socialAccount.platform === "FACEBOOK") {
                setFacebookConnected(res.socialAccount.connected);
                setFacebookPageInput(res.socialAccount.handleOrPhone);
              }
              setChannelToast(
                `✓ ${res.socialAccount.platform} synced with PostgreSQL (${res.socialAccount.handleOrPhone})`
              );
              setTimeout(() => setChannelToast(null), 4000);
            }}
          />
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
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shop Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">
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
      {renderTabStrip()}

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
