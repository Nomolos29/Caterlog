/**
 * Pure Domain Logic: Order State Machine, Pricing & Payment Reconciliation Rules.
 * Principle 10.1 & 10.2: Zero knowledge of presentation or HTTP/WhatsApp transports.
 */

export type DomainOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PROCESSING"
  | "OUT_FOR_DELIVERY"
  | "FULFILLED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

const ALLOWED_TRANSITIONS: Record<DomainOrderStatus, readonly DomainOrderStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PARTIALLY_PAID", "PAID", "EXPIRED", "CANCELLED"],
  PARTIALLY_PAID: ["PARTIALLY_PAID", "PAID", "EXPIRED", "CANCELLED", "REFUNDED"],
  PAID: ["PROCESSING", "OUT_FOR_DELIVERY", "FULFILLED", "REFUNDED"],
  PROCESSING: ["OUT_FOR_DELIVERY", "FULFILLED", "REFUNDED"],
  OUT_FOR_DELIVERY: ["FULFILLED", "REFUNDED"],
  FULFILLED: ["REFUNDED"],
  EXPIRED: ["PAID", "PARTIALLY_PAID"], // Handles late bank transfer arriving just after 15m timer
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionOrderStatus(
  from: DomainOrderStatus,
  to: DomainOrderStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidOrderTransition(
  from: DomainOrderStatus,
  to: DomainOrderStatus
): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`Invalid order state transition from "${from}" to "${to}".`);
  }
}

export interface DiscountCalculationInput {
  subtotalKobo: bigint;
  discountType: "PERCENTAGE" | "FLAT_KOBO";
  /** If PERCENTAGE: basis points (1000 = 10.00%). If FLAT_KOBO: kobo amount */
  discountValue: bigint;
  minOrderKobo: bigint;
}

/**
 * Computes exact discount amount in integer Kobo without floating-point errors.
 */
export function computeDiscountKobo(input: DiscountCalculationInput): bigint {
  if (input.subtotalKobo < input.minOrderKobo) {
    return 0n;
  }
  let rawDiscount = 0n;
  if (input.discountType === "PERCENTAGE") {
    // 10000 basis points = 100%
    rawDiscount = (input.subtotalKobo * input.discountValue) / 10000n;
  } else {
    rawDiscount = input.discountValue;
  }
  return rawDiscount > input.subtotalKobo ? input.subtotalKobo : rawDiscount;
}

export interface OrderPricingBreakdown {
  subtotalKobo: bigint;
  shippingFeeKobo: bigint;
  discountAmountKobo: bigint;
  totalAmountKobo: bigint;
}

export function computeOrderTotalKobo(params: {
  subtotalKobo: bigint;
  shippingFeeKobo: bigint;
  discountAmountKobo: bigint;
}): OrderPricingBreakdown {
  const discountedSubtotal =
    params.subtotalKobo > params.discountAmountKobo
      ? params.subtotalKobo - params.discountAmountKobo
      : 0n;
  const totalAmountKobo = discountedSubtotal + params.shippingFeeKobo;

  return {
    subtotalKobo: params.subtotalKobo,
    shippingFeeKobo: params.shippingFeeKobo,
    discountAmountKobo: params.discountAmountKobo,
    totalAmountKobo,
  };
}

export interface ReconciliationDecision {
  nextStatus: "PARTIALLY_PAID" | "PAID";
  newAmountPaidKobo: bigint;
  remainingBalanceKobo: bigint;
  overpaidAmountKobo: bigint;
  shouldConsumeStockReservation: boolean;
}

/**
 * Evaluates a server-verified payment against an order's expected total.
 * Handles exact payments, partial transfers (e.g., buyer forgot shipping fee), and overpayments.
 */
export function evaluatePaymentReconciliation(params: {
  totalAmountKobo: bigint;
  previousAmountPaidKobo: bigint;
  verifiedIncomingKobo: bigint;
}): ReconciliationDecision {
  if (params.verifiedIncomingKobo <= 0n) {
    throw new Error("Verified incoming payment amount must be greater than 0 kobo.");
  }

  const newAmountPaidKobo = params.previousAmountPaidKobo + params.verifiedIncomingKobo;

  if (newAmountPaidKobo >= params.totalAmountKobo) {
    return {
      nextStatus: "PAID",
      newAmountPaidKobo,
      remainingBalanceKobo: 0n,
      overpaidAmountKobo: newAmountPaidKobo - params.totalAmountKobo,
      shouldConsumeStockReservation: true,
    };
  }

  return {
    nextStatus: "PARTIALLY_PAID",
    newAmountPaidKobo,
    remainingBalanceKobo: params.totalAmountKobo - newAmountPaidKobo,
    overpaidAmountKobo: 0n,
    shouldConsumeStockReservation: false,
  };
}

