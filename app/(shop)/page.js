// Cached homepage (ISR). Rendered once, then served as static HTML and
// re-built in the background at most every 5 minutes. Admin edits can show up
// instantly by calling revalidatePath('/') from the admin API routes.
// NOTE: the DB must be reachable at `next build` time (the page is generated then).
export const revalidate = 300;

import { Fraunces } from 'next/font/google';
import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import Product from '@/models/Product';
import Review from '@/models/Review';
import Combo from '@/models/Combo';
import Category from '@/models/Category';
import BannerCarousel from '@/components/BannerCarousel';
import CategorySection from '@/components/CategorySection';
import ReviewSection from '@/components/ReviewSection';

import Link from 'next/link';
import { formatINR } from '@/lib/utils';
import { resizeImage, buildSrcSet } from '@/lib/image';
import { ArrowRight, Tag } from 'lucide-react';

// Same display face as the product page, so the storefront reads as one brand.
const display = Fraunces({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], display: 'swap' });

// Design tokens — white / navy / gold theme
//   60%  WHITE + CREAM   page + section backgrounds
//   25%  NAVY + NAVY_DEEP headings, buttons, the Featured collection band
//   10%  GOLD            accents, badges, CTA text, category rings
//    5%  GOLD_LIGHT      hairlines, dividers, soft washes
const WHITE = '#FFFFFF';
const CREAM = '#F8F6EF';
const NAVY = '#102A56';
const NAVY_DEEP = '#071A3A';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E6D39A';

const INK = NAVY_DEEP;
const INK_SOFT = '#5B6B88';
const HAIRLINE = GOLD_LIGHT;
const GOLD_WASH = CREAM;

const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Adjust these if your storefront routes differ.
const productHref = (slug) => `/product/${slug}`;
const BEST_SELLERS_HREF = '/products?flag=bestseller';
const NEW_ARRIVALS_HREF = '/products?flag=newarrival';
const FEATURED_HREF = '/products?flag=featured';

const BEST_SELLER_LIMIT = 5; // 1 feature + 4 ranked rows
const NEW_ARRIVAL_LIMIT = 6;
const FEATURED_LIMIT = 5; // 1 hero + 4 mosaic tiles

// Only the fields this page renders — keeps DB reads and the page payload small.
const COMBO_FIELDS = 'name slug type packOptions comboPrice originalPrice images image';
const CATEGORY_FIELDS = 'name slug image';
const PRODUCT_FIELDS = 'name slug basePrice variants createdAt';

// Responsive image hints
const COMBO_WIDTHS = [300, 450, 700];
const COMBO_SIZES = '(max-width: 640px) 50vw, 33vw';
const FEATURE_WIDTHS = [480, 720, 1080];
const THUMB_WIDTHS = [160, 240, 360];
const RUNWAY_WIDTHS = [300, 450, 700];
const MOSAIC_WIDTHS = [300, 450, 700];
const MOSAIC_HERO_WIDTHS = [480, 720, 1080];

// Only the FIRST variant and its FIRST image are shown, so don't ship every
// colour/image of every product into the page HTML.
function slimProduct(p) {
  const v = p.variants?.[0];
  return {
    ...p,
    variants: v ? [{ ...v, images: (v.images || []).slice(0, 1) }] : [],
  };
}

async function getData() {
  await dbConnect();
  const [banners, bestSellers, newArrivals, featured, reviews, combos, categories] = await Promise.all([
    Banner.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Product.find({ isActive: true, isBestSeller: true })
      .sort({ soldCount: -1, createdAt: -1 })
      .limit(BEST_SELLER_LIMIT)
      .select(PRODUCT_FIELDS)
      .lean(),
    Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(NEW_ARRIVAL_LIMIT)
      .select(PRODUCT_FIELDS)
      .lean(),
    Product.find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(FEATURED_LIMIT)
      .select(PRODUCT_FIELDS)
      .lean(),
    Review.find({ isApproved: true, isFeatured: true }).populate('product', 'name').limit(10).lean(),
    Combo.find({ isActive: true }).select(COMBO_FIELDS).limit(6).lean(),
    Category.find({ isActive: true, parent: null }).select(CATEGORY_FIELDS).limit(10).lean(),
  ]);

  return JSON.parse(
    JSON.stringify({
      banners,
      bestSellers: bestSellers.map(slimProduct),
      newArrivals: newArrivals.map(slimProduct),
      featured: featured.map(slimProduct),
      reviews,
      combos,
      categories,
    })
  );
}

