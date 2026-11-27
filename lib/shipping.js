// Single source of truth for shipping.
// Used by BOTH:
//   - POST /api/admin/settings   (checkout page shipping estimate)
//   - buildOrderItemsAndTotals   (amount charged through Razorpay / stored on the order)
//
// Rules:
//   1. Each product can override shipping (product.shipping):
//        - state rule for the customer's state (if mode != 'default'), else
//        - the product's own mode: 'default' | 'free' | 'fixed' (fee per piece)
//   2. 'free' items add nothing and their weight is excluded.
//      'fixed' items add fee * qty and their weight is excluded.
//      'default' items (and combos / items without `lines`) are charged by
//      weight (state rate > global rate, ceil to whole kg, flat
//      defaultShippingCharge fallback).
//   3. If freeShippingAbove > 0 and subtotal >= freeShippingAbove -> whole order free.
//
// `lines` is optional: [{ product: { weight, shipping }, qty }].
// Without it, behaviour is identical to the old calculator.

const norm = (s) => String(s || '').trim().toLowerCase();

export function findStateRule(settings, state) {
  const key = norm(state);
  if (!key || !Array.isArray(settings?.stateShipping)) return null;
  return settings.stateShipping.find((r) => norm(r.state) === key) || null;
}

// What shipping mode applies to this product for this state?
export function resolveProductShipping(product, state) {
  const s = product?.shipping;
  if (!s) return { mode: 'default', fee: 0 };

  const key = norm(state);
  const rule =
    key && Array.isArray(s.stateRules)
      ? s.stateRules.find((r) => norm(r.state) === key)
      : null;

  if (rule && rule.mode && rule.mode !== 'default') {
    return { mode: rule.mode, fee: Number(rule.fee) || 0 };
  }
  return { mode: s.mode || 'default', fee: Number(s.fee) || 0 };
}

export function calculateShipping(settings, { subtotal, totalQty, totalWeightGrams, state, lines }) {
  const rule = findStateRule(settings, state);

  const weightPerPiece = Number(settings?.weightPerPiece) || 0; // fallback grams
  const globalPricePerKg = Number(settings?.pricePerKg) || 0;
  const globalFreeAbove = Number(settings?.freeShippingAbove) || 0;
  const defaultShippingCharge = Number(settings?.defaultShippingCharge) || 0;
  const qty = Number(totalQty) || 0;

  const pricePerKg = Number(rule?.pricePerKg) > 0 ? Number(rule.pricePerKg) : globalPricePerKg;
  const freeShippingAbove =
    Number(rule?.freeShippingAbove) > 0 ? Number(rule.freeShippingAbove) : globalFreeAbove;

  const totalWeight =
    totalWeightGrams !== undefined && totalWeightGrams !== null
      ? Number(totalWeightGrams) || 0
      : qty * weightPerPiece;

  // ---- Split the cart into default / fixed / free ----
  const linesUsed = Array.isArray(lines) && lines.length > 0;
  let defaultQty = qty;
  let defaultWeight = totalWeight;
  let fixedCost = 0;
  let fixedQty = 0;
  let freeQty = 0;

  if (linesUsed) {
    for (const l of lines) {
      const { mode, fee } = resolveProductShipping(l.product, state);
      if (mode === 'default') continue;

      const q = Number(l.qty) || 0;
      const pieceWeight = Number(l.product?.weight) > 0 ? Number(l.product.weight) : weightPerPiece;

      defaultQty -= q;
      defaultWeight -= pieceWeight * q;

      if (mode === 'fixed') {
        fixedCost += fee * q;
        fixedQty += q;
      } else {
        freeQty += q;
      }
    }
    defaultQty = Math.max(0, defaultQty);
    defaultWeight = Math.max(0, defaultWeight);
  }

  // ---- Default (weight-based) part ----
  const hasDefaultItems = !linesUsed || defaultQty > 0;
  const weightConfigured = pricePerKg > 0 && defaultWeight > 0;

  let billableKg = 0;
  let defaultCost = 0;

  if (hasDefaultItems) {
    if (weightConfigured) {
      billableKg = Math.max(1, Math.ceil(defaultWeight / 1000));
      defaultCost = billableKg * pricePerKg;
    } else {
      defaultCost = defaultShippingCharge;
    }
  }

  const baseCost = defaultCost + fixedCost;
  const isFree = freeShippingAbove > 0 && Number(subtotal) >= freeShippingAbove;

  return {
    shippingCost: isFree ? 0 : baseCost,
    freeShippingAbove,
    weightPerPiece,
    pricePerKg,
    defaultShippingCharge,
    totalWeightGrams: totalWeight,
    billableKg,
    usedFallback: hasDefaultItems && !weightConfigured,
    state: state || '',
    usedStateRule: !!rule,
    breakdown: { defaultCost, fixedCost, fixedQty, freeQty }
  };
}