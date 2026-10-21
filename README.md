# KingOfChess

Website cờ vua trực tuyến dành cho hai người chơi.

## Chạy trên máy

Yêu cầu Node.js 20 trở lên và npm.

```powershell
npm run setup
npm run dev
```

Mở http://localhost:5173 ở hai cửa sổ trình duyệt. Chọn Play now, sau đó Find a match ở cả hai cửa sổ. Người vào hàng đợi trước cầm quân trắng.

Backend WebSocket chạy tại ws://localhost:8080.

## Kiểm tra

```powershell
npm run build
npm run lint --prefix frontend
```

## Phạm vi bản đầu tiên

Ghép trận, kiểm tra nước đi tại máy chủ, đồng bộ nước đi và thông báo kết thúc ván. Trạng thái ván nằm trong bộ nhớ. Mất kết nối sẽ kết thúc ván; chưa có tài khoản, lưu lịch sử hoặc đồng hồ thi đấu.

## Phòng chơi

Mở http://localhost:5173/rooms và chọn Tạo phòng. Người tạo cầm quân trắng. Chia sẻ mã sáu ký tự: người vào đầu tiên cầm đen, các người vào sau chỉ xem. Người xem vào giữa ván nhận đầy đủ bàn cờ và các nước đi hiện tại. Có nút sao chép mã và thoát phòng.

Người chơi rời hoặc mất kết nối sẽ kết thúc ván; người xem không thay thế vị trí đó. Phòng bị xóa khi không còn ai. Phòng và ván chưa được lưu qua lần khởi động lại máy chủ.

## Đấu trận mới

Trong phòng có mã và ghép trận nhanh, người chơi có thể yêu cầu Đấu trận mới khi đang chơi hoặc sau khi kết thúc. Đối thủ chọn đồng ý hoặc từ chối; người gửi có thể hủy. Khi cả hai đồng ý, bàn cờ và lịch sử nước đi được đặt lại, hai người đổi màu quân. Phòng có mã giữ nguyên mã và người xem. Nếu đối thủ đã rời, người còn lại có thể mở ván chờ người mới; người xem hiện có không tự động trở thành người chơi. Với ghép trận nhanh, nút này đưa người còn lại vào hàng đợi.

## Giao diện chơi với máy

Mở http://localhost:5173/computer để xem giao diện chọn màu quân và độ khó. Chưa tích hợp đối thủ máy; nút bắt đầu và bàn cờ được khóa, giao diện hiển thị Sắp ra mắt.

## Kiểm thử phòng

```powershell
npm run build --prefix backend
node --test backend/tests/rooms.test.mjs
```

Kiểm thử ghế chơi, người xem, phân quyền nước đi, đồng bộ người vào muộn, chiếu hết, rời phòng, dọn phòng và ghép trận nhanh.

## Nguồn gốc

Dựa trên DevChess của Devdhar Manpuria: https://github.com/DevdharManpuria/devchess

Xem LICENSE và ATTRIBUTION.md. Đây là bản tùy chỉnh chạy cục bộ; chưa tạo repository GitHub cho KingOfChess.
