export type BotLevel = 'easy' | 'medium' | 'hard';

export interface RuleSettings {
  /** Ván đầu: người có 3♠ đi trước và phải đánh kèm 3♠. */
  require3Spades: boolean;
  /** Tới trắng: thắng ngay khi chia bài (tứ quý 2, sảnh rồng, 5 đôi thông, 6 đôi). */
  instantWin: boolean;
  /** Cho phép chặt heo / chặt hàng (3 đôi thông, tứ quý, 4 đôi thông). */
  allowChop: boolean;
  /** Cho phép chặt chồng (chặt lại hàng vừa chặt). */
  chopStack: boolean;
  /** 4 đôi thông được chặt không cần vòng (kể cả đã bỏ lượt / chưa tới lượt). */
  fourPairsAnytime: boolean;
  /** Tính phạt cóng, thối 2, thối hàng. */
  penalties: boolean;
  /** Chế độ đơn: chơi tiếp tới khi xếp hạng đủ (nhất → bét). Tắt = kết thúc khi có người về nhất. */
  playToEnd: boolean;
  /** Giây cho mỗi lượt của người chơi. 0 = không giới hạn. */
  turnSeconds: number;
  /** Độ khó của máy. */
  botLevel: BotLevel;
  /** Online: số giây chờ người mất kết nối trước khi máy đánh thay. */
  disconnectSeconds: number;
}

export const DEFAULT_RULES: RuleSettings = {
  require3Spades: true,
  instantWin: true,
  allowChop: true,
  chopStack: true,
  fourPairsAnytime: true,
  penalties: true,
  playToEnd: true,
  turnSeconds: 20,
  botLevel: 'medium',
  disconnectSeconds: 60,
};

export const withDefaultRules = (r?: Partial<RuleSettings>): RuleSettings => ({ ...DEFAULT_RULES, ...(r ?? {}) });
