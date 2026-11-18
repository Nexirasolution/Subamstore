'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Palette: 60% white/cream · 25% navy · 10% gold · 5% pale gold
// Keep in sync with Navbar, Footer, ProductCard and CouponMarquee.
const CREAM = '#F8F6EF';
const NAVY_DARK = '#071A3A';
const GOLD = '#C9A227';
const GOLD_PALE = '#E6D39A';

const SLIDE_MS = 4500;
const GAP = 16; // px between slides

/*
  Layout: "peek stage"
  - The active banner sits on the left at ~88% width with a pale-gold offset
    frame behind it. The NEXT banner peeks in from the right edge, so the
    visitor can see there is more and can click the sliver to jump to it.
  - Under the stage is a progress rail: one segment per banner. The active
    segment fills over SLIDE_MS, so it shows exactly when the slide changes.
  - Banner title + "2 / 5" counter on the left of the rail, arrows on the right.
*/
export default function BannerCarousel({ banners }) {
  const count = banners?.length || 0;
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const [autoplay, setAutoplay] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Autoplay only when there is more than one banner and motion is allowed.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setAutoplay(count > 1 && !reduce);
  }, [count]);

  // Mount the current, next and previous slide images; the rest stay unloaded.
  useEffect(() => {
    if (count < 2) return;
    setSeen((prev) => {
      const next = (index + 1) % count;
      const before = (index - 1 + count) % count;
      if (prev.has(index) && prev.has(next) && prev.has(before)) return prev;
      const s = new Set(prev);
      s.add(index);
      s.add(next);
      s.add(before);
      return s;
    });
  }, [index, count]);

  // Auto-advance. Restarts after any manual change and pauses in a hidden tab.
  useEffect(() => {
    if (!autoplay) return;
    let t;
    const start = () => {
      clearTimeout(t);
      t = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    };
    const onVisibility = () => {
      setHidden(document.hidden);
      if (document.hidden) clearTimeout(t);
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [index, count, autoplay]);

  if (!count) return null;

  const go = (i) => setIndex((i + count) % count);
  const current = banners[index];

  return (
    <section
      className="relative w-full overflow-hidden px-3 pt-3 pb-3 sm:px-8 sm:pt-6 sm:pb-5"
      style={{ background: CREAM }}
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      <style>{`
        @keyframes bc-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .bc-fill { transform-origin: left; animation: bc-fill ${SLIDE_MS}ms linear forwards; }
        .bc-fill[data-paused="true"] { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .bc-fill { animation: none; transform: scaleX(1); }
        }
      `}</style>

      <div className="mx-auto max-w-[1600px]">
        {/* Stage: the track slides, the clipping happens on the section. */}
        <div
          className="flex transition-transform duration-700 ease-out motion-reduce:transition-none [--slide-w:92%] sm:[--slide-w:88%]"
          style={{
            gap: GAP,
            transform: `translateX(calc(${-index} * (var(--slide-w) + ${GAP}px)))`,
          }}
        >
          {banners.map((b, i) => {
            const active = i === index;
            return (
              <Link
                key={b._id}
                href={b.link || '#'}
                onClick={(e) => {
                  // A click on a peeking slide brings it to the front instead of navigating.
                  if (!active || !b.link) {
                    e.preventDefault();
                    if (!active) go(i);
                  }
                }}
                className={`relative block flex-none w-[var(--slide-w)] aspect-[1920/810] transition-opacity duration-700 ${
                  active ? 'opacity-100' : 'opacity-50 hover:opacity-80'
                }`}
                style={{
                  boxShadow: active ? `8px 8px 0 ${GOLD_PALE}` : 'none',
                  border: `1px solid ${active ? GOLD : 'transparent'}`,
                  background: CREAM,
                }}
                tabIndex={active ? 0 : -1}
                aria-hidden={!active}
                aria-label={b.title || `Banner ${i + 1}`}
              >
                {(i === 0 || seen.has(i)) && (
                  <img
                    src={b.image}
                    alt={b.title || 'Banner'}
                    width={1920}
                    height={810}
                    // First banner is the largest paint: load it at once. Others are lazy.
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    decoding={i === 0 ? 'sync' : 'async'}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Progress rail */}
        {count > 1 && (
          <div className="mt-4 sm:mt-6 flex items-center gap-3 sm:gap-6">
            <div className="min-w-0 sm:w-[22%]" style={{ color: NAVY_DARK }}>
              <p className="text-xs sm:text-sm font-medium tabular-nums">
                {index + 1} / {count}
              </p>
              {current?.title && (
                <p className="hidden sm:block truncate text-sm opacity-70">{current.title}</p>
              )}
            </div>

            <div className="flex flex-1 gap-1.5 sm:gap-2" role="tablist" aria-label="Choose banner">
              {banners.map((b, i) => (
                <button
                  key={b._id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}${b.title ? `: ${b.title}` : ''}`}
                  onClick={() => go(i)}
                  className="group relative flex-1 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: NAVY_DARK }}
                >
                  <span
                    className="block h-[3px] w-full overflow-hidden"
                    style={{ background: GOLD_PALE }}
                  >
                    {i < index && (
                      <span className="block h-full w-full" style={{ background: GOLD }} />
                    )}
                    {i === index && (
                      <span
                        key={index}
                        className={autoplay ? 'bc-fill block h-full w-full' : 'block h-full w-full'}
                        data-paused={hidden}
                        style={{ background: NAVY_DARK }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => go(index - 1)}
                className="p-1.5 sm:p-2 rounded-full transition hover:bg-white"
                style={{ color: NAVY_DARK, border: `1px solid ${GOLD}` }}
                aria-label="Previous"
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => go(index + 1)}
                className="p-1.5 sm:p-2 rounded-full transition hover:bg-white"
                style={{ color: NAVY_DARK, border: `1px solid ${GOLD}` }}
                aria-label="Next"
              >
                <ChevronRight size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}