// ── Small helpers ──
const coverOf = (p) => p.variants?.[0]?.images?.[0];
const priceOf = (p) => p.variants?.[0]?.price ?? p.basePrice ?? 0;
const compareOf = (p) => {
  const c = p.variants?.[0]?.compareAtPrice;
  return c > priceOf(p) ? c : 0;
};

function addedLabel(createdAt) {
  if (!createdAt) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days <= 0) return 'Added today';
  if (days === 1) return 'Added yesterday';
  if (days <= 30) return `Added ${days} days ago`;
  return null;
}

function Price({ product, light = false, size = 'text-sm' }) {
  const price = priceOf(product);
  const compare = compareOf(product);
  return (
    <p className={`flex items-baseline gap-2 ${size}`}>
      <span className="font-semibold" style={{ color: light ? GOLD : NAVY }}>
        {formatINR(price)}
      </span>
      {compare > 0 && (
        <span className="line-through text-xs" style={{ color: light ? GOLD_LIGHT : INK_SOFT, opacity: 0.8 }}>
          {formatINR(compare)}
        </span>
      )}
    </p>
  );
}

// ── Featured collection: an editorial bento mosaic on a navy band ──
// One large hero tile beside a 2x2 block of smaller tiles. Captions sit on the
// photos (gradient overlay) so every tile keeps a clean, equal edge. A thin
// gold frame is inset into each tile and brightens on hover.
// With fewer than 5 products it falls back to an even grid.
function FeaturedTile({ product, hero = false, className = '' }) {
  const cover = coverOf(product);
  const widths = hero ? MOSAIC_HERO_WIDTHS : MOSAIC_WIDTHS;

  return (
    <Link
      href={productHref(product.slug)}
      className={`group relative block overflow-hidden ${className}`}
      style={{ background: NAVY }}
    >
      {cover && (
        <img
          src={resizeImage(cover, hero ? 720 : 450)}
          srcSet={buildSrcSet(cover, widths)}
          sizes={hero ? '(max-width: 1024px) 100vw, 50vw' : '(max-width: 1024px) 50vw, 25vw'}
          alt={product.name}
          width={hero ? 720 : 450}
          height={hero ? 900 : 560}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      )}

      {/* Inset gold frame */}
      <span
        aria-hidden
        className="absolute inset-2 sm:inset-3 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ border: `1px solid ${GOLD}` }}
      />

      <div
        className={`absolute inset-x-0 bottom-0 ${hero ? 'p-6 sm:p-9 pt-28' : 'p-4 sm:p-5 pt-16'}`}
        style={{ background: 'linear-gradient(to top, rgba(7,26,58,0.92) 10%, rgba(7,26,58,0))' }}
      >
        {hero && (
          <p className="text-[11px] font-bold uppercase tracking-[3px]" style={{ color: GOLD_LIGHT }}>
            Editor&rsquo;s pick
          </p>
        )}
        <h3
          className={`${display.className} italic leading-tight line-clamp-2 ${
            hero ? 'text-2xl sm:text-4xl mt-2' : 'text-base sm:text-xl'
          }`}
          style={{ color: WHITE, fontWeight: 400 }}
        >
          {product.name}
        </h3>
        <div className={hero ? 'mt-2' : 'mt-1'}>
          <Price product={product} light size={hero ? 'text-base' : 'text-sm'} />
        </div>
      </div>
    </Link>
  );
}

