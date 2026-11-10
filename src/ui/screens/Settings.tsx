import { useState } from 'react';
import { useSettings, BotSpeed } from '../../store/settingsStore';
import { useProfile } from '../../store/profileStore';
import { clearAllData, clearSavedGames } from '../../store/persistence';
import { detach } from '../../net/session';
import { RulesEditor } from '../components/RulesEditor';
import { ProfileEditor } from '../components/ProfileEditor';
import { Modal, Page, Section, Segmented, Toggle, toast } from '../components/ui';

export function Settings() {
  const s = useSettings();
  const stats = useProfile((p) => p.stats);
  const [confirm, setConfirm] = useState<null | 'games' | 'all'>(null);

  const doClear = () => {
    detach();
    if (confirm === 'all') {
      clearAllData();
      location.replace(location.pathname);
      setTimeout(() => location.reload(), 50);
    } else {
      clearSavedGames();
      toast('Đã xoá các ván đang lưu', 'good');
    }
    setConfirm(null);
  };

  return (
    <Page title="Cài đặt">
      <Section title="Hồ sơ">
        <ProfileEditor />
        <p className="mt-3 text-sm text-white/55">
          Đã chơi {stats.played} ván · Thắng {stats.wins} ({stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%) · Tổng điểm {stats.points}
        </p>
      </Section>

      <Section title="Âm thanh & hiển thị">
        <Toggle checked={s.sound} onChange={(v) => s.set({ sound: v })} label="Âm thanh" />
        <Toggle checked={s.vibrate} onChange={(v) => s.set({ vibrate: v })} label="Rung khi tới lượt / bị chặt" hint="Chỉ trên điện thoại hỗ trợ" />
        <div className="py-2">
          <div className="mb-1.5 font-medium">Tốc độ máy đánh</div>
          <Segmented<BotSpeed>
            value={s.botSpeed}
            onChange={(botSpeed) => s.set({ botSpeed })}
            options={[
              { value: 'slow', label: 'Chậm' },
              { value: 'normal', label: 'Vừa' },
              { value: 'fast', label: 'Nhanh' },
            ]}
          />
        </div>
      </Section>

      <Section title="Luật mặc định cho ván mới">
        <RulesEditor rules={s.rules} onChange={(r) => s.setRules(r)} online />
        <button className="btn-ghost mt-3 w-full" onClick={() => { s.resetRules(); toast('Đã khôi phục luật mặc định', 'good'); }}>
          ↺ Khôi phục mặc định
        </button>
      </Section>

      <Section title="Dữ liệu trình duyệt">
        <p className="text-sm text-white/65">
          Game không có máy chủ: hồ sơ, cài đặt và ván đang chơi chỉ được lưu trong trình duyệt này (localStorage).
        </p>
        <div className="mt-3 grid gap-2">
          <button className="btn-ghost" onClick={() => setConfirm('games')}>
            🗂️ Xoá các ván đang lưu
          </button>
          <button className="btn-red" onClick={() => setConfirm('all')}>
            🗑️ Xoá toàn bộ dữ liệu
          </button>
        </div>
      </Section>

      <p className="mt-6 text-center text-xs text-white/40">Tiến Lên · phiên bản 1.0 · Mã nguồn mở trên GitHub</p>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Xác nhận xoá">
        <p className="text-white/80">
          {confirm === 'all'
            ? 'Xoá hồ sơ, thống kê, cài đặt và mọi ván/phòng đang lưu trên trình duyệt này. Không thể hoàn tác.'
            : 'Xoá ván chơi với máy, phòng bạn tạo và phòng bạn đã vào. Bạn sẽ không vào lại được các ván này.'}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn-ghost" onClick={() => setConfirm(null)}>
            Huỷ
          </button>
          <button className="btn-red" onClick={doClear}>
            Xoá
          </button>
        </div>
      </Modal>
    </Page>
  );
}
