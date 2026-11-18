'use client';

import { useEffect, useRef, useState } from 'react';

// Fades / slides children in once they scroll into view.
// Usage: <Reveal delay={120} direction="up">...</Reveal>
export default function Reveal({
  children,
  delay = 0,
  direction = 'up', // 'up' | 'left' | 'right' | 'zoom' | 'fade'
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`rv rv-${direction} ${shown ? 'rv-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}