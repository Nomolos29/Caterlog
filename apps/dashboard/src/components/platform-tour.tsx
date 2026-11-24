"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { PlatformRole } from "@/lib/types";
import type { NavView } from "./sidebar";
import type { StaffRole } from "./views/team-view";

export interface TourStep {
  id: string;
  selector: string;
  targetView: NavView;
  chapter: NavView;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  blueprint: string[];
  whyItMatters: string;
  proTip?: string;
  actionLabel?: string;
  isSimulatorAction?: boolean;
  icon: string;
  preferredPlacement?: "bottom" | "top" | "right" | "left" | "auto";
}

export type TourPersonaKey =
  | "owner-pro"
  | "owner-growth"
  | "owner-starter"
  | "owner-reseller"
  | "staff-dispatch"
  | "staff-catalog"
  | "staff-accountant"
  | "staff-attendant";

interface PlatformTourProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace: PlatformRole;
  impersonatedStaffRole?: StaffRole | null;
  vendorName?: string;
  onNavigate: (view: NavView) => void;
  onOpenSimulator?: () => void;
  initialChapter?: NavView | null;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const CHAPTER_CONFIG: Array<{
  id: NavView;
  label: string;
  icon: string;
  shortLabel: string;
}> = [
  { id: "overview", label: "Overview & Setup", icon: "🏠", shortLabel: "Overview" },
  { id: "orders", label: "Orders & Fulfillment", icon: "📦", shortLabel: "Orders" },
  { id: "products", label: "Products & Stock", icon: "🛍️", shortLabel: "Catalog" },
  { id: "bookings", label: "Wholesale Bookings", icon: "📋", shortLabel: "Bookings" },
  { id: "network", label: "Distribution Network", icon: "🌐", shortLabel: "Network" },
  { id: "analytics", label: "4-Pillar Commercial Analytics", icon: "📈", shortLabel: "Analytics" },
  { id: "payments", label: "Payments & Escrow", icon: "💳", shortLabel: "Payments" },
  { id: "team", label: "Team & Sub-Accounts", icon: "👥", shortLabel: "Team" },
];

