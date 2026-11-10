import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, removeCards } from '../../core/cards';
import { checkPlay, describeEvent, GameView, teamOf } from '../../core/game';
import { analyzeHand, realizeGroup } from '../../ai/handAnalyzer';
import { hintPlays, interruptOption } from '../../ai/bot';
import { Controller, TableSnapshot } from '../../net/controller';
import { useProfile } from '../../store/profileStore';
import { useSettings, BotSpeed } from '../../store/settingsStore';
import { Hand } from './Hand';
import { Seat, Avatar, PLACE_LABEL, TEAM_COLOR } from './Seat';
import { TrickArea } from './TrickArea';
import { ResultModal } from './ResultModal';
import { ChatSheet, useChatBubbles } from './Chat';
import { RulesEditor } from './RulesEditor';
import { Modal, Segmented, Toggle, toast, useNow } from './ui';
import { buzz, sfx } from '../sound';

function groupOrder(hand: Card[]): Card[] {
  let rest = [...hand];
  const out: Card[] = [];
  for (const g of analyzeHand(hand).groups) {
    const cards = realizeGroup(g, rest);
    out.push(...cards);
    rest = removeCards(rest, cards) ?? rest;
  }
  return [...out, ...rest];
}

interface Props {
  snap: TableSnapshot;
  controller: Controller;
  /** go home, keep the table saved */
  onExit: () => void;
  /** quit this table for good */
  onLeave: () => void;
}

