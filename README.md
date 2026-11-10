# Tiến Lên Miền Nam 🃏

Game bài Tiến Lên chạy hoàn toàn trên trình duyệt, ưu tiên điện thoại. Không backend, không database.

**Chơi:** https://chloenguyen167.github.io/tienlen/

## Tính năng
- **Chơi với máy:** 1 người đấu 3 máy (Dễ / Trung bình / Khó). Có thể chọn đánh đội với 1 máy.
- **Đánh đơn online:** tạo phòng, mời bạn bè qua link hoặc mã 6 ký tự. Ghế trống do máy chơi.
- **Đánh đội online:** 2 người ngồi đối diện là đồng đội, đấu với 2 máy. Một người về nhất thì cả đội thắng.
- **Lưu tự động** trong trình duyệt (localStorage). Thoát ra rồi mở lại vẫn chơi tiếp được, kể cả phòng online.
- **Luật tuỳ chỉnh:** 3♠ ván đầu, tới trắng, chặt heo/chặt chồng, 4 đôi thông không cần vòng, phạt cóng/thối, giới hạn thời gian lượt…
- Trang hướng dẫn, chat nhanh, âm thanh, rung, hỗ trợ "Thêm vào màn hình chính".

## Online hoạt động thế nào?
Kết nối P2P (WebRTC) qua [PeerJS](https://peerjs.com/). Server công cộng miễn phí của PeerJS chỉ dùng để hai trình duyệt tìm thấy nhau. Máy **chủ phòng** chạy luật, chạy các máy (bot), và chỉ gửi cho mỗi người phần bài của họ.

- Người chơi mất kết nối: ván chờ họ (mặc định 60 giây), sau đó máy đánh thay cho đến khi họ vào lại.
- Chủ phòng tải lại trang: phòng được khôi phục từ localStorage và mọi người tự kết nối lại.
- Một số mạng di động hoặc NAT chặt có thể không kết nối P2P được.

## Phát triển
```bash
npm install
npm run dev      # http://localhost:5173/tienlen/
npm test         # unit test luật + mô phỏng 1000 ván bot
npm run build
```
Muốn thử online trên cùng một máy: mở một cửa sổ thường và một cửa sổ ẩn danh. Hai cửa sổ cần localStorage riêng.

## Cấu trúc
- `src/core`: engine luật (thuần TypeScript, có test)
- `src/ai`: bot
- `src/net`: điều khiển bàn chơi (local/host/guest) và giao thức P2P
- `src/store`: settings, hồ sơ, localStorage
- `src/ui`: màn hình và component React

## Deploy
Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) sẽ test, build rồi deploy lên GitHub Pages.
Lần đầu cần vào **Settings → Pages → Source: GitHub Actions**.
