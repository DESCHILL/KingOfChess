# KingOfChess

Website cờ vua trực tuyến với tài khoản, phòng bằng mã, ghép trận nhanh, đồng hồ và lịch sử ván lưu trong SQL Server.

## Chạy trên máy

Yêu cầu Windows, Node.js 24, npm, SQL Server Express instance SQLEXPRESS và Microsoft ODBC Driver 18 for SQL Server. Dịch vụ SQL Server phải đang chạy. Backend dùng tài khoản Windows hiện tại để kết nối; tài khoản này cần quyền tạo database trong lần chạy đầu và quyền đọc/ghi database sau đó.

```powershell
npm run setup
npm start
```

Mở http://localhost:8080. Bản build phục vụ web, API và WebSocket chung cổng 8080, không cần chạy Vite. Database `KingOfChess` và các bảng được tạo tự động khi khởi động lần đầu. Máy khác trong LAN mở URL IPv4 được in trong log sau khi cấu hình firewall.

`setup` cài dependency theo lockfile, build và kiểm tra SQL Server; tự tạo `.env` ở gốc repo nếu chưa có. Mặc định dùng Windows Authentication với SQLEXPRESS cục bộ. Chỉ cần thay cấu hình môi trường nếu máy mới dùng instance/tên miền/cổng khác, không sửa code. Bản mẫu dùng HTTP để demo LAN; HTTPS và firewall được cấu hình riêng trên máy triển khai.

Hướng dẫn đầy đủ: [Triển khai trên máy mới](docs/DEPLOYMENT.md) và [Biên bản kiểm thử hai máy](docs/ACCEPTANCE.md).

Khi phát triển giao diện có thể dùng `npm run dev`, mở http://localhost:5173 với backend cổng 8080. Chỉ chạy một backend tại một thời điểm; dừng `npm start` trước khi chạy chế độ dev.

## Chức năng

- Đăng ký, đăng nhập, đăng xuất và chơi bằng tài khoản khách. Mật khẩu được băm bằng scrypt; phiên đăng nhập dùng cookie HttpOnly, thời hạn 7 ngày.
- Tạo phòng với mã 6 ký tự. Người tạo cầm trắng, người tham gia đầu tiên cầm đen, những người tiếp theo chỉ xem. Mã sai hiển thị “Phòng không tồn tại”.
- Ghép trận nhanh giữa những người chọn cùng thời lượng.
- Đồng hồ 3, 5, 10 hoặc 15 phút mỗi bên, không cộng giờ sau nước đi. Máy chủ quyết định thời gian còn lại và kết quả hết giờ.
- Kiểm tra nước đi hợp lệ tại máy chủ, đồng bộ bàn cờ và kết quả cho cả người chơi lẫn người xem.
- Đấu trận mới khi hai người đồng ý: đổi màu quân, đặt lại đồng hồ và tạo bản ghi ván mới; ván trước vẫn được lưu. Người xem không tự động nhận ghế chơi.
- Lưu trạng thái phòng, nước đi PGN, người chơi, đồng hồ và kết quả vào SQL Server. Chỉ xác nhận nước đi sau khi lưu thành công.
- Lịch sử tối đa 100 ván gần nhất của tài khoản và xem lại từng nước. Người xem không được truy cập lịch sử riêng của người chơi.
- Tự kết nối lại và khôi phục ghế, bàn cờ, đồng hồ khi tải lại trang hoặc mất kết nối. Thời gian chờ quay lại là 120 giây; đồng hồ vẫn chạy trong lúc mất kết nối. Trạng thái được phục hồi từ database khi backend khởi động lại, thời gian đã trôi qua vẫn được tính.

Nút “Đầu hàng và thoát phòng” kết thúc ván ngay. Đóng tab hoặc mất mạng áp dụng thời gian chờ kết nối lại. Quay lại bằng đúng tài khoản trong thời gian chờ để tiếp tục. Tài khoản khách phụ thuộc cookie trình duyệt; nên đăng ký tài khoản để đăng nhập lại từ trình duyệt khác.

## Trình bày hai người chơi trên một máy

1. Mở Chrome và Edge, hoặc một cửa sổ thường và một cửa sổ ẩn danh.
2. Đăng nhập hai tài khoản khác nhau hoặc chọn chơi khách riêng ở mỗi trình duyệt.
3. Người thứ nhất vào Phòng chơi, chọn thời lượng và tạo phòng.
4. Người thứ hai nhập mã để tham gia. Hai bên luân phiên đi, đồng hồ và bàn cờ cập nhật đồng thời.
5. Tải lại một cửa sổ để minh họa khôi phục ván. Kết thúc ván rồi mở Lịch sử để xem lại các nước.

Hai cửa sổ thường cùng hồ sơ trình duyệt dùng chung cookie nên là cùng một người, không thể đóng vai hai đối thủ. Có thể dùng hồ sơ thứ ba để minh họa người xem.

## Cơ sở dữ liệu

Schema nằm trong `backend/sql/schema.sql`:

| Bảng | Nội dung |
| --- | --- |
| Users | Tài khoản và mật khẩu đã băm |
| Sessions | Mã băm phiên đăng nhập và thời hạn |
| Rooms | Trạng thái phòng để phục hồi |
| Games | Lịch sử, PGN, kết quả và trạng thái từng ván |

Trong SSMS, kết nối `.\SQLEXPRESS` bằng Windows Authentication và mở Databases → KingOfChess → Tables để xem các bảng. Backend cần database hoạt động để khởi động và xác nhận thao tác chơi.

## Kiểm thử

```powershell
npm run build
npm run lint --prefix frontend
node --test backend/tests/rooms.test.mjs
```

Kiểm thử logic bao gồm ghế chơi, người xem, phân quyền, nước đi trùng, đấu lại, mất kết nối, hết giờ, phục hồi sau khởi động lại và lỗi ghi dữ liệu.

Khi backend đang chạy, kiểm thử tích hợp với SQL Server thật:

```powershell
node --test backend/tests/integration.test.mjs
```

Bài kiểm thử tạo tài khoản tạm, kiểm tra đăng nhập, quyền xem lịch sử, lưu nước đi, nối lại và kết quả ván; sau đó dọn dữ liệu do chính bài kiểm thử tạo.

## Chơi với máy

Trang `/computer` hiện là giao diện xem trước chọn màu quân và độ khó. Chưa tích hợp đối thủ máy; chưa thể bắt đầu ván ở chế độ này.

## Nguồn gốc

Dựa trên [DevChess của Devdhar Manpuria](https://github.com/DevdharManpuria/devchess). Xem LICENSE và ATTRIBUTION.md.

Repository: [DESCHILL/KingOfChess](https://github.com/DESCHILL/KingOfChess).
