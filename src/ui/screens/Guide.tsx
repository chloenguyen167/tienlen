import { ReactNode } from 'react';
import { CardRow } from '../components/Card';
import { Page, Section } from '../components/ui';
import { makeCard } from '../../core/cards';

const m = makeCard;
const S = 0, C = 1, D = 2, H = 3;

function Example({ title, cards, children }: { title: string; cards: number[]; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <CardRow cards={cards} size="sm" overlap={0.5} />
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {children && <div className="text-sm text-white/65">{children}</div>}
      </div>
    </div>
  );
}

const Li = ({ children }: { children: ReactNode }) => <li className="py-0.5">{children}</li>;

export function Guide() {
  return (
    <Page title="Hướng dẫn">
      <Section title="Mục tiêu">
        <p>
          Mỗi người được chia <b>13 lá</b>. Ai <b>đánh hết bài trước</b> là người thắng. Ở chế độ đơn, những người còn lại tiếp tục đánh để xếp hạng nhì, ba, bét.
        </p>
      </Section>

      <Section title="Thứ tự lá bài">
        <p className="mb-2">Số: 3 &lt; 4 &lt; 5 … &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; <b>2 (heo)</b>.</p>
        <CardRow cards={[m(3, S), m(7, S), m(11, S), m(14, S), m(15, S)]} size="sm" overlap={0.2} />
        <p className="mt-3 mb-2">Cùng số thì so chất: ♠ Bích &lt; ♣ Chuồn &lt; ♦ Rô &lt; ♥ Cơ.</p>
        <CardRow cards={[m(9, S), m(9, C), m(9, D), m(9, H)]} size="sm" overlap={0.2} />
      </Section>

      <Section title="Các bộ bài">
        <Example title="Rác (1 lá)" cards={[m(8, D)]} />
        <Example title="Đôi" cards={[m(10, S), m(10, H)]}>2 lá cùng số</Example>
        <Example title="Sám cô" cards={[m(6, S), m(6, C), m(6, D)]}>3 lá cùng số</Example>
        <Example title="Sảnh" cards={[m(5, S), m(6, D), m(7, C), m(8, H)]}>Từ 3 lá liên tiếp trở lên, không được có heo</Example>
        <Example title="Đôi thông" cards={[m(4, S), m(4, H), m(5, C), m(5, D), m(6, S), m(6, H)]}>Từ 3 đôi liên tiếp trở lên</Example>
        <Example title="Tứ quý" cards={[m(12, S), m(12, C), m(12, D), m(12, H)]}>4 lá cùng số</Example>
      </Section>

      <Section title="Cách đánh">
        <ul className="list-disc space-y-1 pl-5">
          <Li>Ván đầu tiên: người có <b>3♠</b> đi trước và phải đánh kèm lá 3♠. Các ván sau, người thắng ván trước đi trước.</Li>
          <Li>Người ra bài được đánh bộ bất kỳ. Người kế tiếp phải đánh <b>cùng loại, cùng số lá và lớn hơn</b> để chặn, hoặc <b>bỏ lượt</b>.</Li>
          <Li>Đã bỏ lượt thì <b>không được đánh tiếp trong vòng đó</b>.</Li>
          <Li>Khi tất cả bỏ lượt, người đánh cuối cùng được ra bài mới. Nếu người đó đã hết bài, người kế tiếp được ra.</Li>
          <Li>Sảnh và đôi thông so lá lớn nhất. VD sảnh 5-6-7♥ chặn được 5-6-7♠.</Li>
        </ul>
      </Section>

      <Section title="Chặt heo & chặt hàng">
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/10 text-left">
              <tr>
                <th className="p-2">Dùng</th>
                <th className="p-2">Chặt được</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr><td className="p-2 font-semibold">3 đôi thông</td><td className="p-2">1 heo, 3 đôi thông nhỏ hơn</td></tr>
              <tr><td className="p-2 font-semibold">Tứ quý</td><td className="p-2">1 heo, đôi heo, 3 đôi thông, tứ quý nhỏ hơn</td></tr>
              <tr><td className="p-2 font-semibold">4 đôi thông</td><td className="p-2">Heo, đôi heo, 3 đôi thông, tứ quý, 4 đôi thông nhỏ hơn</td></tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/80">
          <Li><b>Chặt chồng</b>: hàng vừa chặt có thể bị chặt lại. Người bị chặt cuối cùng chịu toàn bộ điểm.</Li>
          <Li><b>4 đôi thông chặt không cần vòng</b>: được chặt kể cả khi chưa tới lượt hoặc đã bỏ lượt. Khi có cơ hội, nút <b>“Chặt ngay”</b> sẽ hiện ra.</Li>
        </ul>
      </Section>

      <Section title="Tới trắng (thắng ngay khi chia bài)">
        <ul className="list-disc space-y-1 pl-5">
          <Li>Tứ quý heo (bốn lá 2)</Li>
          <Li>Sảnh rồng: đủ 3 → A</Li>
          <Li>5 đôi thông</Li>
          <Li>6 đôi bất kỳ</Li>
        </ul>
      </Section>

      <Section title="Tính điểm">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <Li>Chế độ đơn: Nhất <b>+3</b>, Nhì <b>+1</b>, Ba <b>−1</b>, Bét <b>−3</b>.</Li>
          <Li>Chế độ đội: đội thắng mỗi người <b>+2</b>, đội thua mỗi người <b>−2</b>.</Li>
          <Li>Bị chặt: heo đen 2, heo đỏ 4, 3 đôi thông 5, tứ quý 6, 4 đôi thông 8 điểm, trả cho người chặt.</Li>
          <Li>Thối (người bét hoặc bị cóng còn giữ heo / hàng): trả cho người nhất theo bảng trên.</Li>
          <Li>Cóng (chưa đánh được lá nào khi có người về nhất): trả 6 điểm cho người nhất và xếp bét.</Li>
          <Li>Tới trắng: mỗi người thua trả 4 điểm.</Li>
        </ul>
      </Section>

      <Section title="Chế độ chơi">
        <ul className="list-disc space-y-1 pl-5">
          <Li><b>Chơi với máy</b>: bạn đấu với 3 máy, không cần mạng. Có thể chọn đánh đội cùng một máy.</Li>
          <Li><b>Đánh đơn online</b>: tạo phòng, mời bạn bè. Ghế trống do máy chơi.</Li>
          <Li><b>Đánh đội online</b>: bạn và 1 người bạn ngồi đối diện là đồng đội, đấu với 2 máy. Một người trong đội về nhất là <b>cả đội thắng</b>.</Li>
        </ul>
      </Section>

      <Section title="Tạo phòng & mời bạn">
        <ol className="list-decimal space-y-1 pl-5">
          <Li>Bấm <b>Tạo phòng mời bạn</b>, chọn chế độ rồi bấm <b>Tạo phòng</b>.</Li>
          <Li>Bấm <b>Mời bạn bè</b> để gửi link (Zalo, Messenger…) hoặc đọc mã phòng 6 ký tự.</Li>
          <Li>Bạn bè mở link hoặc vào <b>Vào phòng bằng mã</b>.</Li>
          <Li>Đủ người thì chủ phòng bấm <b>Bắt đầu chia bài</b>.</Li>
        </ol>
        <p className="mt-3 text-sm text-white/70">
          Game kết nối trực tiếp giữa các trình duyệt (P2P), không có máy chủ. Máy của <b>chủ phòng</b> giữ ván đấu, nên chủ phòng cần mở trang trong lúc chơi.
        </p>
      </Section>

      <Section title="Thoát ra & vào lại">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <Li>Ván chơi được tự động lưu trên trình duyệt. Mở lại trang, chọn mục <b>Chơi tiếp</b> ở trang chủ.</Li>
          <Li>Nếu người chơi online mất mạng, ván chờ họ quay lại (mặc định 60 giây), sau đó máy đánh thay. Khi họ vào lại thì được chơi tiếp.</Li>
          <Li>Nếu chủ phòng thoát, mọi người chờ chủ phòng mở lại trang là chơi tiếp.</Li>
          <Li>Xoá dữ liệu trình duyệt (trong Cài đặt) sẽ xoá các ván đang lưu.</Li>
        </ul>
      </Section>

      <Section title="Mẹo thao tác trên điện thoại">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <Li><b>Chạm</b> vào lá để chọn, <b>vuốt ngang</b> qua nhiều lá để chọn cả dãy.</Li>
          <Li><b>Gợi ý</b>: tự chọn bộ bài hợp lệ. Bấm tiếp để xem các lựa chọn khác.</Li>
          <Li><b>Xếp bộ</b>: gom bài thành sảnh, đôi, sám… cho dễ nhìn.</Li>
          <Li>Chơi nhanh hơn: trên trình duyệt chọn <b>Thêm vào màn hình chính</b> để mở như một ứng dụng.</Li>
        </ul>
      </Section>
    </Page>
  );
}
