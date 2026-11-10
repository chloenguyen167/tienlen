import { AVATARS } from '../../net/protocol';
import { useProfile } from '../../store/profileStore';

export function ProfileEditor() {
  const { name, avatar, setName, setAvatar } = useProfile();
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block font-medium">Tên hiển thị</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="Nhập tên của bạn"
          className="w-full rounded-2xl bg-black/30 px-4 py-3 text-base outline-none ring-1 ring-white/15 focus:ring-gold-400"
        />
      </label>
      <div className="mt-3 mb-1.5 font-medium">Ảnh đại diện</div>
      <div className="grid grid-cols-8 gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            onClick={() => setAvatar(a)}
            className={`grid aspect-square place-items-center rounded-2xl text-2xl transition active:scale-90 ${a === avatar ? 'bg-gold-500/30 ring-2 ring-gold-400' : 'bg-white/5'}`}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}
