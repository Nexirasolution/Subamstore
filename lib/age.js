// Helpers for "Shop by age". Ages live in the category "sizes" field,
// e.g. "0-1 Y, 1-2 Y, 6-12 M, 3+ Y".

const AGE_RE =
  /(\d+(?:\.\d+)?)\s*(?:-|–|—|to|\+)?\s*(\d+(?:\.\d+)?)?\s*(years?|yrs?|yr|y|months?|mos?|mo|m)\b/i;

export function isAgeLabel(value) {
  return typeof value === 'string' && AGE_RE.test(value.trim());
}

// "2 - 3 Years" and "2-3y" compare equal.
export function normalizeLabel(value) {
  return String(value)
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '')
    .replace(/(\d)to(\d)/g, '$1-$2')
    .replace(/years?|yrs?|yr/g, 'y')
    .replace(/months?|mos?|mo/g, 'm');
}

// Sort key in months so "6-12 M" comes before "1-2 Y".
function ageSortKey(label) {
  const m = String(label).match(AGE_RE);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const start = parseFloat(m[1]);
  const unit = m[3].toLowerCase();
  return unit.startsWith('m') ? start : start * 12;
}

// Accepts any number of arrays of size strings; returns unique, sorted age labels.
export function collectAgeOptions(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const s of list || []) {
      if (!isAgeLabel(s)) continue;
      const key = normalizeLabel(s);
      if (!seen.has(key)) seen.set(key, String(s).trim());
    }
  }
  return [...seen.values()].sort((a, b) => ageSortKey(a) - ageSortKey(b));
}

function labelOf(x) {
  if (x == null) return null;
  if (typeof x === 'string') return x;
  if (typeof x === 'object') return x.size || x.label || x.name || null;
  return null;
}

// Product sizes live at variants[].sizes[].size. A flat product.sizes
// array is also supported in case some products use it.
export function getProductSizeLabels(product) {
  const out = [];
  const push = (x) => {
    const l = labelOf(x);
    if (l) out.push(l);
  };
  if (Array.isArray(product?.sizes)) product.sizes.forEach(push);
  if (Array.isArray(product?.variants)) {
    for (const v of product.variants) {
      if (Array.isArray(v?.sizes)) v.sizes.forEach(push);
    }
  }
  return out;
}

// A product matches if one of its sizes equals the age label. If it has no
// sizes at all, fall back to its category's sizes.
export function productMatchesAge(product, age, fallbackSizes = []) {
  if (!age) return true;
  let labels = getProductSizeLabels(product);
  if (labels.length === 0) {
    labels = product?.category?.sizes || fallbackSizes || [];
  }
  const target = normalizeLabel(age);
  return labels.some((l) => normalizeLabel(l) === target);
}