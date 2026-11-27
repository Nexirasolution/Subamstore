'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, Upload, Loader2, X } from 'lucide-react';
import { INDIAN_STATES } from '@/lib/indianStates';

// Design tokens — same white/peach minimalist system as the rest of the site.
const INK = '#241B21';
const INK_SOFT = '#9C877D';
const PEACH = '#D9946A';
const PEACH_WASH = '#FBE8D9';
const LINE = '#EEE3DA';
const PAPER = '#FFFFFF';
const DISABLED_BG = '#F7F2EC';

function emptyVariant() {
  return {
    color: '',
    colorHex: '#D9946A',
    images: [''],
    price: '',
    compareAtPrice: '',
    sizes: [{ size: '', stock: 0, sku: '' }],
  };
}

function emptyAddonOption() {
  return { name: '', image: '', price: '', stock: '', sku: '' };
}

function normalizeSizeChart(value) {
  if (Array.isArray(value)) return value;
  if (value) return [value]; // backward-compat with the old single-string field
  return [];
}

function normalizeShipping(value) {
  return {
    mode: value?.mode || 'default',
    fee: value?.fee ?? '',
    stateRules: (value?.stateRules || []).map((r) => ({
      state: r.state || '',
      mode: r.mode || 'fixed',
      fee: r.fee ?? '',
    })),
  };
}

// Shared input style
const inputStyle = {
  border: `1px solid ${LINE}`,
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  color: INK,
  background: PAPER,
  width: '100%',
  outline: 'none',
  marginTop: '4px',
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: '500',
  color: INK_SOFT,
  fontFamily: 'sans-serif',
};

const cardStyle = {
  background: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: '6px',
  padding: '20px',
  marginBottom: '16px',
};

const sectionHeadStyle = {
  fontSize: '11px',
  fontWeight: '500',
  color: INK,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontFamily: 'sans-serif',
  marginBottom: '12px',
};

