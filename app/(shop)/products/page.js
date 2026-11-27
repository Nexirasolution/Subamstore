import ProductCard from '@/components/ProductCard';
import Filters from '@/components/Filters';
import AgeFilter from '@/components/AgeFilter';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category'; // also registers the schema for .populate('category')
import { collectAgeOptions, productMatchesAge } from '@/lib/age';

export const dynamic = 'force-dynamic'; // never cache/statically render this page

// Palette: 60% white/cream · 25% navy · 10% gold · 5% pale gold
// Keep in sync with the other storefront components.
const PAPER = '#FFFFFF';
const NAVY = '#102A56';
const NAVY_DARK = '#071A3A';
const GOLD = '#C9A227';

const INK = NAVY_DARK;
const GREY = 'rgba(16, 42, 86, 0.70)'; // secondary text (navy tint)
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

// Keys match the <option> values in Filters.
const SORT_MAP = {
  newest: { createdAt: -1 },
  newarrival: { createdAt: -1 },
  priceLow: { basePrice: 1 },
  priceHigh: { basePrice: -1 },
  popular: { soldCount: -1 },
  bestselling: { soldCount: -1 },
  rating: { rating: -1 },
};

async function getAllProducts(sort, age) {
  await dbConnect();

  const query = { isActive: true };
  const sortStage = SORT_MAP[sort] || SORT_MAP.newest;

  const [products, categories] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug type sizes') // sizes needed for the age fallback
      .sort(sortStage)
      .lean(), // no skip/limit — fetch everything
    Category.find({ isActive: { $ne: false } }).select('sizes').lean(),
  ]);

  // Age chips come from every category's "sizes" field in admin.
  const ageOptions = collectAgeOptions(...categories.map((c) => c.sizes));

  const filtered = age ? products.filter((p) => productMatchesAge(p, age)) : products;

  return {
    products: JSON.parse(JSON.stringify(filtered)), // strip Mongoose/ObjectId wrappers for the client
    total: filtered.length,
    ageOptions,
  };
}

export const metadata = {
  title: 'All Products | Subham stores',
};

export default async function ProductsPage({ searchParams }) {
  const resolvedSearchParams = await searchParams; // Next.js 15: searchParams is a Promise

  const sort = resolvedSearchParams?.sort || 'newest';
  const age = resolvedSearchParams?.age || '';

  const { products, total, ageOptions } = await getAllProducts(sort, age);

  // Keep the current sort when an age chip is clicked.
  function buildHref(ageValue) {
    const params = new URLSearchParams();
    if (sort && sort !== 'newest') params.set('sort', sort);
    if (ageValue) params.set('age', ageValue);
    const qs = params.toString();
    return qs ? `/products?${qs}` : '/products';
  }

  return (
    <section className="max-w-6xl mx-auto px-5 py-16" style={{ background: PAPER }}>
      <div
        className="mb-8 pb-5 flex items-baseline justify-between flex-wrap gap-3"
        style={{ borderBottom: `1px solid ${GOLD}` }}
      >
        <h1
          className="text-3xl sm:text-4xl tracking-tight"
          style={{ fontFamily: FONT_SERIF, color: INK, fontWeight: 400 }}
        >
          {age ? `All Products · ${age}` : 'All Products'}
        </h1>
        <span className="text-xs tracking-wide" style={{ color: NAVY }}>
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      </div>

      <AgeFilter ages={ageOptions} value={age} buildHref={buildHref} />

      <div className="mt-4">
        <Filters sort={sort} />
      </div>

      {products.length === 0 ? (
        <p className="text-sm mt-6" style={{ color: GREY }}>
          {age ? `No items found for ${age}.` : 'Nothing here yet — check back soon.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-10 mt-6">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}