export function GameTable({ snap, controller, onExit, onLeave }: Props) {
  const view = snap.view as GameView;
  const room = snap.room;
  const me = view.mySeat;
  const isGuest = snap.role === 'guest';
  const online = snap.role !== 'local';
  const rel = (seat: number) => (seat - me + 4) % 4;
  const seatAt = (r: number) => (me + r) % 4;

  const [selected, setSelected] = useState<Set<Card>>(new Set());
  const [sortByGroup, setSortByGroup] = useState(false);
  const [hintIdx, setHintIdx] = useState(-1);
  const [showResult, setShowResult] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const settings = useSettings();
  const recordGame = useProfile((s) => s.recordGame);

  const myTurn = view.phase === 'playing' && view.turn === me;
  const now = useNow(view.phase === 'playing' && (snap.deadline !== null || Object.keys(snap.waiting).length > 0));

  // ---- events → sounds / toasts
  const lastEvent = useRef<number>(view.events.length ? view.events[view.events.length - 1].id : 0);
  const lastGame = useRef(view.id);
  useEffect(() => {
    if (lastGame.current !== view.id) {
      lastGame.current = view.id;
      lastEvent.current = 0;
      setShowResult(false);
    }
    const fresh = view.events.filter((e) => e.id > lastEvent.current);
    if (!fresh.length) return;
    lastEvent.current = fresh[fresh.length - 1].id;
    for (const e of fresh) {
      if (e.type === 'play') {
        if (e.chop) {
          sfx.chop();
          buzz([60, 40, 120]);
          toast(describeEvent(e, view.players), 'warn');
        } else sfx.play();
      } else if (e.type === 'pass') sfx.pass();
      else if (e.type === 'finish' || e.type === 'cong' || e.type === 'instantWin') toast(describeEvent(e, view.players), e.type === 'finish' ? 'good' : 'warn');
    }
  }, [view.events, view.id, view.players]);

  // ---- my turn notification
  useEffect(() => {
    if (myTurn) {
      sfx.myTurn();
      buzz(40);
    }
    setHintIdx(-1);
  }, [myTurn, view.moveNo]);

  // ---- game over
  useEffect(() => {
    if (view.phase !== 'ended' || !view.result) return;
    const r = view.result;
    const won = view.mode === 'team' ? r.winnerTeam === teamOf(me) : r.ranking[0] === me;
    recordGame(view.id, won, r.deltas[me]);
    const t = setTimeout(() => {
      setShowResult(true);
      if (won) sfx.win();
      else sfx.lose();
    }, 900);
    return () => clearTimeout(t);
  }, [view.phase, view.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- chat
  const bubbles = useChatBubbles(snap.chat, (m) => {
    if (m.seat !== me) {
      sfx.chat();
      if (!chatOpen) setUnread((u) => u + 1);
    }
  });

  const hand = useMemo(() => (sortByGroup ? groupOrder(view.myHand) : view.myHand), [view.myHand, sortByGroup]);
  const selCards = [...selected];
  const check = selCards.length ? checkPlay(view, me, selCards, view.myHand) : null;
  const interrupt = useMemo(() => interruptOption(view), [view]);
  const hints = useMemo(() => (myTurn ? hintPlays(view) : []), [view, myTurn]);

  const doPlay = (cards: Card[]) => {
    const err = controller.act({ type: 'play', seat: me, cards });
    if (err) {
      sfx.error();
      toast(err, 'warn');
    } else setSelected(new Set());
  };
  const doPass = () => {
    const err = controller.act({ type: 'pass', seat: me });
    if (err) toast(err, 'warn');
    else setSelected(new Set());
  };
  const doHint = () => {
    if (!hints.length) {
      toast('Không có bài chặn được, hãy bỏ lượt');
      return;
    }
    const i = (hintIdx + 1) % hints.length;
    setHintIdx(i);
    setSelected(new Set(hints[i]));
  };

  const timeFrac = snap.deadline !== null && view.rules.turnSeconds ? (snap.deadline - now) / (view.rules.turnSeconds * 1000) : null;
  const total = (seat: number) => room?.totals[seat] ?? 0;
  const waitingText = (seat: number): string | undefined => {
    if (!(seat in snap.waiting)) return undefined;
    const until = snap.waiting[seat];
    if (!until) return 'Mất kết nối';
    const left = Math.ceil((until - now) / 1000);
    return left > 0 ? `Chờ vào lại ${left}s` : 'Máy đánh thay';
  };
  const showTeam = view.mode === 'team';
  const seatProps = (seat: number) => ({
    seat,
    view,
    info: room?.seats[seat],
    name: view.players[seat].name,
    avatar: view.players[seat].avatar,
    isTurn: view.phase === 'playing' && view.turn === seat,
    timeLeft: view.turn === seat ? timeFrac : null,
    showTeam,
    isMate: showTeam && teamOf(seat) === teamOf(me) && seat !== me,
    total: total(seat),
    bubble: bubbles[seat] || undefined,
    waitingText: waitingText(seat),
  });

  const myPlace = view.finished.indexOf(me);
  const iAmOut = myPlace >= 0 || view.cong.includes(me);
  let statusLine = '';
  if (view.phase === 'ended') statusLine = 'Ván đã kết thúc';
  else if (iAmOut) statusLine = myPlace >= 0 ? `Bạn đã về ${PLACE_LABEL[myPlace].toLowerCase()}! Đang chờ mọi người…` : 'Bạn bị cóng 😢';
  else if (myTurn) statusLine = view.lastPlay ? 'Tới lượt bạn: chặn hoặc bỏ lượt' : 'Tới lượt bạn ra bài';
  else statusLine = `Đang chờ ${view.players[view.turn]?.name ?? ''}…`;

  const playLabel = check?.ok && check.chop ? 'Chặt!' : 'Đánh';
  const canPlay = !!check?.ok && (myTurn || check.interrupt);

  return (
    <div className="felt felt-texture relative flex h-dvh flex-col overflow-hidden">
      {/* Header */}
      <header className="safe-top safe-x relative z-20 flex items-center gap-2 [--sx:0.75rem] pb-1">
        <button className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-xl" onClick={onExit} aria-label="Về trang chủ">
          ‹
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-bold">{online ? `Phòng ${room?.code ?? ''}` : 'Chơi với máy'}</div>
          <div className="text-xs text-white/60 short:hidden">
            {view.mode === 'team' ? 'Đánh đội' : 'Đánh đơn'} · Ván {Math.max(1, (room?.gamesPlayed ?? 0) + (view.phase === 'playing' ? 1 : 0))}
          </div>
        </div>
        {online && (
          <button
            className="relative grid h-10 w-10 place-items-center rounded-full bg-black/25 text-lg"
            onClick={() => {
              setChatOpen(true);
              setUnread(0);
            }}
            aria-label="Trò chuyện"
          >
            💬
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold">{unread}</span>}
          </button>
        )}
        <button className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-lg" onClick={() => setMenuOpen(true)} aria-label="Menu">
          ☰
        </button>
      </header>

      {snap.status !== 'online' && snap.statusText && (
        <div className="relative z-20 mx-3 rounded-xl bg-amber-500/90 px-3 py-1.5 text-center text-xs font-semibold text-felt-900">{snap.statusText}</div>
      )}

      {/* Arena */}
      <div className="relative mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr] gap-1 overflow-hidden px-2">
        <div className="col-start-2 row-start-1 flex justify-center pt-1">
          <Seat {...seatProps(seatAt(2))} compact />
        </div>
        <div className="col-start-1 row-start-2 flex items-center">
          <Seat {...seatProps(seatAt(3))} compact />
        </div>
        <div className="col-start-2 row-start-2 min-h-0">
          <TrickArea view={view} rel={rel} />
        </div>
        <div className="col-start-3 row-start-2 flex items-center">
          <Seat {...seatProps(seatAt(1))} compact />
        </div>
      </div>

      {/* Me */}
      <div className="safe-x relative z-10 mx-auto w-full max-w-3xl [--sx:0.75rem] short:flex short:items-center short:gap-3">
        <div className="flex items-center gap-2 short:min-w-0 short:flex-1">
          <Avatar
            avatar={view.players[me].avatar}
            size={40}
            isTurn={myTurn}
            timeLeft={myTurn ? timeFrac : null}
            teamColor={showTeam ? TEAM_COLOR[teamOf(me)] : undefined}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">
              {view.players[me].name} <span className={total(me) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>({total(me) > 0 ? '+' : ''}{total(me)})</span>
            </div>
            <div className={`truncate text-xs ${myTurn ? 'font-semibold text-gold-400' : 'text-white/65'}`}>
              {check && !check.ok && selCards.length ? <span className="text-rose-300">{check.error}</span> : statusLine}
            </div>
          </div>
          {bubbles[me] && <span className="max-w-[40%] truncate rounded-2xl bg-white px-3 py-1 text-sm text-felt-900">{bubbles[me]}</span>}
        </div>

        {/* Actions */}
        <div className="mt-2 grid grid-cols-4 gap-2 short:mt-0 short:w-[58%] short:shrink-0">
          {view.phase === 'ended' ? (
            <>
              <button className="btn-ghost col-span-2 py-2.5" onClick={() => setShowResult(true)}>
                Xem kết quả
              </button>
              {isGuest ? (
                <div className="col-span-2 grid place-items-center text-center text-xs text-white/70">Chờ chủ phòng chia ván mới…</div>
              ) : (
                <button className="btn-gold col-span-2 py-2.5" onClick={() => controller.startGame()}>
                  Ván mới
                </button>
              )}
            </>
          ) : interrupt && !myTurn ? (
            <button className="btn-red turn-glow col-span-4 py-2.5" onClick={() => doPlay(interrupt)}>
              💥 Chặt ngay bằng {interrupt.length / 2} đôi thông!
            </button>
          ) : (
            <>
              <button className="btn-ghost px-1 py-2.5 text-sm" onClick={() => setSortByGroup((v) => !v)} disabled={iAmOut}>
                {sortByGroup ? 'Xếp số' : 'Xếp bộ'}
              </button>
              <button className="btn-ghost px-1 py-2.5 text-sm" onClick={doHint} disabled={!myTurn}>
                Gợi ý
              </button>
              <button className="btn-ghost px-1 py-2.5 text-sm" onClick={doPass} disabled={!myTurn || !view.lastPlay}>
                Bỏ lượt
              </button>
              <button
                className={`${check?.ok && check.chop ? 'btn-red' : 'btn-gold'} px-1 py-2.5 text-sm`}
                onClick={() => doPlay(selCards)}
                disabled={!canPlay}
              >
                {playLabel}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hand */}
      <div className="safe-bottom safe-x relative z-10 mx-auto w-full max-w-4xl [--sx:0.5rem] pt-1 short:pb-1">
        <Hand cards={hand} selected={selected} onChange={setSelected} disabled={iAmOut || view.phase === 'ended'} />
      </div>

      <ResultModal
        open={showResult}
        view={view}
        room={room}
        canDeal={!isGuest}
        onDeal={() => {
          setShowResult(false);
          controller.startGame();
        }}
        onClose={() => setShowResult(false)}
        onExit={onExit}
      />

      <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} messages={snap.chat} onSend={(t) => controller.chat(t)} mySeat={me} />

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Tuỳ chọn">
        <Toggle checked={settings.sound} onChange={(v) => settings.set({ sound: v })} label="Âm thanh" />
        <Toggle checked={settings.vibrate} onChange={(v) => settings.set({ vibrate: v })} label="Rung khi tới lượt" />
        {!isGuest && (
          <div className="py-2">
            <div className="mb-1.5 font-medium">Tốc độ máy đánh</div>
            <Segmented<BotSpeed>
              value={settings.botSpeed}
              onChange={(botSpeed) => settings.set({ botSpeed })}
              options={[
                { value: 'slow', label: 'Chậm' },
                { value: 'normal', label: 'Vừa' },
                { value: 'fast', label: 'Nhanh' },
              ]}
            />
          </div>
        )}
        <details className="mt-2 rounded-2xl bg-black/20 p-3">
          <summary className="cursor-pointer font-medium">Luật đang áp dụng</summary>
          <RulesEditor rules={view.rules} readOnly online={online} />
        </details>
        <div className="mt-4 grid gap-2">
          <Link to="/guide" className="btn-ghost">
            📖 Hướng dẫn chơi
          </Link>
          <button className="btn-ghost" onClick={onExit}>
            🏠 Về trang chủ (giữ ván để chơi tiếp)
          </button>
          <button className="btn-red" onClick={() => setConfirmLeave(true)}>
            {snap.role === 'host' ? 'Đóng phòng' : snap.role === 'guest' ? 'Rời phòng' : 'Bỏ ván này'}
          </button>
        </div>
      </Modal>

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Chắc chắn chứ?">
        <p className="text-white/80">
          {snap.role === 'host'
            ? 'Phòng sẽ bị đóng, mọi người trong phòng sẽ bị ngắt kết nối.'
            : snap.role === 'guest'
              ? 'Bạn sẽ rời phòng, máy sẽ chơi thay ghế của bạn.'
              : 'Ván đang chơi sẽ bị xoá.'}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn-ghost" onClick={() => setConfirmLeave(false)}>
            Huỷ
          </button>
          <button className="btn-red" onClick={onLeave}>
            Đồng ý
          </button>
        </div>
      </Modal>
    </div>
  );
}
