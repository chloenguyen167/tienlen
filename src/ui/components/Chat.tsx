import { useEffect, useRef, useState } from 'react';
import { ChatMsg } from '../../net/protocol';
import { Modal } from './ui';

export const QUICK_CHAT = ['Nhanh lên nào! ⏰', 'Hay quá! 👏', 'Chặt nè! 💥', 'Ván nữa nhé 🎴', 'Xin lỗi nha 🙏', 'GG 🤝', '😂', '😭', '😎', '🔥'];

export function ChatSheet({ open, onClose, messages, onSend, mySeat }: { open: boolean; onClose: () => void; messages: ChatMsg[]; onSend: (t: string) => void; mySeat: number }) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 1e6 });
  }, [messages.length, open]);
  const send = (t: string) => {
    if (!t.trim()) return;
    onSend(t);
    setText('');
  };
  return (
    <Modal open={open} onClose={onClose} title="Trò chuyện">
      <div ref={listRef} className="no-scrollbar mb-3 max-h-56 space-y-1.5 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-white/50">Chưa có tin nhắn.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.seat === mySeat ? 'justify-end' : ''}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.seat === mySeat ? 'bg-gold-500 text-felt-900' : 'bg-white/10'}`}>
              {m.seat !== mySeat && <span className="mr-1 font-semibold text-gold-400">{m.name}:</span>}
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_CHAT.map((q) => (
          <button key={q} className="rounded-full bg-white/10 px-3 py-1.5 text-sm active:scale-95" onClick={() => { send(q); onClose(); }}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          placeholder="Nhập tin nhắn…"
          className="min-w-0 flex-1 rounded-2xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/15 focus:ring-gold-400"
        />
        <button className="btn-gold px-5" type="submit">
          Gửi
        </button>
      </form>
    </Modal>
  );
}

/** Latest chat line per seat, shown as a bubble for a few seconds. */
export function useChatBubbles(messages: ChatMsg[], onNew?: (m: ChatMsg) => void): Record<number, string> {
  const [bubbles, setBubbles] = useState<Record<number, string>>({});
  const seen = useRef<number>(messages.length ? messages[messages.length - 1].id : 0);
  useEffect(() => {
    const fresh = messages.filter((m) => m.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    for (const m of fresh) {
      onNew?.(m);
      setBubbles((b) => ({ ...b, [m.seat]: m.text }));
      setTimeout(() => setBubbles((b) => (b[m.seat] === m.text ? { ...b, [m.seat]: '' } : b)), 4000);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps
  return bubbles;
}
