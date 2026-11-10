import { AnimatePresence, motion } from 'framer-motion';
import { GameView } from '../../core/game';
import { comboName } from '../../core/combos';
import { CardRow } from './Card';

const FROM: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 120 },
  1: { x: 120, y: 0 },
  2: { x: 0, y: -120 },
  3: { x: -120, y: 0 },
};

export function TrickArea({ view, rel }: { view: GameView; rel: (seat: number) => number }) {
  const plays = view.trickPlays;
  const last = plays[plays.length - 1];
  const prev = plays[plays.length - 2];
  const name = (s: number) => view.players[s]?.name ?? '';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      {prev && (
        <div className="absolute opacity-45" style={{ transform: 'translateY(-28%) scale(0.72) rotate(-4deg)' }}>
          <CardRow cards={prev.cards} size="md" overlap={0.6} />
        </div>
      )}
      <AnimatePresence mode="popLayout">
        {last ? (
          <motion.div
            key={`${last.seat}-${last.cards.join('-')}`}
            initial={{ ...FROM[rel(last.seat)], opacity: 0, scale: 0.7 }}
            animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="relative z-10 flex flex-col items-center gap-1.5"
          >
            <CardRow cards={last.cards} size={last.cards.length > 5 ? 'md' : 'lg'} overlap={last.cards.length > 6 ? 0.62 : 0.5} />
            <div className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium">
              {name(last.seat)} · {comboName(last.combo)}
            </div>
            {last.chop && (
              <motion.div
                initial={{ scale: 2.4, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                className="absolute -top-6 right-0 rounded-xl bg-rose-600 px-3 py-1 text-xl font-black tracking-wider text-white shadow-xl ring-2 ring-white"
              >
                CHẶT!
              </motion.div>
            )}
          </motion.div>
        ) : (
          view.phase === 'playing' && (
            <motion.div key="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-full bg-black/30 px-4 py-2 text-sm text-white/80">
              {view.turn === view.mySeat ? 'Bạn được ra bài' : `${name(view.turn)} ra bài`}
              {view.mustPlay3S && ' (phải có 3♠)'}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
