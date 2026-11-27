import mongoose from 'mongoose';
import Product from '@/models/Product';

// Loads each cart product's weight + shipping settings for calculateShipping.
// items: cart items ({ productId, qty, isCombo, ... }). Combo items are
// skipped, so they stay in the default weight-based bucket.
// Call after dbConnect().
export async function loadShippingLines(items = []) {
  const usable = (items || []).filter(
    (i) => i.isCombo !== true && i.productId && mongoose.Types.ObjectId.isValid(i.productId)
  );
  const ids = [...new Set(usable.map((i) => String(i.productId)))];
  if (ids.length === 0) return [];

  const products = await Product.find({ _id: { $in: ids } })
    .select('weight shipping')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return usable
    .filter((i) => byId.has(String(i.productId)) && Number(i.qty) > 0)
    .map((i) => ({ product: byId.get(String(i.productId)), qty: Number(i.qty) }));
}