function FeaturedCollection({ products }) {
  if (!products.length) return null;
  const useMosaic = products.length === FEATURED_LIMIT;
  const [hero, ...rest] = products;

  return (
    <section className="py-16 sm:py-24" style={{ background: NAVY_DEEP, fontFamily: FONT_SANS }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col items-center text-center mb-10 sm:mb-14">
          <span
            className="text-[11px] font-bold uppercase tracking-[3px] mb-4 px-3 py-1"
            style={{ color: NAVY_DEEP, background: GOLD }}
          >
            Curated for you
          </span>
          <h2
            className={`${display.className} italic text-3xl sm:text-5xl leading-[1.05]`}
            style={{ color: WHITE, fontWeight: 400 }}
          >
            Featured collection
          </h2>
          <p className="mt-3 text-sm sm:text-base max-w-md" style={{ color: GOLD_LIGHT }}>
            A hand-picked edit of pieces we love right now.
          </p>
        </div>

        {useMosaic ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <FeaturedTile
              product={hero}
              hero
              className="col-span-2 aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto lg:row-span-2"
            />
            {rest.map((p) => (
              <FeaturedTile key={p._id} product={p} className="aspect-[4/5]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map((p) => (
              <FeaturedTile key={p._id} product={p} className="aspect-[4/5]" />
            ))}
          </div>
        )}

        <div className="mt-10 sm:mt-12 flex justify-center">
          <Link
            href={FEATURED_HREF}
            className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold transition-colors text-[#E6D39A] border border-[#C9A227] hover:bg-[#C9A227] hover:text-[#071A3A]"
            style={{ borderRadius: '999px' }}
          >
            Explore the collection <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Best sellers: a ranked leaderboard ──
// One hero for the top seller, then the next four listed as ranked rows.
// Numbers are used here because the content really is a ranking.
function BestSellers({ products }) {
  if (!products.length) return null;
  const [top, ...rest] = products;
  const topCover = coverOf(top);

  return (
    <section className="py-16 sm:py-24" style={{ background: WHITE, fontFamily: FONT_SANS }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 mb-10 sm:mb-14">
          <div>
            <h2 className={`${display.className} italic text-3xl sm:text-5xl leading-[1.05]`} style={{ color: NAVY, fontWeight: 400 }}>
              Best sellers
            </h2>
            <p className="mt-3 text-sm sm:text-base max-w-md" style={{ color: INK_SOFT }}>
              The pieces our customers order most, ranked by how many have sold.
            </p>
          </div>
          <Link
            href={BEST_SELLERS_HREF}
            className="flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 decoration-[#C9A227] hover:gap-2.5 transition-all"
            style={{ color: NAVY }}
          >
            See all best sellers <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Top seller */}
          <Link href={productHref(top.slug)} className="group relative block lg:col-span-5 mr-3 mb-3 sm:mr-4 sm:mb-4">
            {/* Offset gold frame sits behind the photo */}
            <span aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 sm:translate-x-4 sm:translate-y-4" style={{ border: `1px solid ${GOLD}` }} />
            <div className="relative aspect-[4/5] overflow-hidden" style={{ background: WHITE }}>
              {topCover && (
                <img
                  src={resizeImage(topCover, 720)}
                  srcSet={buildSrcSet(topCover, FEATURE_WIDTHS)}
                  sizes="(max-width: 1024px) 90vw, 40vw"
                  alt={top.name}
                  width={720}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
                />
              )}
              <div
                className="absolute inset-x-0 bottom-0 p-5 sm:p-7 pt-24"
                style={{ background: 'linear-gradient(to top, rgba(7,26,58,0.94) 15%, rgba(7,26,58,0))' }}
              >
                <p className="text-xs" style={{ color: GOLD_LIGHT }}>Number one best seller</p>
                <h3 className={`${display.className} italic text-2xl sm:text-3xl leading-tight mt-1`} style={{ color: WHITE, fontWeight: 400 }}>
                  {top.name}
                </h3>
                <div className="mt-2">
                  <Price product={top} light size="text-base" />
                </div>
              </div>
            </div>
          </Link>

          {/* Ranks 2–5 */}
          {rest.length > 0 && (
            <ol className="lg:col-span-7" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              {rest.map((p, i) => {
                const cover = coverOf(p);
                return (
                  <li key={p._id} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    <Link href={productHref(p.slug)} className="group flex items-center gap-4 sm:gap-7 py-4 sm:py-5">
                      <span
                        className={`${display.className} w-9 sm:w-16 shrink-0 text-center text-4xl sm:text-6xl leading-none`}
                        style={{ color: GOLD, fontWeight: 400 }}
                      >
                        {i + 2}
                      </span>
                      <div className="relative w-20 sm:w-28 aspect-[4/5] shrink-0 overflow-hidden" style={{ background: WHITE }}>
                        {cover && (
                          <img
                            src={resizeImage(cover, 240)}
                            srcSet={buildSrcSet(cover, THUMB_WIDTHS)}
                            sizes="(max-width: 640px) 80px, 112px"
                            alt=""
                            width={240}
                            height={300}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover object-top"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`${display.className} text-lg sm:text-2xl leading-snug line-clamp-2`} style={{ color: INK, fontWeight: 400 }}>
                          {p.name}
                        </h3>
                        <div className="mt-1.5">
                          <Price product={p} />
                        </div>
                      </div>
                      <ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: GOLD }} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

// ── New arrivals: a staggered runway ──
// Intro on the left, a swipeable row of tall portraits on the right. Every other
// card drops lower on desktop so the row reads like a hanging rail, not a grid.
function NewArrivals({ products }) {
  if (!products.length) return null;

  return (
    <section className="py-16 sm:py-24 overflow-hidden" style={{ background: WHITE, fontFamily: FONT_SANS }}>
      <div className="max-w-6xl mx-auto px-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <div className="mb-8 lg:mb-0 lg:pt-2">
          <h2 className={`${display.className} italic text-3xl sm:text-5xl leading-[1.05]`} style={{ color: NAVY, fontWeight: 400 }}>
            New arrivals
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: INK_SOFT }}>
            The latest pieces to join the collection, newest first.
          </p>
          <Link
            href={NEW_ARRIVALS_HREF}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 text-sm font-semibold transition-colors bg-[#071A3A] text-[#E6D39A] border border-[#C9A227] hover:bg-[#C9A227] hover:text-[#071A3A]"
            style={{ borderRadius: '999px' }}
          >
            Shop new arrivals <ArrowRight size={14} />
          </Link>
          <p className="hidden lg:block mt-10 text-xs" style={{ color: INK_SOFT }}>Scroll sideways for more →</p>
        </div>

        <div className="-mx-4 px-4 lg:mx-0 lg:px-0 min-w-0">
          <div className="flex items-start gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {products.map((p, i) => {
              const cover = coverOf(p);
              const label = addedLabel(p.createdAt);
              const isFresh = label && /today|yesterday|\b([1-9]|1[0-4]) days/.test(label);
              return (
                <Link
                  key={p._id}
                  href={productHref(p.slug)}
                  className={`group shrink-0 snap-start w-[66%] sm:w-[270px] ${i % 2 === 1 ? 'lg:mt-14' : ''}`}
                >
                  <div className="relative aspect-[3/4] overflow-hidden" style={{ background: CREAM, borderRadius: '120px 120px 4px 4px' }}>
                    {cover && (
                      <img
                        src={resizeImage(cover, 450)}
                        srcSet={buildSrcSet(cover, RUNWAY_WIDTHS)}
                        sizes="(max-width: 640px) 66vw, 270px"
                        alt={p.name}
                        width={450}
                        height={600}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    )}
                    {isFresh && (
                      <span
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[11px] font-semibold"
                        style={{ background: NAVY_DEEP, color: GOLD_LIGHT, border: `1px solid ${GOLD}`, borderRadius: '999px' }}
                      >
                        Just in
                      </span>
                    )}
                  </div>
                  <div className="pt-4 text-center">
                    <h3 className={`${display.className} text-lg leading-snug line-clamp-2`} style={{ color: INK, fontWeight: 400 }}>
                      {p.name}
                    </h3>
                    <div className="mt-1.5 flex justify-center">
                      <Price product={p} />
                    </div>
                    {label && (
                      <p className="mt-1 text-xs" style={{ color: INK_SOFT }}>{label}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { banners, bestSellers, newArrivals, featured, reviews, combos, categories } = await getData();

  return (
    <div className="overflow-x-hidden" style={{ background: WHITE }}>

      {/* Banner */}
      <BannerCarousel banners={banners} />

      {/* Shop by Category — arch gallery */}
      <CategorySection categories={categories} />

      {/* Best sellers — ranked leaderboard */}
      <BestSellers products={bestSellers} />

      <div className="max-w-6xl mx-auto px-4"><div style={{ borderTop: `1px solid ${HAIRLINE}` }} /></div>

      {/* New arrivals — staggered runway */}
      <NewArrivals products={newArrivals} />

      {/* Featured collection — bento mosaic on a navy band */}
      <FeaturedCollection products={featured} />

      {/* Combo Offers */}
      {combos.length > 0 && (
        <section className="py-16" style={{ background: WHITE }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col items-center text-center mb-8">
              <span
                className="text-[11px] font-bold uppercase tracking-[3px] mb-3 px-3 py-1"
                style={{ color: NAVY_DEEP, background: GOLD, fontFamily: FONT_SANS }}
              >
                Save More
              </span>
              <h2
                className="text-xl sm:text-2xl font-bold tracking-[1px]"
                style={{ color: NAVY, fontFamily: FONT_SANS }}
              >
                Combo Offers
              </h2>
              <p className="text-sm mt-1 font-light" style={{ color: INK_SOFT, fontFamily: FONT_SANS }}>
                Buy together, save together
              </p>
              <Link
                href="/combos"
                className="hidden sm:flex items-center gap-1 text-sm font-bold hover:gap-2 transition-all mt-3"
                style={{ color: NAVY, fontFamily: FONT_SANS }}
              >
                View all <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {combos.map((c) => {
                const isColorPack = c.type === 'color-pack';
                const cheapestPack = isColorPack && c.packOptions?.length
                  ? c.packOptions.reduce((min, p) => (p.price < min.price ? p : min), c.packOptions[0])
                  : null;

                const cover = c.images?.[0] || c.image;

                const displayPrice = isColorPack ? cheapestPack?.price ?? 0 : c.comboPrice;
                const displayOriginal = isColorPack ? cheapestPack?.originalPrice ?? 0 : c.originalPrice;
                const savings = displayOriginal > displayPrice ? displayOriginal - displayPrice : 0;
                const pct = displayOriginal > 0 ? Math.round((savings / displayOriginal) * 100) : 0;

                return (
                  <Link
                    key={c._id}
                    href={`/combo/${c.slug}`}
                    className="group relative overflow-hidden transition-colors"
                    style={{ background: WHITE, border: `1px solid ${GOLD}` }}
                  >
                    <div className="relative w-full aspect-square overflow-hidden" style={{ background: CREAM }}>
                      {cover ? (
                        <img
                          src={resizeImage(cover, 450)}
                          srcSet={buildSrcSet(cover, COMBO_WIDTHS)}
                          sizes={COMBO_SIZES}
                          alt={c.name}
                          width={450}
                          height={450}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: GOLD_WASH }} />
                      )}
                      {pct > 0 && (
                        <div
                          className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1"
                          style={{ color: NAVY_DEEP, background: GOLD, fontFamily: FONT_SANS }}
                        >
                          <Tag size={9} /> {pct}% off
                        </div>
                      )}
                      {isColorPack && (
                        <div
                          className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5"
                          style={{ background: NAVY, color: WHITE }}
                        >
                          Color Pack
                        </div>
                      )}
                    </div>

                    <div className="p-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                      <p
                        className="text-[13px] font-bold tracking-wide line-clamp-1"
                        style={{ color: INK, fontFamily: FONT_SANS }}
                      >
                        {c.name}
                      </p>
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="font-bold text-sm" style={{ color: INK, fontFamily: FONT_SANS }}>
                          {isColorPack && 'From '}{formatINR(displayPrice)}
                        </span>
                        {savings > 0 && (
                          <span
                            className="text-[11px] line-through font-light"
                            style={{ color: INK_SOFT, fontFamily: FONT_SANS }}
                          >
                            {formatINR(displayOriginal)}
                          </span>
                        )}
                      </div>
                      {savings > 0 && (
                        <p
                          className="text-[10.5px] font-bold mt-1 tracking-wide uppercase"
                          style={{ color: NAVY, fontFamily: FONT_SANS }}
                        >
                          Save {formatINR(savings)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link href="/combos" className="text-sm font-bold" style={{ color: NAVY, fontFamily: FONT_SANS }}>
                View all combos →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <ReviewSection reviews={reviews} />

    </div>
  );
}