import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card } from '../../core/cards';
import { CardFace } from './Card';
import { sfx } from '../sound';

interface Props {
  cards: Card[];
  selected: Set<Card>;
  onChange: (sel: Set<Card>) => void;
  disabled?: boolean;
}

/**
 * The player's hand. Tap a card to select it, or slide a finger across several cards
 * to select/deselect them all in one gesture (works with touch and mouse).
 */
export function Hand({ cards, selected, onChange, disabled }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(360);
  const [cw, setCw] = useState(60);
  const drag = useRef<{ mode: boolean; visited: Set<number>; sel: Set<Card> } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      if (boxRef.current) setW(boxRef.current.clientWidth);
      if (probeRef.current) setCw(probeRef.current.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const n = cards.length;
  const step = n > 1 ? Math.min(cw * 0.68, (W - cw - 8) / (n - 1)) : 0;
  const total = cw + step * Math.max(0, n - 1);
  const offset = Math.max(0, (W - total) / 2);

  const indexAt = (clientX: number): number | null => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const x = clientX - rect.left - offset;
    if (x < 0 || x > total) return null;
    if (step === 0) return 0;
    return Math.min(n - 1, Math.floor(x / step));
  };

  const apply = (idx: number) => {
    const d = drag.current;
    if (!d || d.visited.has(idx)) return;
    d.visited.add(idx);
    const card = cards[idx];
    const next = new Set(d.sel);
    if (d.mode) next.add(card);
    else next.delete(card);
    d.sel = next;
    sfx.select();
    onChange(next);
  };

  useEffect(() => {
    // drop selections of cards that left the hand
    const valid = [...selected].filter((c) => cards.includes(c));
    if (valid.length !== selected.size) onChange(new Set(valid));
  }, [cards]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={boxRef}
      className="relative w-full touch-none select-none"
      style={{ height: `calc(var(--cw) * 1.4 + var(--cw) * 0.32)` }}
      onPointerDown={(e) => {
        if (disabled) return;
        const idx = indexAt(e.clientX);
        if (idx === null) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { mode: !selected.has(cards[idx]), visited: new Set(), sel: new Set(selected) };
        apply(idx);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const idx = indexAt(e.clientX);
        if (idx !== null) apply(idx);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <div ref={probeRef} className="invisible absolute" style={{ width: 'var(--cw)' }} />
      {cards.map((c, i) => {
        const sel = selected.has(c);
        return (
          <div
            key={c}
            className="absolute bottom-1 transition-[left,transform] duration-200 ease-out"
            style={{
              left: offset + i * step,
              transform: sel ? 'translateY(calc(var(--cw) * -0.3))' : 'none',
              zIndex: i,
            }}
          >
            <CardFace card={c} size="lg" selected={sel} dim={disabled} />
          </div>
        );
      })}
    </div>
  );
}
