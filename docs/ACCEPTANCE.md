# Biên bản kiểm tra trên mạng đích

Điền ngày thử, commit (`git rev-parse HEAD`), cấu hình CPU/RAM, phiên bản Windows/Node/SQL, địa chỉ máy chủ và máy người chơi. Các mục dưới đây chưa phải kết quả đã đo trên máy triển khai.

| Thử nghiệm | Kết quả cần đạt | Bằng chứng cần giữ |
| --- | --- | --- |
| Clone sạch và setup | Không sửa source, doctor đạt, npm start phục vụ web | Log setup/doctor, commit |
| Hai máy truy cập | Cả hai mở được URL LAN | Ảnh URL và kết quả kiểm tra cổng |
| Hai tài khoản | Đăng ký/đăng nhập riêng, tạo và nhập cùng mã | Ảnh hai bàn cờ, tên tài khoản |
| Người xem thứ ba | Chỉ xem được, không đi quân | Ảnh vai trò và bàn cờ |
| Nước đi và đồng hồ | Nước đi đồng bộ, chỉ người đúng lượt được đi | Video ngắn hai phía |
| Mã phòng sai | Hiện Phòng không tồn tại | Ảnh thông báo |
| Tải lại trang | Quay lại đúng ghế, đúng ván | Ảnh trước và sau |
| Mất mạng dưới 120 giây | Nối lại đúng ván nếu chưa hết giờ; đồng hồ không đặt lại | Video và thời gian ngắt/nối |
| Mất mạng quá 120 giây | Ván kết thúc theo luật mất kết nối nếu chưa kết thúc vì hết giờ | Kết quả và lịch sử |
| Restart backend | Phục hồi từ SQL, tính thời gian đã trôi qua | Log restart, bàn cờ, lịch sử |
| Đấu lại | Hai bên đồng ý, đổi màu, đồng hồ mới; ván cũ còn trong lịch sử | Ảnh và danh sách ván |
| HTTPS/WSS sau cấu hình | Chứng chỉ hợp lệ, WebSocket dùng wss, cookie Secure | Ảnh DevTools không lộ giá trị cookie |
| Tự khởi động | Khởi động lại máy, dịch vụ hoạt động theo task đã cấu hình | Log Task Scheduler, health |
| Backup/restore | Restore bản sao vào database thử nghiệm, kiểm tra dữ liệu | Log backup/restore, số ván |
| Kiểm thử tải riêng | Ghi số kết nối, nước đi/giây, độ trễ p50/p95, lỗi, CPU/RAM và điều kiện đo | Báo cáo từ công cụ tải được cấu hình ở máy mới |

Không điền Đạt khi chưa thử; ghi lỗi và cách khắc phục nếu có. Kiểm thử tải WebSocket cần người dùng/phiên và các nước đi hợp lệ; 10 lần gọi health không thay thế bài tải này.
