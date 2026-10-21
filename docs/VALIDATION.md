# Kiểm tra trước khi chuyển máy

Kiểm tra ngày 21/10/2026 trên Windows x64, Node.js 24.20.0 và SQL Server Express cục bộ.

- Sao chép các file sẽ đưa vào repo sang thư mục tạm sạch, không mang theo `.env`, `node_modules` hoặc `dist`.
- `npm run setup`: cài dependency từ lockfile, tạo cấu hình, build và doctor thành công.
- Chạy `npm start` tại thư mục sạch với cổng thử và database thử riêng bằng biến môi trường, không sửa source.
- 8 bài kiểm thử logic/triển khai đạt, gồm origin LAN, trang frontend, bảo vệ đường dẫn file, phòng, đồng hồ, lưu ván và phục hồi.
- Bài kiểm thử tích hợp HTTP/WebSocket/SQL đạt qua IP LAN của chính máy chạy: tài khoản, lưu nước đi, kết nối lại và quyền xem lịch sử.
- Trình duyệt truy cập bản build qua IP LAN: chơi khách và tạo phòng thành công, không có lỗi console ở luồng kiểm tra.
- Lint frontend đạt. Công cụ evidence gọi health/database 10 lần liên tiếp thành công.

Đây chưa phải kiểm thử trên hai máy vật lý hoặc đo tải nhiều người chơi. Chưa xác minh firewall/chứng chỉ/khởi động tự động/backup ở máy đích. Dùng ACCEPTANCE.md để ghi nhận các bước đó sau khi triển khai.

## Dependency

Lần cài sạch ghi nhận npm audit không có cảnh báo ở backend/root và frontend khi dùng `--omit=dev`. Audit toàn bộ frontend có 7 cảnh báo trong chuỗi công cụ build Tailwind CSS 3 (5 high, 2 moderate). Chúng chưa được xử lý trong lần thay đổi này; npm đề xuất chuyển sang Tailwind CSS 4, cần một đợt nâng cấp và kiểm tra giao diện riêng. Không dùng `npm audit fix --force` tự động. Kết quả audit có thể thay đổi theo thời điểm.

Máy triển khai phục vụ file build bằng backend, không mở Vite/Tailwind ra mạng. Điều này không thay thế việc theo dõi và xử lý cảnh báo dependency trước khi triển khai công khai.
