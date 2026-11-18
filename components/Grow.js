'use client';

import { useEffect, useRef, useState } from 'react';

// Adds the class "in" once the wrapper scrolls into view (runs once).
// All motion lives in CSS, so the server page stays a static ISR page.
export default function Grow({ children, className = '', threshold = 0.3 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={`${className} ${seen ? 'in' : ''}`}>
      {children}
    </div>
  );
}