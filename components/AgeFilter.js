import Link from 'next/link';
import { normalizeLabel } from '@/lib/age';

const NAVY = '#102A56';
const NAVY_DARK = '#071A3A';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E6D39A';

export default function AgeFilter({ ages, value, onChange, buildHref }) {
  if (!ages?.length) return null;

  const items = [{ label: 'All ages', value: '' }, ...ages.map((a) => ({ label: a, value: a }))];

  return (
    <section aria-label="Shop by age" className="pt-6">
      <h2 className="text-sm font-bold mb-3" style={{ color: NAVY_DARK }}>
        Shop by age
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.value
            ? normalizeLabel(value || '') === normalizeLabel(item.value)
            : !value;

          const className =
            'shrink-0 px-4 py-2 text-xs font-medium rounded-full border transition-colors ' +
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A227]';
          const style = {
            background: active ? NAVY : '#FFFFFF',
            color: active ? GOLD_LIGHT : NAVY,
            borderColor: active ? GOLD : GOLD_LIGHT,
          };

          if (buildHref) {
            return (
              <Link
                key={item.label}
                href={buildHref(item.value)}
                scroll={false}
                aria-current={active ? 'true' : undefined}
                className={className}
                style={style}
              >
                {item.label}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange?.(item.value)}
              className={className}
              style={style}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}