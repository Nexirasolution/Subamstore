export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';
import { generateSku } from '@/lib/sku';
import { productMatchesAge } from '@/lib/age';

// GET /api/products?category=slug&size=M&age=2-3 Y&minPrice=0&maxPrice=2000&sort=newest&page=1&limit=20&flag=bestseller
// Pass limit=all to skip pagination entirely and return every matching product.
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const query = { isActive: true };

    const categorySlug = searchParams.get('category');
    if (categorySlug) {
      const cat = await Category.findOne({ slug: categorySlug });
      if (!cat) return NextResponse.json({ products: [], total: 0 });

      if (cat.parent) {
        // Subcategory: only its own products.
        query.category = cat._id;
      } else {
        // Main category: include its own products plus every subcategory's,
        // so browsing a main category shows everything underneath it too.
        const subcats = await Category.find({ parent: cat._id }).select('_id');
        const categoryIds = [cat._id, ...subcats.map((c) => c._id)];
        query.category = { $in: categoryIds };
      }
    }

    const size = searchParams.get('size');
    if (size) query['variants.sizes.size'] = size;

    // Shop by age (matched after the query, see below).
    const age = searchParams.get('age');

    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    const flag = searchParams.get('flag'); // bestseller | topseller | active | featured | newarrival
    if (flag === 'bestseller') query.isBestSeller = true;
    if (flag === 'topseller') query.isTopSeller = true;
    if (flag === 'active') query.isActiveSeller = true;
    if (flag === 'featured') query.isFeatured = true;

    // "New Arrivals" hybrid fallback:
    // 1. Try last 30 days within the current query scope (category/size/price already applied).
    // 2. If nothing, widen to 90 days.
    // 3. If still nothing, drop the date filter entirely — customer sees the
    //    most recently added items regardless of age, sorted newest-first,
    //    instead of an empty page.
    if (flag === 'newarrival') {
      const cutoff30 = new Date();
      cutoff30.setDate(cutoff30.getDate() - 30);

      const cutoff90 = new Date();
      cutoff90.setDate(cutoff90.getDate() - 90);

      const [count30, count90] = await Promise.all([
        Product.countDocuments({ ...query, createdAt: { $gte: cutoff30 } }),
        Product.countDocuments({ ...query, createdAt: { $gte: cutoff90 } }),
      ]);

      if (count30 > 0) {
        query.createdAt = { $gte: cutoff30 };
      } else if (count90 > 0) {
        query.createdAt = { $gte: cutoff90 };
      }
      // else: no date filter added — falls through to sort: newest below,
      // returning the N most recent products in scope regardless of age.
    }

    const sort = searchParams.get('sort') || 'newest';
    const sortMap = {
      newest: { createdAt: -1 },
      priceLow: { basePrice: 1 },
      priceHigh: { basePrice: -1 },
      popular: { soldCount: -1 },
      rating: { rating: -1 }
    };

    const limitParam = searchParams.get('limit');
    const fetchAll = limitParam === 'all';
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(limitParam || 24);

    // `sizeChart` lets storefront views resolve the product -> category
    // size-chart fallback. `sizes` lets "Shop by age" fall back to the
    // category's ages for products that have no sizes of their own.
    const baseQuery = () =>
      Product.find(query)
        .populate('category', 'name slug type sizeChart sizes')
        .sort(sortMap[sort] || sortMap.newest);

    let products;
    let total;

    if (age) {
      // Age labels are matched in JS (spaces/case/"Years" vs "Y" are
      // normalised), so fetch the scope, filter, then paginate in memory.
      const all = await baseQuery();
      const matched = all.filter((p) => productMatchesAge(p.toObject(), age));
      total = matched.length;
      products = fetchAll ? matched : matched.slice((page - 1) * limit, page * limit);
    } else {
      let productsQuery = baseQuery();
      if (!fetchAll) {
        productsQuery = productsQuery.skip((page - 1) * limit).limit(limit);
      }
      [products, total] = await Promise.all([
        productsQuery,
        Product.countDocuments(query)
      ]);
    }

    return NextResponse.json({
      products,
      total,
      page: fetchAll ? 1 : page,
      pages: fetchAll ? 1 : Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('GET /api/products error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 });
  }
}

export const POST = requireAdmin(async (req) => {
  try {
    await dbConnect();
    const body = await req.json();
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Product name and category are required' }, { status: 400 });
    }

    const sku = await generateSku(body.category);

    const slug = body.slug ? slugify(body.slug, { lower: true }) : slugify(body.name, { lower: true });
    const exists = await Product.findOne({ slug });
    if (exists) return NextResponse.json({ error: 'A product with this slug already exists' }, { status: 409 });

    const basePrice = body.variants?.length
      ? Math.min(...body.variants.map((v) => v.price))
      : body.basePrice || 0;

    // body already carries sizeChart / isReadyToShip / sleeveOptions /
    // zipOptions / pantOptions / shawlOptions when the admin form sends
    // them — no extra handling needed here, they're embedded subdocuments.
    const product = await Product.create({ ...body, slug, sku, basePrice });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('POST /api/products error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create product' }, { status: 500 });
  }
});