function ImageSlot({ value, onChange, onRemove, showRemove }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange(data.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="shrink-0 overflow-hidden relative"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '4px',
          border: `1.5px dashed ${PEACH}`,
          background: PEACH_WASH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : uploading ? (
          <Loader2 size={16} className="animate-spin" style={{ color: INK }} />
        ) : (
          <Upload size={14} style={{ color: PEACH }} />
        )}
        {uploading && value && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: INK }} />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <input
        placeholder="https://... or click thumbnail to upload"
        style={{ ...inputStyle, marginTop: 0, flex: 1 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => (e.target.style.borderColor = PEACH)}
        onBlur={(e) => (e.target.style.borderColor = LINE)}
      />

      {showRemove && (
        <button type="button" onClick={onRemove} style={{ color: INK_SOFT, flexShrink: 0 }}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// Reusable editor for a list of named add-on options (pants / shawls).
function AddonOptionsEditor({ title, options, onAdd, onUpdate, onRemove }) {
  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>{title}</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5"
          style={{
            background: PAPER,
            color: PEACH,
            border: `1px solid ${PEACH}`,
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add {title.replace(/s$/, '')}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: options.length ? '12px' : 0 }}>
        Leave empty if {title.toLowerCase()} don't apply to this product. The price entered is ADDED
        on top of the variant price when a customer selects it. Customers can also choose "None".
      </p>

      {options.map((opt, idx) => (
        <div
          key={idx}
          className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3 pb-3"
          style={{ borderBottom: idx < options.length - 1 ? `1px solid ${LINE}` : 'none' }}
        >
          <ImageSlot
            value={opt.image}
            onChange={(url) => onUpdate(idx, 'image', url)}
            onRemove={() => onUpdate(idx, 'image', '')}
            showRemove={!!opt.image}
          />
          <div className="grid sm:grid-cols-4 gap-2 flex-1">
            <input
              placeholder="Name (e.g. Cotton Palazzo)"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.name}
              onChange={(e) => onUpdate(idx, 'name', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              type="number"
              placeholder="Extra price ₹"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.price}
              onChange={(e) => onUpdate(idx, 'price', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              type="number"
              placeholder="Stock"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.stock}
              onChange={(e) => onUpdate(idx, 'stock', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              placeholder="SKU (optional)"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.sku}
              onChange={(e) => onUpdate(idx, 'sku', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            style={{ color: INK_SOFT, cursor: 'pointer', flexShrink: 0, marginTop: '12px' }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// Video upload slot — renders a playable <video> thumbnail.
function VideoSlot({ value, uploading, onRemove }) {
  return (
    <div className="relative overflow-hidden" style={{ borderRadius: '4px', border: `1px solid ${LINE}` }}>
      <video src={value} className="w-full h-24 object-cover" muted playsInline controls />
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
          <Loader2 size={16} className="animate-spin" style={{ color: INK }} />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', color: PAPER }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ProductForm({ initial, productId }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(() => {
    const base = initial || {
      name: '', slug: '', sku: '', description: '', category: '', fabric: '', weight: '', tags: [],
      variants: [emptyVariant()],
      sizeChart: [],
      videos: [],
      sleeveOptions: [],
      zipOptions: [],
      pantOptions: [],
      shawlOptions: [],
      isBestSeller: false, isTopSeller: false, isActiveSeller: true, isFeatured: false, isActive: true,
      isReadyToShip: false,
      shipping: { mode: 'default', fee: '', stateRules: [] },
    };
    return {
      ...base,
      // Existing products saved before weight existed have 0 / undefined —
      // show the field empty so the admin is prompted to fill it in.
      weight: base.weight > 0 ? base.weight : '',
      sizeChart: normalizeSizeChart(base.sizeChart),
      videos: base.videos || [],
      sleeveOptions: base.sleeveOptions || [],
      zipOptions: base.zipOptions || [],
      pantOptions: (base.pantOptions || []).map((o) => ({ ...o })),
      shawlOptions: (base.shawlOptions || []).map((o) => ({ ...o })),
      shipping: normalizeShipping(base.shipping),
    };
  });
  const [saving, setSaving] = useState(false);
  const [sizeChartUploading, setSizeChartUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const sizeChartFileRef = useRef();
  const videoFileRef = useRef();

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function toggleArrayValue(field, value) {
    setForm((f) => {
      const current = f[field] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...f, [field]: next };
    });
  }

  function updateVariant(idx, field, value) {
    setForm((f) => { const v = [...f.variants]; v[idx] = { ...v[idx], [field]: value }; return { ...f, variants: v }; });
  }

  function updateVariantImage(vIdx, imgIdx, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = [...variants[vIdx].images];
      images[imgIdx] = value;
      variants[vIdx] = { ...variants[vIdx], images };
      return { ...f, variants };
    });
  }

  function removeVariantImage(vIdx, imgIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = variants[vIdx].images.filter((_, i) => i !== imgIdx);
      variants[vIdx] = { ...variants[vIdx], images: images.length ? images : [''] };
      return { ...f, variants };
    });
  }

  function addVariantImage(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], images: [...variants[vIdx].images, ''] };
      return { ...f, variants };
    });
  }

  function updateSize(vIdx, sIdx, field, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const sizes = [...variants[vIdx].sizes];
      sizes[sIdx] = { ...sizes[sIdx], [field]: value };
      variants[vIdx] = { ...variants[vIdx], sizes };
      return { ...f, variants };
    });
  }

  function addSize(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: [...variants[vIdx].sizes, { size: '', stock: 0, sku: '' }] };
      return { ...f, variants };
    });
  }

  function removeSize(vIdx, sIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: variants[vIdx].sizes.filter((_, i) => i !== sIdx) };
      return { ...f, variants };
    });
  }

  function addVariant() { setForm((f) => ({ ...f, variants: [...f.variants, emptyVariant()] })); }
  function removeVariant(idx) { setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) })); }

  // Pant / Shawl option list handlers — same shape, different field name.
  function addAddonOption(field) {
    setForm((f) => ({ ...f, [field]: [...(f[field] || []), emptyAddonOption()] }));
  }
  function updateAddonOption(field, idx, key, value) {
    setForm((f) => {
      const list = [...(f[field] || [])];
      list[idx] = { ...list[idx], [key]: value };
      return { ...f, [field]: list };
    });
  }
  function removeAddonOption(field, idx) {
    setForm((f) => ({ ...f, [field]: (f[field] || []).filter((_, i) => i !== idx) }));
  }

  // Per-product shipping handlers
  function updateShipping(key, value) {
    setForm((f) => ({ ...f, shipping: { ...f.shipping, [key]: value } }));
  }
  function addShippingRule() {
    setForm((f) => ({
      ...f,
      shipping: { ...f.shipping, stateRules: [...f.shipping.stateRules, { state: '', mode: 'fixed', fee: '' }] },
    }));
  }
  function updateShippingRule(idx, key, value) {
    setForm((f) => {
      const rules = [...f.shipping.stateRules];
      rules[idx] = { ...rules[idx], [key]: value };
      return { ...f, shipping: { ...f.shipping, stateRules: rules } };
    });
  }
  function removeShippingRule(idx) {
    setForm((f) => ({
      ...f,
      shipping: { ...f.shipping, stateRules: f.shipping.stateRules.filter((_, i) => i !== idx) },
    }));
  }

  // Size chart — supports multiple images.
  async function handleSizeChartFilesChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSizeChartUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        uploaded.push(data.url);
      }
      setForm((f) => ({ ...f, sizeChart: [...(f.sizeChart || []), ...uploaded] }));
      toast.success(`${uploaded.length} size chart image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSizeChartUploading(false);
      e.target.value = '';
    }
  }

  function removeSizeChartImage(idx) {
    setForm((f) => ({ ...f, sizeChart: (f.sizeChart || []).filter((_, i) => i !== idx) }));
  }

  // Videos — supports multiple files.
  async function handleVideoFilesChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setVideoUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        uploaded.push(data.url);
      }
      setForm((f) => ({ ...f, videos: [...(f.videos || []), ...uploaded] }));
      toast.success(`${uploaded.length} video${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVideoUploading(false);
      e.target.value = '';
    }
  }

  function removeVideo(idx) {
    setForm((f) => ({ ...f, videos: (f.videos || []).filter((_, i) => i !== idx) }));
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.weight || Number(form.weight) <= 0) {
      toast.error('Enter the product weight in grams (used for shipping)');
      return;
    }

    if (form.shipping.mode === 'fixed' && !(Number(form.shipping.fee) >= 0 && form.shipping.fee !== '')) {
      toast.error('Enter the fixed shipping fee per piece');
      return;
    }
    const badRule = form.shipping.stateRules.find((r) => !r.state || (r.mode === 'fixed' && r.fee === ''));
    if (badRule) {
      toast.error('Each state shipping rule needs a state and, for fixed fee, an amount');
      return;
    }

    setSaving(true);
    // Note: sku is intentionally omitted — it's auto-generated/managed server-side.
    const payload = {
      ...form,
      weight: Number(form.weight) || 0,
      sizeChart: form.sizeChart || [],
      videos: form.videos || [],
      sleeveOptions: form.sleeveOptions || [],
      zipOptions: form.zipOptions || [],
      pantOptions: (form.pantOptions || [])
        .filter((o) => o.name?.trim())
        .map((o) => ({
          name: o.name.trim(),
          image: o.image || '',
          price: Number(o.price) || 0,
          stock: Number(o.stock) || 0,
          sku: o.sku || '',
        })),
      shawlOptions: (form.shawlOptions || [])
        .filter((o) => o.name?.trim())
        .map((o) => ({
          name: o.name.trim(),
          image: o.image || '',
          price: Number(o.price) || 0,
          stock: Number(o.stock) || 0,
          sku: o.sku || '',
        })),
      shipping: {
        mode: form.shipping.mode || 'default',
        fee: form.shipping.mode === 'fixed' ? Number(form.shipping.fee) || 0 : 0,
        stateRules: (form.shipping.stateRules || [])
          .filter((r) => r.state)
          .map((r) => ({
            state: r.state,
            mode: r.mode || 'fixed',
            fee: r.mode === 'fixed' ? Number(r.fee) || 0 : 0,
          })),
      },
      variants: form.variants.map((v) => ({
        ...v,
        price: Number(v.price),
        compareAtPrice: Number(v.compareAtPrice) || 0,
        images: v.images.filter(Boolean),
        sizes: v.sizes.map((s) => ({ ...s, stock: Number(s.stock) })),
      })),
    };
    delete payload.sku;

    const url = productId ? `/api/products/${productId}` : '/api/products';
    const method = productId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success(productId ? 'Product updated' : 'Product created');
      router.push('/admin/products');
    } else {
      toast.error(data.error || 'Something went wrong');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">

      {/* Basic Info Card */}
      <div style={cardStyle}>
        <p style={sectionHeadStyle}>Product Details</p>
        <div style={{ height: '1px', background: LINE, marginBottom: '16px' }} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Product Name *</label>
            <input
              required
              style={inputStyle}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>SKU</label>
            <input
              disabled
              readOnly
              style={{ ...inputStyle, background: DISABLED_BG, color: INK_SOFT, cursor: 'not-allowed' }}
              value={form.sku || 'Auto-generated from category on save'}
              title="SKU is generated automatically from the product's category"
            />
          </div>
          <div>
            <label style={labelStyle}>Category *</label>
            <select
              required
              style={inputStyle}
              value={form.category?._id || form.category}
              onChange={(e) => update('category', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fabric</label>
            <input
              style={inputStyle}
              value={form.fabric}
              onChange={(e) => update('fabric', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>Weight per piece (grams) *</label>
            <input
              required
              type="number"
              min="1"
              placeholder="e.g. 250"
              style={inputStyle}
              value={form.weight ?? ''}
              onChange={(e) => update('weight', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>Tags (comma separated)</label>
            <input
              style={inputStyle}
              value={Array.isArray(form.tags) ? form.tags.join(', ') : ''}
              onChange={(e) => update('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div className="sm:col-span-2">
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = PEACH)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>

          {/* Size chart */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>
              Size Chart <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>
                (optional — shown as a gallery on the product page; falls back to the category's size chart if left empty)
              </span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-2">
              {(form.sizeChart || []).map((url, idx) => (
                <div key={idx} className="relative aspect-square overflow-hidden" style={{ borderRadius: '4px', border: `1px solid ${LINE}` }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeSizeChartImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', color: PAPER }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={sizeChartUploading}
                onClick={() => sizeChartFileRef.current?.click()}
                className="aspect-square flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                style={{ borderRadius: '4px', border: `1.5px dashed ${PEACH}`, background: PEACH_WASH, color: PEACH, cursor: 'pointer' }}
              >
                {sizeChartUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span style={{ fontSize: '10px', fontFamily: 'sans-serif' }}>{sizeChartUploading ? 'Uploading…' : 'Add'}</span>
              </button>
            </div>
            <input ref={sizeChartFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSizeChartFilesChange} />
          </div>

          {/* Product videos */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>
              Product Videos <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>
                (optional — shown below the image gallery on the product page)
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              {(form.videos || []).map((url, idx) => (
                <VideoSlot key={idx} value={url} uploading={false} onRemove={() => removeVideo(idx)} />
              ))}
              <button
                type="button"
                disabled={videoUploading}
                onClick={() => videoFileRef.current?.click()}
                className="h-24 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                style={{ borderRadius: '4px', border: `1.5px dashed ${PEACH}`, background: PEACH_WASH, color: PEACH, cursor: 'pointer' }}
              >
                {videoUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span style={{ fontSize: '10px', fontFamily: 'sans-serif' }}>{videoUploading ? 'Uploading…' : 'Add video'}</span>
              </button>
            </div>
            <input ref={videoFileRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVideoFilesChange} />
          </div>

          {/* Sleeve/Zip options */}
          <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>
                Sleeve Type Options <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-2">
                {['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'].map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                    <input
                      type="checkbox"
                      checked={(form.sleeveOptions || []).includes(opt)}
                      onChange={() => toggleArrayValue('sleeveOptions', opt)}
                      style={{ accentColor: PEACH, width: '15px', height: '15px' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                Zip Type Options <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-2">
                {['With Zip', 'Without Zip'].map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                    <input
                      type="checkbox"
                      checked={(form.zipOptions || []).includes(opt)}
                      onChange={() => toggleArrayValue('zipOptions', opt)}
                      style={{ accentColor: PEACH, width: '15px', height: '15px' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            {[
              ['isBestSeller', 'Bestseller'],
              ['isTopSeller', 'Top Seller'],
              ['isActiveSeller', 'Active Seller'],
              ['isFeatured', 'Featured'],
              ['isActive', 'Active (visible on site)'],
              ['isReadyToShip', 'Ready to Ship'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm cursor-pointer"
                style={{ color: INK_SOFT, fontFamily: 'sans-serif' }}
              >
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => update(key, e.target.checked)}
                  style={{ accentColor: PEACH, width: '15px', height: '15px' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Variants Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ ...sectionHeadStyle, marginBottom: 0 }}>Variants</h2>
          <button
            type="button"
            onClick={addVariant}
            className="flex items-center gap-1 text-sm font-medium px-4 py-2 transition-colors"
            style={{
              background: PAPER,
              color: PEACH,
              border: `1px solid ${PEACH}`,
              borderRadius: '4px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = PEACH;
              e.currentTarget.style.color = PAPER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = PAPER;
              e.currentTarget.style.color = PEACH;
            }}
          >
            <Plus size={16} /> Add Variant
          </button>
        </div>

        {form.variants.map((v, vIdx) => (
          <div key={vIdx} style={cardStyle}>
            <div
              className="flex justify-between items-center mb-3 pb-2"
              style={{ borderBottom: `1px solid ${LINE}` }}
            >
              <span style={{ fontWeight: '500', fontSize: '13px', color: INK, fontFamily: 'sans-serif' }}>
                Variant {vIdx + 1}
              </span>
              {form.variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(vIdx)}
                  style={{ color: INK_SOFT, cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-3 mb-3">
              <input
                placeholder="Color name (e.g. Green)"
                style={inputStyle}
                value={v.color}
                onChange={(e) => updateVariant(vIdx, 'color', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PEACH)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
              <input
                type="color"
                style={{ ...inputStyle, padding: '4px', height: '40px' }}
                value={v.colorHex}
                onChange={(e) => updateVariant(vIdx, 'colorHex', e.target.value)}
              />
              <input
                placeholder="Price ₹"
                type="number"
                style={inputStyle}
                value={v.price}
                onChange={(e) => updateVariant(vIdx, 'price', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PEACH)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
              <input
                placeholder="Compare-at price ₹"
                type="number"
                style={inputStyle}
                value={v.compareAtPrice}
                onChange={(e) => updateVariant(vIdx, 'compareAtPrice', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PEACH)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
            </div>

            <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '8px', fontWeight: '500' }}>
              Images for this colour — click thumbnail to upload
            </p>
            {v.images.map((img, imgIdx) => (
              <ImageSlot
                key={imgIdx}
                value={img}
                onChange={(url) => updateVariantImage(vIdx, imgIdx, url)}
                onRemove={() => removeVariantImage(vIdx, imgIdx)}
                showRemove={v.images.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={() => addVariantImage(vIdx)}
              style={{ fontSize: '12px', color: PEACH, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '12px', cursor: 'pointer' }}
            >
              + Add another image
            </button>

            <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '6px' }}>
              Sizes &amp; Stock
            </p>
            {v.sizes.map((s, sIdx) => (
              <div key={sIdx} className="flex gap-2 mb-2 items-center">
                <input
                  placeholder="Size (e.g. M, 38, 2-3 Y)"
                  style={{ ...inputStyle, width: '140px', marginTop: 0 }}
                  value={s.size}
                  onChange={(e) => updateSize(vIdx, sIdx, 'size', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PEACH)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <input
                  type="number"
                  placeholder="Stock"
                  style={{ ...inputStyle, width: '90px', marginTop: 0 }}
                  value={s.stock}
                  onChange={(e) => updateSize(vIdx, sIdx, 'stock', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PEACH)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <input
                  placeholder="SKU (optional)"
                  style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                  value={s.sku}
                  onChange={(e) => updateSize(vIdx, sIdx, 'sku', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = PEACH)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <button
                  type="button"
                  onClick={() => removeSize(vIdx, sIdx)}
                  style={{ color: INK_SOFT, cursor: 'pointer', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSize(vIdx)}
              style={{ fontSize: '12px', color: PEACH, fontFamily: 'sans-serif', fontWeight: '500', cursor: 'pointer' }}
            >
              + Add size
            </button>
          </div>
        ))}
      </div>

      {/* Pant Options */}
      <AddonOptionsEditor
        title="Pant Options"
        options={form.pantOptions}
        onAdd={() => addAddonOption('pantOptions')}
        onUpdate={(idx, key, value) => updateAddonOption('pantOptions', idx, key, value)}
        onRemove={(idx) => removeAddonOption('pantOptions', idx)}
      />

      {/* Shawl Options */}
      <AddonOptionsEditor
        title="Shawl Options"
        options={form.shawlOptions}
        onAdd={() => addAddonOption('shawlOptions')}
        onUpdate={(idx, key, value) => updateAddonOption('shawlOptions', idx, key, value)}
        onRemove={(idx) => removeAddonOption('shawlOptions', idx)}
      />

      {/* Shipping — per-product override */}
      <div style={cardStyle}>
        <p style={sectionHeadStyle}>Shipping</p>
        <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '12px' }}>
          "Default" uses the store's weight-based rates. "Fixed fee" is charged per piece.
          State rules below override this for customers in that state.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Shipping for this product</label>
            <select
              style={inputStyle}
              value={form.shipping.mode}
              onChange={(e) => updateShipping('mode', e.target.value)}
            >
              <option value="default">Default (store rates)</option>
              <option value="free">Free shipping</option>
              <option value="fixed">Fixed fee per piece</option>
            </select>
          </div>
          {form.shipping.mode === 'fixed' && (
            <div>
              <label style={labelStyle}>Fee per piece (₹)</label>
              <input
                type="number"
                min="0"
                style={inputStyle}
                value={form.shipping.fee}
                onChange={(e) => updateShipping('fee', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = PEACH)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-5 mb-2">
          <label style={labelStyle}>State-wise shipping (optional)</label>
          <button
            type="button"
            onClick={addShippingRule}
            className="flex items-center gap-1 text-sm font-medium px-3 py-1.5"
            style={{ background: PAPER, color: PEACH, border: `1px solid ${PEACH}`, borderRadius: '4px', fontFamily: 'sans-serif', cursor: 'pointer' }}
          >
            <Plus size={14} /> Add state rule
          </button>
        </div>

        {form.shipping.stateRules.map((r, idx) => (
          <div key={idx} className="flex flex-wrap gap-2 mb-2 items-center">
            <select
              style={{ ...inputStyle, marginTop: 0, flex: '1 1 160px' }}
              value={r.state}
              onChange={(e) => updateShippingRule(idx, 'state', e.target.value)}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              style={{ ...inputStyle, marginTop: 0, width: '150px' }}
              value={r.mode}
              onChange={(e) => updateShippingRule(idx, 'mode', e.target.value)}
            >
              <option value="fixed">Fixed fee</option>
              <option value="free">Free</option>
              <option value="default">Store rates</option>
            </select>
            {r.mode === 'fixed' && (
              <input
                type="number"
                min="0"
                placeholder="₹ per piece"
                style={{ ...inputStyle, marginTop: 0, width: '120px' }}
                value={r.fee}
                onChange={(e) => updateShippingRule(idx, 'fee', e.target.value)}
              />
            )}
            <button type="button" onClick={() => removeShippingRule(idx)} style={{ color: INK_SOFT, cursor: 'pointer' }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Submit button */}
      <button
        disabled={saving}
        className="w-full sm:w-auto px-8 py-3 font-medium text-sm transition-opacity"
        style={{
          background: PEACH,
          color: PAPER,
          border: 'none',
          borderRadius: '4px',
          fontFamily: 'sans-serif',
          fontSize: '14px',
          letterSpacing: '0.02em',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : productId ? 'Update Product' : 'Create Product'}
      </button>
    </form>
  );
}