export const PERSONA_OPTIONS: Array<{
  key: TourPersonaKey;
  label: string;
  roleBadge: string;
  type: "OWNER" | "STAFF";
  badgeClass: string;
}> = [
  {
    key: "owner-pro",
    label: "👑 Pro Concierge ($20/mo)",
    roleBadge: "Owner · Pro",
    type: "OWNER",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-200",
  },
  {
    key: "owner-growth",
    label: "👑 Growth Vendor ($15/mo)",
    roleBadge: "Owner · Growth",
    type: "OWNER",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  {
    key: "owner-starter",
    label: "👑 Starter Vendor ($10/mo)",
    roleBadge: "Owner · Starter",
    type: "OWNER",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
  },
  {
    key: "owner-reseller",
    label: "👑 Reseller Partner ($5/mo)",
    roleBadge: "Owner · Reseller",
    type: "OWNER",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-200",
  },
  {
    key: "staff-dispatch",
    label: "🚚 Dispatch Coordinator",
    roleBadge: "Staff · Dispatch",
    type: "STAFF",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-200",
  },
  {
    key: "staff-catalog",
    label: "🏷️ Catalog Editor",
    roleBadge: "Staff · Catalog",
    type: "STAFF",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-200",
  },
  {
    key: "staff-accountant",
    label: "📊 Store Accountant",
    roleBadge: "Staff · Finance",
    type: "STAFF",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  {
    key: "staff-attendant",
    label: "🛎️ Store Attendant",
    roleBadge: "Staff · Care",
    type: "STAFF",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
  },
];

// In-Depth Chapter-Based Teaching Curriculum
function getAllTourSteps(
  activeWorkspace: PlatformRole,
  selectedPersona: TourPersonaKey
): TourStep[] {
  const isPro = activeWorkspace === "pro" || selectedPersona === "owner-pro";
  const isReseller = activeWorkspace === "reseller" || selectedPersona === "owner-reseller";
  const isStaff = selectedPersona.startsWith("staff-");

  const steps: TourStep[] = [
    // =========================================================================
    // 1. OVERVIEW CHAPTER
    // =========================================================================
    {
      id: "ov-role-switcher",
      selector: '[data-tour="top-role-switcher"]',
      targetView: "overview",
      chapter: "overview",
      preferredPlacement: "bottom",
      category: "Platform Architecture",
      icon: "👑",
      title: "Platform Workspace & Plan Selector",
      subtitle: "Switch seamlessly between all 4 subscription tiers",
      description:
        "Caterlog dynamically shapes navigation, reseller split rules, wholesale booking pipelines, and team permission seats based on your active role. Test other tiers anytime to see how suppliers or resellers experience your store.",
      whyItMatters:
        "In Nigeria's fragmented commerce ecosystem, merchants often act as retailers, dropshippers, or master distributors. Caterlog lets you switch or simulate any persona without creating multiple logins.",
      blueprint: [
        "Click the Role pill in the top header (or the 4-role switcher in the sidebar footer).",
        "Select Reseller ($5), Starter ($10), Growth ($15), or Pro ($20) to see menus and tools adapt instantly.",
        "Notice how sub-account managers (Dispatch, Catalog, Accountant) only see screens scoped to their exact job function.",
      ],
      proTip:
        "Pro ($20) unlocks custom wholesale advance bookings, 3 daily pickup sweeps, and dedicated concierge support.",
      actionLabel: "Try Switching Role",
    },
    {
      id: "ov-simulator",
      selector: '[data-tour="top-simulator-btn"]',
      targetView: "overview",
      chapter: "overview",
      preferredPlacement: "bottom",
      category: "Omnichannel Engine",
      icon: "💬",
      title: "Omnichannel Live Simulator",
      subtitle: "WhatsApp Business, Instagram Direct & Facebook Messenger",
      description:
        "Experience exactly what your buyers see when chatting with your store. Sales Co-Pilot answers catalog queries, locks stock for 15 minutes, and delivers a dedicated Monnify NUBAN account number.",
      whyItMatters:
        "Cash-on-Delivery (COD) suffers a 35-40% rejection rate in Nigeria. Caterlog's pre-paid Monnify Dynamic NUBAN transfer flow verifies payment before dispatch, cutting delivery losses to near zero.",
      blueprint: [
        "Click 'Omnichannel Simulator' to open the interactive live phone mockup.",
        "Type '#CL-1042' or ask 'Is size 42 available?' to see the bot reply within 60 seconds.",
        "Click 'Simulate Transfer' to see payment reconcile and stream directly into your orders table.",
      ],
      proTip:
        "Sales Co-Pilot detects when you type manually on WhatsApp and automatically pauses so you never conflict with your staff.",
      isSimulatorAction: true,
      actionLabel: "Launch Omnichannel Simulator",
    },
    {
      id: "ov-kpi-grid",
      selector: '[data-tour="overview-kpi-grid"]',
      targetView: "overview",
      chapter: "overview",
      preferredPlacement: "bottom",
      category: "Live Store Pulse",
      icon: "📊",
      title: "Top Commercial KPI Cards",
      subtitle: "Total Revenue, Pending Verification, Paid & Out for Delivery",
      description:
        "Interactive metrics updated in real time via Neon PostgreSQL websockets. Tap any metric card to filter orders or jump straight into the settlement ledger.",
      whyItMatters:
        "Knowing how much cash is locked in delivery vs. settled in your bank keeps your working capital healthy when fulfilling large volumes.",
      blueprint: [
        "Click 'Total Revenue' to inspect your verified Monnify transfer ledger.",
        "Click 'Pending' to view buyers currently inside their 15-minute payment window.",
        "Click 'Paid' to see orders cleared and ready for rider waybills.",
      ],
      proTip:
        "Orders staying in 'Pending' longer than 15 minutes automatically expire and restock the catalog.",
      actionLabel: "Inspect Overview KPIs",
    },

    // =========================================================================
    // 2. ORDERS & FULFILLMENT CHAPTER
    // =========================================================================
    {
      id: "ord-status-tabs",
      selector: '[data-tour="orders-status-tabs"]',
      targetView: "orders",
      chapter: "orders",
      preferredPlacement: "bottom",
      category: "Fulfillment Pipeline",
      icon: "📦",
      title: "Order Lifecycle & Status Pipeline",
      subtitle: "From RESERVED (15m hold) → PAID → OUT_FOR_DELIVERY → FULFILLED",
      description:
        "Filter orders by their real-time state. Only orders marked 'PAID' should ever be packaged and handed to dispatch couriers.",
      whyItMatters:
        "Never release inventory on a screenshot receipt. Caterlog only marks an order PAID after an HMAC-SHA512 verified Monnify bank webhook confirms cleared funds in your escrow account.",
      blueprint: [
        "Click the 'Paid' tab to view verified orders ready for packaging.",
        "Click 'Processing' or 'Out for Delivery' to track couriers currently on the road.",
        "Inspect 'Pending' to view customers who received a 10-digit NUBAN but haven't sent the transfer.",
      ],
      proTip:
        "Filter by 'PAID' every morning to generate the day's dispatch batch before your courier cutoff time.",
      actionLabel: "Filter Paid Orders",
    },
    {
      id: "ord-table-wrapper",
      selector: '[data-tour="orders-table-wrapper"]',
      targetView: "orders",
      chapter: "orders",
      preferredPlacement: "top",
      category: "Waybill & Delivery Operations",
      icon: "🚚",
      title: "Waybills, Rider WhatsApp Dispatch & Delivery Webhooks",
      subtitle: "Prominent landmark directions & automatic escrow unlock",
      description:
        "Click into any order to view buyer gate phone numbers, landmark directions (e.g., 'Behind Oando filling station, blue gate'), and 1-tap print/WhatsApp waybills.",
      whyItMatters:
        "Dispatch bike riders in Lagos or Abuja don't log into web dashboards. Caterlog generates pre-formatted WhatsApp waybills that you can forward directly to your dispatch driver with one click.",
      blueprint: [
        "Click on any order in the table to open its full fulfillment detail.",
        "Click 'Send Waybill to Rider on WhatsApp' to forward delivery notes with landmark directions.",
        "Enter the rider's phone number to send an automated WhatsApp tracker link to the buyer.",
        "Marking the package 'Delivered' triggers the delivery webhook, instantly converting Trust-Held funds into Liquid Withdrawable Cash.",
      ],
      proTip:
        "Orders including landmark directions have a 98.4% successful first-attempt delivery rate across Lagos and Abuja.",
      actionLabel: "Inspect Orders Table",
    },

    // =========================================================================
    // 3. PRODUCTS & CATALOG CHAPTER
    // =========================================================================
    {
      id: "prod-catalog-header",
      selector: '[data-tour="nav-products"]',
      targetView: "products",
      chapter: "products",
      preferredPlacement: "right",
      category: "Catalog Management",
      icon: "🛍️",
      title: "Digital Inventory & Meta Sync",
      subtitle: "Variants, SKU codes & WhatsApp live sync",
      description:
        "Manage products, variant prices, and live WhatsApp Business catalog synchronization.",
      whyItMatters:
        "Atomic stock reservations prevent social bots from confirming items that are out of stock.",
      blueprint: [
        "Add products with structured SKUs (e.g. SHOE-01, BAG-02).",
        "Upload high-res photos: pHash image recognition matches buyer screenshots on WhatsApp.",
        "Track stock counts: out-of-stock items pause bot sales instantly.",
      ],
      proTip:
        "Listing variant prices clearly reduces back-and-forth chat inquiries by 44%.",
      actionLabel: "Open Product Catalog",
    },
    {
      id: "prod-wholesale-rules",
      selector: '[data-tour="nav-products"]',
      targetView: "products",
      chapter: "products",
      preferredPlacement: "right",
      category: "Wholesale Product Rules",
      icon: "📦",
      title: "Wholesale & Pre-Order Rules",
      subtitle: "1-Click master toggle, category rules & MOQ",
      description:
        "Configure which products bulk buyers can pre-order and reserve with upfront Monnify escrow deposits.",
      whyItMatters:
        "Keeps wholesale pre-orders clearly separated at the product level so retail stock is never disrupted.",
      blueprint: [
        "Use the 1-click master control or select specific categories (Shoes, Bags, Kitchenware).",
        "Set custom minimum booking quantities (MOQ) and required escrow deposit percentages.",
        "Configure product-level booking rules directly inside the product editor modal.",
      ],
      proTip:
        "Advance bookings lock inventory so retail social bots will never oversell wholesale reserves.",
      actionLabel: "Configure Wholesale Rules",
    },
    {
      id: "prod-exceptions",
      selector: '[data-tour="nav-products"]',
      targetView: "products",
      chapter: "products",
      preferredPlacement: "right",
      category: "Inventory Guardrails",
      icon: "⚠️",
      title: "Selling Exceptions & Margin Alerts",
      subtitle: "Low stock warnings and price changes",
      description:
        "Resolve stockouts and supplier cost increases that impact WhatsApp checkout.",
      whyItMatters:
        "Prevents selling items at a loss when supplier wholesale costs fluctuate.",
      blueprint: [
        "Review low-stock SKUs before social orders fail.",
        "Review reseller items where supplier cost increased above your retail price.",
        "Update selling prices with 1 click to restore profit margins.",
      ],
      proTip:
        "Check exceptions every morning to avoid paused checkout threads.",
      actionLabel: "Inspect Exceptions",
    },

    // =========================================================================
    // 4. WHOLESALE BOOKINGS CHAPTER (PRO CONCIERGE $20)
    // =========================================================================
    ...(isPro
      ? [
          {
            id: "bkg-pipeline",
            selector: '[data-tour="bookings-kpi-cards"]',
            targetView: "bookings" as NavView,
            chapter: "bookings" as NavView,
            preferredPlacement: "bottom" as const,
            category: "Wholesale Pipeline",
            icon: "📋",
            title: "Active Wholesale Bookings Pipeline",
            subtitle: "Exclusive to Pro Concierge ($20)",
            description:
              "Track bulk B2B reservations, escrow deposits collected, and fulfillment lead times.",
            whyItMatters:
              "Wholesalers secure large orders with non-refundable deposits before you begin packaging.",
            blueprint: [
              "Review wholesale pre-orders from WhatsApp, Instagram, or trade networks.",
              "Track deposit status (30% Monnify escrow) and balance due on dispatch.",
              "Click '+ New Wholesale Booking' to log manual bulk orders.",
            ],
            proTip:
              "Once an advance deposit clears, inventory is reserved atomically so retail bots never oversell.",
            actionLabel: "Explore Bookings Pipeline",
          },
          {
            id: "bkg-terms",
            selector: '[data-tour="bookings-tabs"]',
            targetView: "bookings" as NavView,
            chapter: "bookings" as NavView,
            preferredPlacement: "bottom" as const,
            category: "Wholesale Policy",
            icon: "📜",
            title: "Wholesale Terms & Escrow Policy",
            subtitle: "Standard deposit % and lead times",
            description:
              "Define default escrow deposit percentages and cancellation rules for bulk orders.",
            whyItMatters:
              "Standard terms protect your working capital against uncollected custom bulk orders.",
            blueprint: [
              "Set standard wholesale deposit percentage (default 30%).",
              "Configure restock lead time windows for bulk buyers.",
              "Configure automatic refund rules if supplier stock is unavailable.",
            ],
            proTip:
              "Nigerian wholesale importers standardly require a 30% advance deposit via Monnify.",
            actionLabel: "Set Wholesale Policy",
          },
        ]
      : []),

    // =========================================================================
    // 5. DISTRIBUTION NETWORK CHAPTER
    // =========================================================================
    {
      id: "net-tabs",
      selector: '[data-tour="network-tabs"]',
      targetView: "network",
      chapter: "network",
      preferredPlacement: "bottom",
      category: "Scale & Distribution",
      icon: "🌐",
      title: "Reseller Sales Reps & Verified Wholesale Suppliers",
      subtitle: "Scale sales reps or mirror verified inventory across Nigeria",
      description:
        "Manage your downstream sales reps (My Resellers) who mirror your products to their contacts, or find upstream verified Nigerian suppliers (Find Suppliers) to expand your catalog with zero capital.",
      whyItMatters:
        "Instead of hiring dozens of in-house salespeople, Caterlog gives you an army of independent resellers who earn commissions while Monnify automatically splits payouts upon delivery.",
      blueprint: [
        "In 'My Resellers', monitor active sales reps, units sold, and geofenced delivery performance.",
        "In 'Find Suppliers', filter by State (Lagos, Abuja, Rivers, Kano) to discover suppliers with same-day dispatch.",
        "Click 'Publish to My Store' to mirror products into your catalog and set your retail markup margin.",
      ],
      proTip:
        "Suppliers receive their wholesale cost price directly to their bank account, while resellers receive their markup margin with zero dispute risk.",
      actionLabel: "Open Network Directory",
    },

    // =========================================================================
    // 6. 4-PILLAR COMMERCIAL ANALYTICS CHAPTER
    // =========================================================================
    {
      id: "ana-pillar-1",
      selector: '[data-tour="analytics-pillar-1"]',
      targetView: "analytics",
      chapter: "analytics",
      preferredPlacement: "top",
      category: "Pillar 1: Cash-Flow Health",
      icon: "💰",
      title: "Financial Health — 'Am I Profitable?'",
      subtitle: "Decimal-Safe Kobo Accounting (money.ts)",
      description:
        "Strict integer-kobo reconciliation of Gross Merchandise Value (GMV), net realized revenue after cost-of-goods-sold, liquid withdrawable bank cash vs. escrow holds, and return-to-origin (RTO) losses.",
      whyItMatters:
        "High sales mean nothing if cash is trapped in rejected deliveries. Pillar 1 separates liquid money you can withdraw right now from funds awaiting courier delivery confirmation.",
      blueprint: [
        "Inspect Liquid Withdrawable Cash vs. Trust-Held Funds awaiting DELIVERED status.",
        "Review Reseller Margin Splits: Total markup earned net of platform fees.",
        "Monitor the Refund & Return-to-Origin (RTO) loss ledger to catch packaging issues early.",
      ],
      proTip:
        "All calculations use integer kobo BigInt arithmetic, preventing floating-point rounding discrepancies with your Monnify bank statement.",
      actionLabel: "Inspect Cash-Flow Ledger",
    },
    {
      id: "ana-pillar-2",
      selector: '[data-tour="analytics-pillar-2"]',
      targetView: "analytics",
      chapter: "analytics",
      preferredPlacement: "top",
      category: "Pillar 2: Conversion Funnel",
      icon: "📉",
      title: "Sales Funnel & Co-Pilot Rescues — 'Where Is Drop-off?'",
      subtitle: "5-origin channels, 15-minute locks & offline rescues",
      description:
        "Analyzes buyer progression across 5 origin channels (WhatsApp Direct, WhatsApp Status Reply, Instagram DM, Facebook Story, Website) and tracks 15-minute reservation lock timeouts.",
      whyItMatters:
        "Most social drop-offs happen when buyers ask for a bank account and the seller takes 20 minutes to reply. Sales Co-Pilot sends a dedicated NUBAN in seconds and saves leads while you are asleep.",
      blueprint: [
        "Track the 3-stage funnel: Inquiries (#CL-CODE triggers) → 15-Min Locks Initiated → Monnify Payments Completed.",
        "Review Expired Lock Rate: See how many orders timed out after 15 minutes without payment.",
        "Inspect Inactivity Co-Pilot Performance: Exact revenue closed autonomously when you were offline.",
      ],
      proTip:
        "Inquiries replying directly to WhatsApp Statuses convert at a 48.6% rate—higher than any other channel.",
      actionLabel: "View Conversion Funnel",
    },
    {
      id: "ana-pillar-3",
      selector: '[data-tour="analytics-pillar-3"]',
      targetView: "analytics",
      chapter: "analytics",
      preferredPlacement: "top",
      category: "Pillar 3: Merchandising",
      icon: "🔥",
      title: "Merchandising Intelligence — 'What Is Moving?'",
      subtitle: "72-Hour New Arrival graduation tracker & 1-click status blasts",
      description:
        "Tracks SKU velocity, stock valuation at cost, and low-stock duration. Evaluates new arrivals inside their 3-day window: items hitting ≥30% conversion auto-graduate to BEST SELLER status.",
      whyItMatters:
        "Dead stock eats working capital. Merchandising alerts flag high-converting 'Hidden Gems' with low visibility so you can blast them to your WhatsApp status with 1 click.",
      blueprint: [
        "Review the 72-Hour Promotion Tracker for newly listed SKUs.",
        "Compare 4-in-1 Best-Seller Collage Grids vs Single Hero Spotlights.",
        "Click 'Queue Status Blast' on any Hidden Gem to push it to your Co-Pilot scheduler.",
      ],
      proTip:
        "4-in-1 Collage Grids generate 28% more chat replies than single product photos on Nigerian WhatsApp statuses.",
      actionLabel: "Explore Merchandising Intel",
    },
    {
      id: "ana-pillar-4",
      selector: '[data-tour="analytics-pillar-4"]',
      targetView: "analytics",
      chapter: "analytics",
      preferredPlacement: "top",
      category: "Pillar 4: Trust Score",
      icon: "⚡",
      title: "Trust Score Progress — 'How Close to Instant Payouts?'",
      subtitle: "Level 1 (Dispatch Release) & Level 2 (0-Second Instant Splits)",
      description:
        "Tracks fulfillment SLA compliance, on-time dispatch rate, dispute rate (<2%), and completed clean orders toward Level 2 instant split settlements.",
      whyItMatters:
        "New stores wait for delivery confirmation before funds release. Highly trusted merchants with clean fulfillment records unlock Level 2: funds settle to your bank account with 0-second delay upon payment.",
      blueprint: [
        "Check your current Trust Score level and on-time dispatch percentage.",
        "Keep your dispute rate under 2.0% by confirming packaging before courier handover.",
        "Complete 30 clean orders to graduate into Level 2 Instant Split Payouts.",
      ],
      proTip:
        "Maintaining a 95%+ on-time dispatch rate unlocks priority courier pickup and instant bank settlements.",
      actionLabel: "Check Trust Score Progress",
    },

    // =========================================================================
    // 7. PAYMENTS & ESCROW CHAPTER
    // =========================================================================
    {
      id: "pay-ledger",
      selector: '[data-tour="nav-payments"]',
      targetView: "payments",
      chapter: "payments",
      preferredPlacement: "right",
      category: "Escrow & Settlements",
      icon: "💳",
      title: "Payments, Dynamic NUBANs & Bank Withdrawals",
      subtitle: "Monnify settlement references, split rules & withdrawals",
      description:
        "Inspect every Monnify dynamic NUBAN bank transfer, verify supplier vs. reseller split payouts, review gateway deductions, and request withdrawals to your Nigerian commercial bank account.",
      whyItMatters:
        "Automated split rules mean you never have to manually calculate commissions or transfer money to suppliers by hand. Monnify disburses each party's exact share automatically.",
      blueprint: [
        "Inspect the payment allocation ledger for every completed order.",
        "Review your withdrawable liquid balance.",
        "Click 'Request Payout' to disburse funds to your verified Nigerian bank account.",
      ],
      proTip:
        "Withdrawal requests initiated before 2:00 PM WAT typically reflect in GTBank, Access, or Zenith accounts within 5 minutes.",
      actionLabel: "Open Payments Ledger",
    },

    // =========================================================================
    // 8. TEAM & SUB-ACCOUNTS CHAPTER
    // =========================================================================
    {
      id: "team-rbac",
      selector: '[data-tour="nav-team"]',
      targetView: "team",
      chapter: "team",
      preferredPlacement: "right",
      category: "Role-Based Access Control",
      icon: "👥",
      title: "Team Permissions & Sub-Account Delegation",
      subtitle: "Dispatch Coordinator, Catalog Editor, Accountant & Store Attendant",
      description:
        "Invite staff members and assign them scoped roles. Keep your bank credentials, wholesale profit margins, and owner settings safe while your team handles packing, stock, or customer support.",
      whyItMatters:
        "Store owners shouldn't be packing orders or uploading 50 shoe variants themselves. Sub-accounts allow staff to fulfill orders without seeing your private banking or business financials.",
      blueprint: [
        "Invite staff via email or phone and assign their exact role.",
        "Test role impersonation using the amber banner at the top of the screen to verify what your staff sees.",
        "Dispatch Coordinators see only fulfillment; Catalog Editors see only stock; Accountants see only financials.",
      ],
      proTip:
        "Use the 'Impersonate Staff' dropdown anytime to audit what your team sees before their first day on the job.",
      actionLabel: "Manage Team & Roles",
    },
  ];

  return steps;
}

export function PlatformTourGuide({
  isOpen,
  onClose,
  activeWorkspace,
  impersonatedStaffRole,
  vendorName,
  onNavigate,
  onOpenSimulator,
  initialChapter,
}: PlatformTourProps) {
  const [selectedPersona, setSelectedPersona] = useState<TourPersonaKey>(() => {
    if (impersonatedStaffRole === "Dispatch Coordinator") return "staff-dispatch";
    if (impersonatedStaffRole === "Catalog Editor") return "staff-catalog";
    if (impersonatedStaffRole === "Accountant") return "staff-accountant";
    if (impersonatedStaffRole === "Store Attendant") return "staff-attendant";
    if (activeWorkspace === "reseller") return "owner-reseller";
    if (activeWorkspace === "starter") return "owner-starter";
    if (activeWorkspace === "growth") return "owner-growth";
    return "owner-pro";
  });

  const allSteps = getAllTourSteps(activeWorkspace, selectedPersona);

  // Group steps by view chapter
  const [activeChapter, setActiveChapter] = useState<NavView>(initialChapter || "overview");
  const [stepIndexInChapter, setStepIndexInChapter] = useState(0);

  // Sync initialChapter if opened from view guide button
  useEffect(() => {
    if (initialChapter) {
      setActiveChapter(initialChapter);
      setStepIndexInChapter(0);
    }
  }, [initialChapter, isOpen]);

  // Steps filtered to the active chapter
  const chapterSteps = allSteps.filter((s) => s.chapter === activeChapter);
  const currentStep =
    chapterSteps[Math.min(stepIndexInChapter, Math.max(0, chapterSteps.length - 1))] ||
    allSteps[0];

  // Global index for full progress tracking
  const globalStepIndex = allSteps.findIndex((s) => s.id === currentStep?.id);
  const totalGlobalSteps = allSteps.length;

  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [targetFound, setTargetFound] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Measure and lock onto target element
  const updateSpotlight = useCallback(() => {
    if (!isOpen || !currentStep) return;

    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      setTargetFound(true);

      // Smoothly scroll element into view if offscreen
      if (
        rect.top < 70 ||
        rect.bottom > window.innerHeight - 70 ||
        rect.left < 20 ||
        rect.right > window.innerWidth - 20
      ) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    } else {
      setSpotlightRect(null);
      setTargetFound(false);
    }
  }, [isOpen, currentStep]);

  // Navigate view when currentStep changes and recalculate position
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    if (currentStep.targetView) {
      onNavigate(currentStep.targetView);
    }

    // Try finding element immediately, and retry for 1.2s to handle view transitions
    updateSpotlight();
    const interval = setInterval(updateSpotlight, 100);
    const timeout = setTimeout(() => clearInterval(interval), 1400);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isOpen, currentStep, onNavigate, updateSpotlight]);

  // Window resize & scroll listeners to keep spotlight anchored
  useEffect(() => {
    if (!isOpen) return;

    const handleResizeOrScroll = () => {
      updateSpotlight();
    };

    window.addEventListener("resize", handleResizeOrScroll, { passive: true });
    window.addEventListener("scroll", handleResizeOrScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, { capture: true });
    };
  }, [isOpen, updateSpotlight]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNextStep();
      } else if (e.key === "ArrowLeft") {
        handlePrevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleNextStep = () => {
    if (stepIndexInChapter < chapterSteps.length - 1) {
      setStepIndexInChapter((i) => i + 1);
    } else {
      // Advance to next chapter
      const availChapters = CHAPTER_CONFIG.filter((c) =>
        allSteps.some((s) => s.chapter === c.id)
      );
      const currentChapterIdx = availChapters.findIndex((c) => c.id === activeChapter);
      if (currentChapterIdx < availChapters.length - 1) {
        const nextChapter = availChapters[currentChapterIdx + 1];
        setActiveChapter(nextChapter.id);
        setStepIndexInChapter(0);
        onNavigate(nextChapter.id);
      } else {
        onClose();
      }
    }
  };

  const handlePrevStep = () => {
    if (stepIndexInChapter > 0) {
      setStepIndexInChapter((i) => i - 1);
    } else {
      // Go to previous chapter
      const availChapters = CHAPTER_CONFIG.filter((c) =>
        allSteps.some((s) => s.chapter === c.id)
      );
      const currentChapterIdx = availChapters.findIndex((c) => c.id === activeChapter);
      if (currentChapterIdx > 0) {
        const prevChapter = availChapters[currentChapterIdx - 1];
        setActiveChapter(prevChapter.id);
        const prevSteps = allSteps.filter((s) => s.chapter === prevChapter.id);
        setStepIndexInChapter(Math.max(0, prevSteps.length - 1));
        onNavigate(prevChapter.id);
      }
    }
  };

  const handleSelectChapter = (chapterId: NavView) => {
    setActiveChapter(chapterId);
    setStepIndexInChapter(0);
    onNavigate(chapterId);
  };

  const handleActionClick = () => {
    if (currentStep.isSimulatorAction && onOpenSimulator) {
      onOpenSimulator();
      onClose();
      return;
    }
    if (currentStep.targetView) {
      onNavigate(currentStep.targetView);
    }
    updateSpotlight();
  };

  if (!isOpen || !currentStep) return null;

  const activePersonaMeta =
    PERSONA_OPTIONS.find((p) => p.key === selectedPersona) || PERSONA_OPTIONS[0];

  // Card Positioning Calculation
  let cardStyle: React.CSSProperties = {};
  let placement = currentStep.preferredPlacement || "bottom";

  if (spotlightRect && typeof window !== "undefined") {
    const cardWidth = Math.min(460, window.innerWidth - 32);
    const cardEstHeight = 520;
    const padding = 16;
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      cardStyle = {
        position: "fixed",
        bottom: "16px",
        left: "16px",
        right: "16px",
        maxWidth: "480px",
        margin: "0 auto",
        zIndex: 60,
      };
    } else {
      let top = 0;
      let left = 0;

      if (placement === "bottom") {
        top = spotlightRect.top + spotlightRect.height + padding;
        left = spotlightRect.left + spotlightRect.width / 2 - cardWidth / 2;

        if (top + cardEstHeight > window.innerHeight - 20) {
          top = Math.max(20, spotlightRect.top - cardEstHeight - padding);
          placement = "top";
        }
      } else if (placement === "right") {
        left = spotlightRect.left + spotlightRect.width + padding;
        top = Math.max(20, spotlightRect.top - 20);

        if (left + cardWidth > window.innerWidth - 20) {
          left = Math.max(20, spotlightRect.left - cardWidth - padding);
          placement = "left";
        }
      } else if (placement === "top") {
        top = Math.max(20, spotlightRect.top - cardEstHeight - padding);
        left = spotlightRect.left + spotlightRect.width / 2 - cardWidth / 2;
      } else {
        left = Math.max(20, spotlightRect.left - cardWidth - padding);
        top = Math.max(20, spotlightRect.top - 20);
      }

      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));
      top = Math.max(16, Math.min(window.innerHeight - cardEstHeight - 16, top));

      cardStyle = {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${cardWidth}px`,
        zIndex: 60,
        transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
      };
    }
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "calc(100vw - 32px)",
      maxWidth: "480px",
      zIndex: 60,
      transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
    };
  }

  // Filter accessible chapters for this persona
  const availableChapters = CHAPTER_CONFIG.filter((c) =>
    allSteps.some((s) => s.chapter === c.id)
  );

  return (
    <>
      {/* 1. DARK BACKDROP WITH SMOOTH CUT-OUT SPOTLIGHT HOLE */}
      <div className="fixed inset-0 z-50 pointer-events-none transition-all duration-300">
        <svg className="w-full h-full pointer-events-none">
          <defs>
            <mask id="tour-spotlight-cutout">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightRect && (
                <rect
                  x={Math.max(0, spotlightRect.left - 6)}
                  y={Math.max(0, spotlightRect.top - 6)}
                  width={spotlightRect.width + 12}
                  height={spotlightRect.height + 12}
                  rx="14"
                  fill="black"
                  style={{ transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(8, 14, 28, 0.74)"
            mask="url(#tour-spotlight-cutout)"
            className="pointer-events-auto"
            onClick={onClose}
          />
        </svg>
      </div>

      {/* 2. SMOOTH GLOWING PULSE BOX + INTERACTIVE CLICK BEACON OVER TARGET ELEMENT */}
      {spotlightRect && (
        <div
          style={{
            top: `${Math.max(0, spotlightRect.top - 6)}px`,
            left: `${Math.max(0, spotlightRect.left - 6)}px`,
            width: `${spotlightRect.width + 12}px`,
            height: `${spotlightRect.height + 12}px`,
            transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="fixed pointer-events-none z-50 rounded-2xl ring-4 ring-emerald-400 ring-offset-2 ring-offset-emerald-950/40 shadow-[0_0_40px_rgba(16,185,129,0.55)]"
        >
          {/* Concentric Ripple Ping Effect */}
          <div className="absolute inset-0 rounded-2xl ring-4 ring-emerald-400 animate-ping opacity-40 pointer-events-none" />

          {/* Animated Interactive Click Beacon */}
          <div className="absolute -top-3.5 -right-3 z-50 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xl animate-bounce pointer-events-none">
            <span>👆</span>
            <span>Click to interact</span>
          </div>
        </div>
      )}

      {/* 3. TETHERED IN-DEPTH EDUCATIONAL TOUR CARD */}
      <div
        ref={cardRef}
        style={cardStyle}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[88dvh] pointer-events-auto animate-in zoom-in-95 duration-200"
      >
        {/* Top Header with Learning Chapter Tabs */}
        <div className="bg-gradient-to-r from-[#0d5c3a] via-[#09472c] to-[#052b1b] text-white p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base">🧭</span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 truncate">
                Interactive Platform Guide &amp; Master Playbook
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Persona Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-emerald-100 text-[10px] font-bold border border-white/20 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Switch Role Learning Path"
                >
                  <span className="truncate max-w-[130px]">{activePersonaMeta.roleBadge}</span>
                  <span className="text-[8px] opacity-75">▼</span>
                </button>

                {personaMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white text-gray-900 rounded-xl shadow-2xl border border-gray-200 p-1.5 z-70 animate-in fade-in duration-100">
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      Select Role Learning Curriculum
                    </div>
                    <div className="space-y-0.5 max-h-56 overflow-y-auto pt-1">
                      {PERSONA_OPTIONS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            setSelectedPersona(p.key);
                            setPersonaMenuOpen(false);
                            setStepIndexInChapter(0);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                            selectedPersona === p.key
                              ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200"
                              : "hover:bg-gray-100 text-gray-700"
                          }`}
                        >
                          <span>{p.label}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              p.type === "OWNER"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {p.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer transition-colors"
                title="Exit tour (ESC)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* View / Chapter Jump Tabs Strip (Grouped Per View) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
            {availableChapters.map((ch) => {
              const isCurrent = activeChapter === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChapter(ch.id)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-emerald-400 text-emerald-950 shadow-xs font-black"
                      : "bg-white/10 hover:bg-white/20 text-white/90"
                  }`}
                  title={`Jump to ${ch.label} tutorial`}
                >
                  <span>{ch.icon}</span>
                  <span>{ch.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Chapter Step Counter & Sub-Category */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/15">
            <span className="text-[11px] font-bold text-emerald-200 truncate">
              {currentStep.category}
            </span>
            <span className="text-[11px] font-semibold text-white/90 font-mono shrink-0">
              Step {stepIndexInChapter + 1} of {chapterSteps.length} in {activeChapter}
            </span>
          </div>
        </div>

        {/* Compact Micro-Concern Teaching Card */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-gray-800 text-xs">
          {/* Target Element Missing / In Transition Banner */}
          {!targetFound && (
            <div className="p-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-xs flex items-center gap-2">
              <span className="animate-spin text-sm">⏳</span>
              <span>Navigating to view: <strong>{currentStep.targetView}</strong>...</span>
            </div>
          )}

          {/* Compact Step Header */}
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg shrink-0">
              {currentStep.icon}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-950 leading-tight">
                {currentStep.title}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {currentStep.subtitle}
              </p>
            </div>
          </div>

          {/* 1-Sentence Concern Overview */}
          <p className="text-xs text-gray-600 leading-snug">
            {currentStep.description}
          </p>

          {/* Key Actions Checklist */}
          <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Key Actions:
            </div>
            <ul className="space-y-1 text-xs text-gray-800">
              {currentStep.blueprint.map((stepText, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-emerald-700 font-bold shrink-0">•</span>
                  <span>{stepText}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Merchant Tip */}
          {currentStep.proTip && (
            <div className="p-2 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-emerald-950 text-[11px] flex items-start gap-1.5">
              <span className="shrink-0 text-xs">💡</span>
              <span className="leading-snug">{currentStep.proTip}</span>
            </div>
          )}

          {/* Action Button */}
          {currentStep.actionLabel && (
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full py-2 px-3 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-98"
            >
              <span>{currentStep.actionLabel}</span>
              <span className="text-sm">→</span>
            </button>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
          {/* Chapter Step Dots */}
          <div className="flex items-center gap-1.5">
            {chapterSteps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndexInChapter(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === stepIndexInChapter
                    ? "w-5 bg-[#0d5c3a]"
                    : "w-2 bg-gray-300 hover:bg-gray-400"
                }`}
                title={`Step ${idx + 1}: ${s.title}`}
              />
            ))}
          </div>

          {/* Previous / Next Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 cursor-pointer transition-colors"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              className="px-4 py-1.5 rounded-lg bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-bold cursor-pointer shadow-2xs transition-all active:scale-95"
            >
              {stepIndexInChapter < chapterSteps.length - 1
                ? "Next Step →"
                : "Next Chapter →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
