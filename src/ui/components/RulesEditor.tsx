import { RuleSettings, BotLevel } from '../../core/settings';
import { Field, Segmented, Toggle } from './ui';

export const BOT_LEVEL_LABEL: Record<BotLevel, string> = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

export function RulesEditor({ rules, onChange, readOnly, online }: { rules: RuleSettings; onChange?: (r: RuleSettings) => void; readOnly?: boolean; online?: boolean }) {
  const set = (patch: Partial<RuleSettings>) => onChange?.({ ...rules, ...patch });
  const dis = readOnly || !onChange;
  return (
    <div className="divide-y divide-white/10">
      <Field label="Độ khó của máy">
        <Segmented<BotLevel>
          value={rules.botLevel}
          disabled={dis}
          onChange={(botLevel) => set({ botLevel })}
          options={(['easy', 'medium', 'hard'] as BotLevel[]).map((v) => ({ value: v, label: BOT_LEVEL_LABEL[v] }))}
        />
      </Field>
      <Field label="Thời gian mỗi lượt">
        <Segmented<number>
          value={rules.turnSeconds}
          disabled={dis}
          onChange={(turnSeconds) => set({ turnSeconds })}
          options={[0, 10, 20, 30].map((v) => ({ value: v, label: v ? `${v}s` : 'Tắt' }))}
        />
      </Field>
      <Toggle disabled={dis} checked={rules.require3Spades} onChange={(v) => set({ require3Spades: v })} label="Ván đầu đánh 3♠" hint="Người có 3♠ đi trước và phải đánh kèm 3♠" />
      <Toggle disabled={dis} checked={rules.instantWin} onChange={(v) => set({ instantWin: v })} label="Tới trắng" hint="Tứ quý heo, sảnh rồng, 5 đôi thông, 6 đôi → thắng ngay" />
      <Toggle disabled={dis} checked={rules.allowChop} onChange={(v) => set({ allowChop: v })} label="Chặt heo, chặt hàng" hint="3 đôi thông, tứ quý, 4 đôi thông chặt heo" />
      <Toggle disabled={dis || !rules.allowChop} checked={rules.chopStack} onChange={(v) => set({ chopStack: v })} label="Chặt chồng" hint="Được chặt lại hàng vừa chặt, người bị chặt cuối chịu hết" />
      <Toggle disabled={dis || !rules.allowChop} checked={rules.fourPairsAnytime} onChange={(v) => set({ fourPairsAnytime: v })} label="4 đôi thông chặt không cần vòng" hint="Chặt được kể cả khi chưa tới lượt hoặc đã bỏ lượt" />
      <Toggle disabled={dis} checked={rules.penalties} onChange={(v) => set({ penalties: v })} label="Phạt cóng, thối heo, thối hàng" />
      <Toggle disabled={dis} checked={rules.playToEnd} onChange={(v) => set({ playToEnd: v })} label="Đánh đến bét (chế độ đơn)" hint="Tắt: kết thúc ván ngay khi có người về nhất" />
      {online && (
        <Field label="Chờ người mất kết nối">
          <Segmented<number>
            value={rules.disconnectSeconds}
            disabled={dis}
            onChange={(disconnectSeconds) => set({ disconnectSeconds })}
            options={[15, 30, 60, 120].map((v) => ({ value: v, label: `${v}s` }))}
          />
          <p className="mt-1 text-sm text-white/55">Hết thời gian này máy sẽ đánh thay cho đến khi người đó vào lại.</p>
        </Field>
      )}
    </div>
  );
}
