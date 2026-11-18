import Link from 'next/link';
import { resizeImage } from '@/lib/image';

// Same palette as the rest of the homepage.
const WHITE = '#FFFFFF';
const NAVY = '#102A56';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E6D39A';
const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/*
  Layout: "arch gallery"
  - Heading is left-aligned with a "View all" link on the right.
  - Each category is a tall arch (rounded top) with a gold outline and a
    pale-gold arch offset behind it, echoing the offset frame on the banner.
  - Tiles sit in a horizontal scroll-snap strip. On mobile it bleeds to the
    screen edge so the next tile peeks in; on desktop the tiles stay in one row.
  - Server component: no client JS needed.
*/
export default function CategorySection({ categories }) {
  if (!categories?.length) return null;

  return (
    <section style={{ background: WHITE }}>
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-12 sm:pt-16 sm:pb-16">
        <div className="flex items-end justify-between gap-4 mb-8 sm:mb-10">
          <h2
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: NAVY, fontFamily: FONT_SANS }}
          >
            Shop by category
          </h2>
          <Link
            href="/products"
            className="shrink-0 text-sm font-bold pb-0.5 transition-colors hover:text-[#C9A227]"
            style={{ color: NAVY, fontFamily: FONT_SANS, borderBottom: `1px solid ${GOLD}` }}
          >
            View all
          </Link>
        </div>

        <ul
          className="flex gap-5 sm:gap-7 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((c) => (
            <li key={c._id} className="snap-start shrink-0 w-32 sm:w-40 md:w-44">
              <Link
                href={`/category/${c.slug}`}
                className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                style={{ outlineColor: NAVY }}
              >
                {/* Arch + offset arch behind it */}
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 translate-x-2 translate-y-2 rounded-t-full"
                    style={{ background: GOLD_LIGHT }}
                  />
                  <div
                    className="relative aspect-[3/4] overflow-hidden rounded-t-full"
                    style={{ border: `1px solid ${GOLD}`, background: WHITE }}
                  >
                    {c.image ? (
                      <img
                        // Widest tile is ~176px; a 360x480 crop covers retina screens.
                        src={resizeImage(c.image, 360, 480)}
                        alt=""
                        width={176}
                        height={235}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full" style={{ background: GOLD_LIGHT }} />
                    )}
                  </div>
                </div>

                <span
                  className="block mt-5 text-sm font-bold leading-tight line-clamp-2"
                  style={{ color: NAVY, fontFamily: FONT_SANS }}
                >
                  {c.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}