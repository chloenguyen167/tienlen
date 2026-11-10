import { CSSProperties, memo } from 'react';
import { Card, RANK_LABELS, SUITS, rankOf, suitOf, isRed } from '../../core/cards';

type Size = 'lg' | 'md' | 'sm' | 'xs';
const WIDTH: Record<Size, string> = {
  lg: 'var(--cw)',
  md: 'calc(var(--cw) * 0.82)',
  sm: 'var(--cw-sm)',
  xs: 'calc(var(--cw) * 0.42)',
};

interface Props {
  card: Card;
  size?: Size;
  selected?: boolean;
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const CardFace = memo(function CardFace({ card, size = 'lg', selected, dim, className = '', style }: Props) {
  const red = isRed(card);
  const rank = RANK_LABELS[rankOf(card)];
  const suit = SUITS[suitOf(card)];
  const w = WIDTH[size];
  return (
    <div
      className={`card-face relative shrink-0 rounded-[10%/7%] ${red ? 'text-cardred' : 'text-cardblack'} ${
        selected ? 'ring-[3px] ring-gold-400' : ''
      } ${dim ? 'brightness-75' : ''} ${className}`}
      style={{ width: w, aspectRatio: '5 / 7', ...style }}
      aria-label={`${rank}${suit}`}
    >
      <div
        className="absolute left-[7%] top-[4%] flex flex-col items-center leading-none font-bold"
        style={{ fontSize: `calc(${w} * 0.3)` }}
      >
        <span className={rank === '10' ? 'tracking-[-0.08em]' : ''}>{rank}</span>
        <span style={{ fontSize: `calc(${w} * 0.26)` }}>{suit}</span>
      </div>
      <div
        className="absolute bottom-[5%] right-[8%] leading-none"
        style={{ fontSize: `calc(${w} * 0.5)` }}
      >
        {suit}
      </div>
    </div>
  );
});

export function CardBack({ size = 'sm', className = '', style }: { size?: Size; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`card-back shrink-0 rounded-[10%/7%] ${className}`}
      style={{ width: WIDTH[size], aspectRatio: '5 / 7', ...style }}
    />
  );
}

/** A small row of overlapping cards (for plays on the table, guides, results). */
export function CardRow({ cards, size = 'md', overlap = 0.55, className = '' }: { cards: Card[]; size?: Size; overlap?: number; className?: string }) {
  return (
    <div className={`flex ${className}`}>
      {cards.map((c, i) => (
        <CardFace
          key={c}
          card={c}
          size={size}
          style={i ? { marginLeft: `calc(${WIDTH[size]} * -${overlap})` } : undefined}
        />
      ))}
    </div>
  );
}
