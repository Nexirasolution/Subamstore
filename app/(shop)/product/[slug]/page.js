'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { Fraunces, Inter } from 'next/font/google';
import { ShoppingBag, Zap, Heart, Share2, ChevronLeft, ChevronRight, X, Minus, Plus, Ruler } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { getSizeStock, getCombinedStock } from '@/lib/stock';
import { resizeImage, buildSrcSet } from '@/lib/image';
import { useCart } from '@/components/CartContext';
import ColorSizeSelector from '@/components/ColorSizeSelector';
import ProductCard from '@/components/ProductCard';
import toast from 'react-hot-toast';

/*
  DESIGN CONCEPT — "The Hang Tag"
  A garment's hang tag is the one object every piece of clothing carries.
  The page is built around it:
    • Gallery  → a tall, uninterrupted lookbook (swipe on mobile, stacked on desktop)
    • Details  → a navy tag with a punched hole, gold "seam" stitching and a cream order panel
  Stitching (dashed gold) is the single recurring motif: tag edge, dividers, sticky bar.
*/

const display = Fraunces({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap' });

const PAPER = '#FFFFFF';
const CREAM = '#F8F6EF';
const NAVY = '#102A56';
const NAVY_DARK = '#071A3A';
const GOLD = '#C9A227';
const GOLD_PALE = '#E6D39A';

const INK = NAVY_DARK;
const GREY = 'rgba(16, 42, 86, 0.70)';
const NEUTRAL = 'rgba(16, 42, 86, 0.50)';
const STITCH = `1.5px dashed ${GOLD}`;

const BTN_PRIMARY =
  'transition-colors active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed bg-[#071A3A] text-[#E6D39A] border border-[#C9A227] hover:bg-[#C9A227] hover:text-[#071A3A]';
const BTN_SECONDARY =
  'transition-colors active:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent text-[#071A3A] border border-[#071A3A] hover:bg-[#071A3A] hover:text-[#E6D39A]';

const MAIN_WIDTHS = [480, 720, 1080];

function ProductSkeleton() {
  return (
    <div className={`${body.className} min-h-screen`} style={{ background: PAPER }}>
      <div className="max-w-6xl mx-auto sm:px-8 sm:pt-12">
        <div className="grid sm:grid-cols-[1.15fr_0.85fr] gap-0 sm:gap-12 animate-pulse">
          <div className="w-full aspect-[3/4]" style={{ background: CREAM }} />
          <div className="h-[480px] mx-5 sm:mx-0 -mt-5 sm:mt-0 relative" style={{ background: NAVY, borderRadius: '8px' }} />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [activeVariant, setActiveVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState('');
  const [activeSleeve, setActiveSleeve] = useState('');
  const [activeZip, setActiveZip] = useState('');
  const [activePantId, setActivePantId] = useState('');
  const [activeShawlId, setActiveShawlId] = useState('');
  const [qty, setQty] = useState(1);
  const [wished, setWished] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [sizeChartIndex, setSizeChartIndex] = useState(0);

  const { addItem } = useCart();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    fetch(`/api/products/${slug}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setActiveVariant(d.product?.variants?.[0]);
        setActiveImage(0);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });
    return () => controller.abort();
  }, [slug]);

  if (!data?.product) {
    return <ProductSkeleton />;
  }

  const { product, related } = data;
  const images = activeVariant?.images || [];
  const discount = activeVariant?.compareAtPrice > activeVariant?.price
    ? Math.round(((activeVariant.compareAtPrice - activeVariant.price) / activeVariant.compareAtPrice) * 100)
    : 0;

  const sizeChartImages = product.sizeChart?.length ? product.sizeChart : (product.category?.sizeChart || []);

  const selectedSizeStock = getSizeStock(activeVariant, activeSize);
  const sizeOutOfStock = !!activeSize && selectedSizeStock <= 0;

  const selectedPant = product.pantOptions?.find((p) => p._id === activePantId) || null;
  const selectedShawl = product.shawlOptions?.find((s) => s._id === activeShawlId) || null;
  const addonTotal = (selectedPant?.price || 0) + (selectedShawl?.price || 0);
  const unitPrice = (activeVariant?.price || 0) + addonTotal;
  const unitCompareAtPrice = activeVariant?.compareAtPrice > activeVariant?.price
    ? activeVariant.compareAtPrice + addonTotal
    : 0;

  function stockCap() {
    return getCombinedStock(activeVariant, activeSize, {
      pantOptions: product.pantOptions,
      pantOptionId: activePantId,
      shawlOptions: product.shawlOptions,
      shawlOptionId: activeShawlId,
    });
  }

  function prevSizeChart() { setSizeChartIndex((i) => (i === 0 ? sizeChartImages.length - 1 : i - 1)); }
  function nextSizeChart() { setSizeChartIndex((i) => (i === sizeChartImages.length - 1 ? 0 : i + 1)); }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: product.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  }

  function handleColorChange(v) {
    setActiveVariant(v);
    setActiveImage(0);
    setActiveSize('');
    setQty(1);
  }

  function handleSizeChange(size) {
    setActiveSize(size);
    const stock = getCombinedStock(activeVariant, size, {
      pantOptions: product.pantOptions,
      pantOptionId: activePantId,
      shawlOptions: product.shawlOptions,
      shawlOptionId: activeShawlId,
    });
    setQty((q) => (stock > 0 && stock !== Infinity ? Math.min(q, stock) : 1));
  }

  function handlePantChange(id) {
    setActivePantId(id);
    const stock = getCombinedStock(activeVariant, activeSize, {
      pantOptions: product.pantOptions,
      pantOptionId: id,
      shawlOptions: product.shawlOptions,
      shawlOptionId: activeShawlId,
    });
    if (stock !== Infinity) setQty((q) => Math.min(q, Math.max(stock, 1)));
  }

  function handleShawlChange(id) {
    setActiveShawlId(id);
    const stock = getCombinedStock(activeVariant, activeSize, {
      pantOptions: product.pantOptions,
      pantOptionId: activePantId,
      shawlOptions: product.shawlOptions,
      shawlOptionId: id,
    });
    if (stock !== Infinity) setQty((q) => Math.min(q, Math.max(stock, 1)));
  }

  function buildCartPayload() {
    const stock = stockCap();
    return {
      productId: product._id,
      variantId: activeVariant._id,
      comboId: null,
      name: product.name,
      image: activeVariant.images?.[0],
      color: activeVariant.color,
      size: activeSize,
      sleeveType: activeSleeve,
      zipType: activeZip,
      pantOption: selectedPant
        ? { id: selectedPant._id, name: selectedPant.name, price: selectedPant.price, image: selectedPant.image, sku: selectedPant.sku }
        : null,
      shawlOption: selectedShawl
        ? { id: selectedShawl._id, name: selectedShawl.name, price: selectedShawl.price, image: selectedShawl.image, sku: selectedShawl.sku }
        : null,
      price: unitPrice,
      qty,
      stock,
    };
  }

  function validateSelection() {
    if (!activeSize) { toast.error('Please select a size'); return false; }
    if (product.sleeveOptions?.length && !activeSleeve) { toast.error('Please select a sleeve type'); return false; }
    if (product.zipOptions?.length && !activeZip) { toast.error('Please select a zip type'); return false; }
    const stock = stockCap();
    if (stock <= 0) { toast.error('This combination is out of stock'); return false; }
    if (qty > stock) {
      toast.error(`Only ${stock} left in stock`);
      setQty(stock);
      return false;
    }
    return true;
  }

  function handleAddToCart() {
    if (!validateSelection()) return;
    addItem(buildCartPayload());
  }

  function handleBuyNow() {
    if (!validateSelection()) return;
    addItem(buildCartPayload());
    router.push('/checkout');
  }

  function toggleWish() {
    setWished((w) => !w);
    toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist');
  }

  const cap = stockCap();
  const showLowStock = !!activeSize && cap !== Infinity && cap > 0 && cap <= 5;
  const atMax = !!activeSize && cap !== Infinity && qty >= cap;

  // Round icon buttons used over the gallery (mobile) and in the tag header (desktop)
  const iconBtn = 'w-9 h-9 flex items-center justify-center rounded-full transition-colors';
  const actions = (variant) => {
    const onImage = variant === 'image';
    const bg = onImage ? 'rgba(255,255,255,0.9)' : 'rgba(230, 211, 154, 0.14)';
    const fg = onImage ? NAVY_DARK : GOLD_PALE;
    return (
      <div className="flex gap-2">
        <button onClick={toggleWish} className={iconBtn} style={{ background: bg, color: fg }} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}>
          <Heart size={16} strokeWidth={1.5} fill={wished ? GOLD : 'none'} style={{ color: wished ? GOLD : undefined }} />
        </button>
        <button onClick={handleShare} className={iconBtn} style={{ background: bg, color: fg }} aria-label="Share">
          <Share2 size={16} strokeWidth={1.5} />
        </button>
      </div>
    );
  };

  return (
    <div className={`${body.className} ${display.variable}`} style={{ background: PAPER }}>
      <div className="max-w-6xl mx-auto sm:px-8 sm:pt-12 pb-28 sm:pb-20">
        <div className="grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] sm:gap-12 items-start">

          {/* ── Lookbook gallery ── */}
          <div className="relative">
            {/* One markup, two behaviours: swipe strip on mobile, stacked lookbook on desktop */}
            <div
              key={activeVariant?._id}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.clientWidth) setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="flex overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setLightboxImg(img)}
                  className={`relative shrink-0 w-full snap-center overflow-hidden aspect-[3/4] sm:cursor-zoom-in sm:rounded ${i === 0 ? 'sm:col-span-2 sm:aspect-[5/6]' : 'sm:aspect-[4/5]'}`}
                  style={{ background: CREAM }}
                  aria-label={`Open image ${i + 1} of ${images.length}`}
                >
                  <img
                    src={resizeImage(img, 720)}
                    srcSet={buildSrcSet(img, MAIN_WIDTHS)}
                    sizes={i === 0 ? '(max-width: 640px) 100vw, 56vw' : '(max-width: 640px) 100vw, 28vw'}
                    alt={`${product.name} — view ${i + 1}`}
                    width={720}
                    height={900}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-contain sm:object-cover sm:object-top"
                  />
                </button>
              ))}
            </div>

            {/* Mobile: floating actions + swipe dots */}
            <div className="sm:hidden absolute top-3 right-3">{actions('image')}</div>
            {images.length > 1 && (
              <div className="sm:hidden absolute left-0 right-0 bottom-9 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 rounded-full transition-all"
                    style={{ width: i === activeImage ? 18 : 6, background: i === activeImage ? GOLD : 'rgba(16,42,86,0.25)' }}
                  />
                ))}
              </div>
            )}

            {/* Videos */}
            {product.videos?.length > 0 && (
              <div className="mt-3 px-5 sm:px-0 flex flex-col gap-3">
                {product.videos.map((url, i) => (
                  <video
                    key={i}
                    src={url}
                    controls
                    playsInline
                    preload="none"
                    className="w-full"
                    style={{ borderRadius: '4px', background: CREAM }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── The hang tag ── */}
          <aside className="relative z-10 -mt-6 sm:mt-0 mx-3 sm:mx-0 sm:sticky sm:top-6 sm:max-h-[calc(100vh-3rem)] sm:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderRadius: '10px', boxShadow: '0 10px 30px rgba(7, 26, 58, 0.14)' }}>
            {/* Navy head */}
            <div className="relative px-6 pt-10 pb-6 sm:px-8 sm:pt-12" style={{ background: NAVY_DARK, color: GOLD_PALE, borderRadius: '10px 10px 0 0' }}>
              {/* Punched hole */}
              <span
                className="absolute left-1/2 top-3.5 -translate-x-1/2 w-3.5 h-3.5 rounded-full"
                style={{ background: PAPER, boxShadow: `0 0 0 2px ${GOLD}` }}
              />
              <div className="hidden sm:block absolute top-4 right-4">{actions('tag')}</div>

              {product.category?.name && (
                <p className="text-xs sm:text-[13px]" style={{ color: GOLD_PALE, opacity: 0.8 }}>
                  {product.category.name}
                </p>
              )}

              <h1
                className={`${display.className} italic text-[24px] sm:text-[32px] leading-[1.15] mt-1`}
                style={{ color: '#FFFFFF', fontWeight: 400, letterSpacing: '-0.01em' }}
              >
                {product.name}
              </h1>

              <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-4">
                <span className={`${display.className} text-[28px] sm:text-[34px] leading-none`} style={{ color: GOLD, fontWeight: 500 }}>
                  {formatINR(unitPrice)}
                </span>
                {unitCompareAtPrice > unitPrice && (
                  <span className="line-through text-sm" style={{ color: GOLD_PALE, opacity: 0.6 }}>
                    {formatINR(unitCompareAtPrice)}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm" style={{ background: GOLD, color: NAVY_DARK }}>
                    Save {discount}%
                  </span>
                )}
              </div>
              {addonTotal > 0 && (
                <p className="text-xs mt-2" style={{ color: GOLD_PALE, opacity: 0.75 }}>
                  Includes {formatINR(addonTotal)} for selected add-ons
                </p>
              )}
              {product.isReadyToShip && (
                <p
                  className="inline-block mt-4 px-3 py-1 text-xs font-medium"
                  style={{ border: `1px dashed ${GOLD}`, color: GOLD_PALE, borderRadius: '999px' }}
                >
                  Ready to ship
                </p>
              )}
            </div>

            {/* Cream order panel with seam stitching */}
            <div className="relative" style={{ background: CREAM, borderRadius: '0 0 10px 10px' }}>
              <div className="px-6 py-6 sm:px-8 sm:py-8" style={{ outline: STITCH, outlineOffset: '-9px', borderRadius: '0 0 10px 10px' }}>
                <div className="px-1.5 pt-1.5">
                  <ColorSizeSelector
                    variants={product.variants}
                    activeVariant={activeVariant}
                    onColorChange={handleColorChange}
                    activeSize={activeSize}
                    onSizeChange={handleSizeChange}
                    categoryType={product.category?.type}
                    sizeChartImages={sizeChartImages}
                    onViewSizeChart={() => { setSizeChartIndex(0); setSizeChartOpen(true); }}
                    sleeveOptions={product.sleeveOptions}
                    zipOptions={product.zipOptions}
                    activeSleeve={activeSleeve}
                    onSleeveChange={setActiveSleeve}
                    activeZip={activeZip}
                    onZipChange={setActiveZip}
                    pantOptions={product.pantOptions}
                    activePantId={activePantId}
                    onPantChange={handlePantChange}
                    shawlOptions={product.shawlOptions}
                    activeShawlId={activeShawlId}
                    onShawlChange={handleShawlChange}
                    formatINR={formatINR}
                  />

                  {/* Quantity */}
                  <div className="flex items-center gap-4 mt-6 pt-5" style={{ borderTop: STITCH }}>
                    <p className="text-sm" style={{ color: GREY }}>Quantity</p>
                    <div className="flex items-center" style={{ border: `1px solid ${NAVY}`, borderRadius: '999px' }}>
                      <button
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="w-9 h-9 flex items-center justify-center"
                        style={{ color: INK }}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-medium w-6 text-center" style={{ color: INK }}>{qty}</span>
                      <button
                        onClick={() => setQty((q) => {
                          const c = stockCap();
                          return c > 0 && c !== Infinity ? Math.min(c, q + 1) : q + 1;
                        })}
                        disabled={atMax}
                        className="w-9 h-9 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: INK }}
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {showLowStock && (
                      <span className="text-xs font-medium" style={{ color: NAVY }}>Only {cap} left</span>
                    )}
                    {sizeOutOfStock && (
                      <span className="text-xs" style={{ color: GREY }}>Out of stock</span>
                    )}
                  </div>

                  {/* Desktop CTAs (mobile uses the sticky bar) */}
                  <div className="hidden sm:flex flex-col gap-2.5 mt-6">
                    <button
                      onClick={handleBuyNow}
                      disabled={sizeOutOfStock}
                      className={`w-full flex items-center justify-center gap-2 font-medium py-3.5 ${BTN_PRIMARY}`}
                      style={{ borderRadius: '999px' }}
                    >
                      <Zap size={16} fill="currentColor" strokeWidth={0} /> {sizeOutOfStock ? 'Out of stock' : 'Buy now'}
                    </button>
                    <button
                      onClick={handleAddToCart}
                      disabled={sizeOutOfStock}
                      className={`w-full flex items-center justify-center gap-2 font-medium py-3.5 ${BTN_SECONDARY}`}
                      style={{ borderRadius: '999px' }}
                    >
                      <ShoppingBag size={15} /> {sizeOutOfStock ? 'Out of stock' : 'Add to cart'}
                    </button>
                  </div>

                  {/* Fabric + description, set like the care label on a tag */}
                  {(product.fabric || product.description) && (
                    <div className="mt-6 pt-5 text-sm leading-relaxed" style={{ borderTop: STITCH, color: GREY }}>
                      {product.fabric && (
                        <p className="mb-3">
                          <span className={`${display.className} italic text-base`} style={{ color: INK }}>Fabric</span>
                          <span className="ml-2">{product.fabric}</span>
                        </p>
                      )}
                      {product.description && <p>{product.description}</p>}
                    </div>
                  )}

                  {sizeChartImages.length > 0 && (
                    <button
                      onClick={() => { setSizeChartIndex(0); setSizeChartOpen(true); }}
                      className="mt-5 flex items-center gap-2 text-sm font-medium underline underline-offset-4 decoration-[#C9A227]"
                      style={{ color: INK }}
                    >
                      <Ruler size={15} strokeWidth={1.5} /> Check the size chart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Related — a swipe row on mobile, a four-up grid on desktop */}
        {related?.length > 0 && (
          <div className="mt-16 sm:mt-24 px-5 sm:px-0">
            <div className="flex items-center gap-4 mb-8">
              <h2 className={`${display.className} italic text-[22px] sm:text-[28px]`} style={{ color: INK, fontWeight: 400 }}>
                You may also like
              </h2>
              <span className="flex-1" style={{ borderTop: STITCH }} />
            </div>
            <div className="flex gap-4 overflow-x-auto snap-x -mx-5 px-5 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-x-6 sm:gap-y-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {related.map((p) => (
                <div key={p._id} className="w-[62%] shrink-0 snap-start sm:w-auto">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky mobile buy bar */}
      {mounted && createPortal(
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3"
          style={{ background: PAPER, borderTop: STITCH, boxShadow: '0 -4px 16px rgba(7, 26, 58, 0.08)', zIndex: 9999 }}
        >
          <div className="shrink-0">
            <p className={`${display.className} text-lg leading-none`} style={{ color: NAVY, fontWeight: 500 }}>
              {formatINR(unitPrice)}
            </p>
            {unitCompareAtPrice > unitPrice && (
              <p className="text-[11px] line-through leading-none mt-1" style={{ color: NEUTRAL }}>
                {formatINR(unitCompareAtPrice)}
              </p>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={sizeOutOfStock}
            className={`w-11 h-11 shrink-0 flex items-center justify-center ${BTN_SECONDARY}`}
            style={{ borderRadius: '999px' }}
            aria-label="Add to cart"
          >
            <ShoppingBag size={17} />
          </button>
          <button
            onClick={handleBuyNow}
            disabled={sizeOutOfStock}
            className={`flex-1 flex items-center justify-center gap-1.5 font-medium h-11 text-sm ${BTN_PRIMARY}`}
            style={{ borderRadius: '999px' }}
          >
            <Zap size={15} fill="currentColor" strokeWidth={0} /> {sizeOutOfStock ? 'Sold out' : 'Buy now'}
          </button>
        </div>,
        document.body
      )}

      {/* Gallery lightbox */}
      {mounted && lightboxImg && createPortal(
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(7, 26, 58, 0.92)', zIndex: 10000 }}
        >
          <div className="relative w-full max-w-xl aspect-[4/5]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-11 right-0 sm:-top-2 sm:-right-11 w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(230, 211, 154, 0.2)', color: PAPER }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <img
              src={resizeImage(lightboxImg, 1080)}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
        </div>,
        document.body
      )}

      {/* Size chart modal */}
      {mounted && sizeChartOpen && sizeChartImages.length > 0 && createPortal(
        <div
          onClick={() => setSizeChartOpen(false)}
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ background: 'rgba(7, 26, 58, 0.9)', zIndex: 10000 }}
        >
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSizeChartOpen(false)}
              className="absolute -top-11 right-0 sm:-top-2 sm:-right-11 w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(230, 211, 154, 0.2)', color: PAPER }}
              aria-label="Close size chart"
            >
              <X size={20} />
            </button>

            <div className="relative w-full aspect-square" style={{ background: PAPER, borderRadius: '6px', overflow: 'hidden' }}>
              <img
                src={resizeImage(sizeChartImages[sizeChartIndex], 900)}
                alt={`Size chart ${sizeChartIndex + 1} of ${sizeChartImages.length}`}
                decoding="async"
                className="absolute inset-0 w-full h-full object-contain"
              />

              {sizeChartImages.length > 1 && (
                <>
                  <button
                    onClick={prevSizeChart}
                    className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-start pl-2"
                    aria-label="Previous size chart image"
                  >
                    <ChevronLeft size={22} strokeWidth={1.5} style={{ color: INK }} />
                  </button>
                  <button
                    onClick={nextSizeChart}
                    className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-end pr-2"
                    aria-label="Next size chart image"
                  >
                    <ChevronRight size={22} strokeWidth={1.5} style={{ color: INK }} />
                  </button>

                  <div className="absolute bottom-3 right-3 text-[11px] font-medium tracking-wide" style={{ color: INK }}>
                    {sizeChartIndex + 1} / {sizeChartImages.length}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}