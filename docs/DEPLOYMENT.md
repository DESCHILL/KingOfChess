# Chuyển KingOfChess sang máy khác

## Phạm vi hỗ trợ

Bộ chạy hiện tại dành cho máy chủ Windows 10/11 x64, Node.js 24 LTS x64, SQL Server Express cục bộ instance `SQLEXPRESS` và Microsoft ODBC Driver 18 for SQL Server x64. Máy người chơi chỉ cần trình duyệt. Không cần SSMS để chạy web; SSMS hữu ích khi xem hoặc sao lưu database.

Repo chứa mã nguồn và schema, không chứa phần mềm SQL Server, dữ liệu trên máy cũ, mật khẩu, file `.env` hoặc chứng chỉ. Máy mới tạo database mới. Muốn mang lịch sử/tài khoản cũ sang phải backup/restore riêng. Chưa xác nhận khả năng chạy Linux/macOS với bộ cài này.

## Lần đầu trên máy chủ mới

1. Cài Git, Node.js 24 LTS x64, SQL Server Express với instance tên `SQLEXPRESS` và ODBC Driver 18 x64. Trong trình cài SQL Server, cấp quyền quản trị SQL cho tài khoản Windows sẽ chạy ứng dụng. Kiểm tra dịch vụ SQL Server (SQLEXPRESS) đang chạy. Không cần mở cổng SQL ra mạng.
2. Mở PowerShell bằng tài khoản Windows đó:

```powershell
git clone https://github.com/DESCHILL/KingOfChess.git
cd KingOfChess
npm run setup
npm start
```

`setup` tạo `.env` từ mẫu nếu chưa tồn tại, cài đúng phiên bản dependency theo lockfile bằng `npm ci`, build frontend/backend và kiểm tra kết nối database. Nó không cài SQL Server hoặc tự thay đổi firewall. Có thể chạy lại sau khi sửa môi trường; `.env` hiện có được giữ nguyên. Lần đầu cần Internet để tải dependency, các lần `npm start` sau không cần Internet.

`npm start` khởi tạo schema, phục vụ web, API và WebSocket chung cổng **8080**. Không cần chạy Vite trên máy triển khai. Giữ cửa sổ lệnh mở trong lúc thử. Nhấn Ctrl+C để dừng.

3. Mở `http://localhost:8080` trên máy chủ. Log in địa chỉ LAN, ví dụ `http://192.168.1.20:8080`; chọn địa chỉ card Ethernet/Wi-Fi cùng mạng với máy người chơi, không chọn card VPN/máy ảo. `ipconfig` giúp xác định IPv4.
4. Khi sẵn sàng thử LAN, trên mạng tin cậy có profile Private, mở PowerShell Administrator và chạy:

```powershell
New-NetFirewallRule -DisplayName "KingOfChess LAN 8080" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Private -RemoteAddress LocalSubnet
```

5. Trên máy người chơi, mở đúng URL LAN đó. Dùng hai tài khoản riêng để tạo và vào phòng. Hai máy phải cùng mạng, không có Wi-Fi client isolation/guest isolation. Nếu đổi IP máy chủ, dùng URL mới và khởi động lại ứng dụng để cập nhật danh sách origin.

Gỡ riêng quy tắc thử nghiệm khi không dùng nữa:

```powershell
Remove-NetFirewallRule -DisplayName "KingOfChess LAN 8080"
```

Không cần mở cổng 5173 hoặc cổng SQL Server. Không bật port forwarding trên router cho bài thử LAN.

## Cấu hình theo máy, không sửa code

Chỉ chỉnh file `.env` ở thư mục gốc repo và khởi động lại. File này được bỏ qua khi push, các lần cập nhật repo không ghi đè nó. Biến môi trường đã đặt trong hệ điều hành được ưu tiên hơn file này.

| Biến | Mặc định từ mẫu | Ý nghĩa |
| --- | --- | --- |
| HOST | 0.0.0.0 | Nhận kết nối IPv4 LAN; đổi thành 127.0.0.1 khi đặt sau reverse proxy cùng máy |
| PORT | 8080 | Cổng web/API/WebSocket; cập nhật firewall nếu thay đổi |
| LAN_MODE | true | Tự cho phép các origin HTTP theo địa chỉ IPv4 hiện tại của máy chủ |
| COOKIE_SECURE | false | Dùng cho HTTP thử nghiệm LAN; phải đổi true khi chuyển sang HTTPS |
| NODE_ENV | production | Chế độ chạy bản build |
| DB_NAME | KingOfChess | Tên database |
| ALLOWED_ORIGINS | rỗng | Thêm origin phân cách bằng dấu phẩy, ví dụ https://chess.example.edu; không có dấu / cuối |
| DB_CONNECTION_STRING | không đặt | Tự dùng Windows Authentication với SQLEXPRESS cục bộ |

Nếu instance SQL có tên khác, thêm cấu hình kết nối trong `.env`, thay `TEN_INSTANCE` bằng tên thật:

```dotenv
DB_CONNECTION_STRING="Driver={ODBC Driver 18 for SQL Server};Server=lpc:.\TEN_INSTANCE;Database={database};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;"
```

Giữ nguyên `{database}` để chương trình kết nối `master` lúc tạo database rồi chuyển sang database ứng dụng. Mẫu này chỉ dùng shared memory với SQL Server cục bộ. SQL từ xa cần cấu hình TCP, chứng chỉ và tài khoản phù hợp riêng. Không đưa mật khẩu vào README hoặc commit `.env`.

`frontend/.env.example` dành cho phát triển; để trống `VITE_WS_URL`. Bản triển khai lấy host, cổng và ws/wss từ URL trình duyệt, không có IP máy cũ trong bundle. Không tạo `frontend/.env` trỏ WebSocket sang máy khác.

## Kiểm tra khi gặp lỗi

```powershell
npm run doctor
Get-Service 'MSSQL$SQLEXPRESS'
Get-OdbcDriver -Name 'ODBC Driver 18 for SQL Server' -Platform '64-bit'
Test-NetConnection localhost -Port 8080
```

- `npm` không nhận diện: cài Node.js rồi mở lại PowerShell.
- Lỗi driver hoặc đăng nhập SQL: kiểm tra ODBC, instance và quyền tài khoản Windows đang chạy. Tài khoản chỉ có quyền vào Windows chưa chắc có quyền trong SQL Server.
- Không tạo được schema: tài khoản triển khai cần quyền tạo database và bảng. Có thể nhờ quản trị viên tạo sẵn database và schema trước khi cấp tài khoản vận hành ít quyền hơn; hiện startup vẫn thực hiện schema idempotent.
- `EADDRINUSE`: đã có tiến trình dùng cổng. Dừng bản KingOfChess cũ hoặc đổi PORT trong `.env`; không chạy hai backend cùng database phòng chơi.
- Máy chủ vào được, máy khác không vào được: kiểm tra đúng IPv4, firewall profile, cùng subnet và cấu hình Wi-Fi; thử `Test-NetConnection IP_MAY_CHU -Port 8080` từ máy còn lại.
- Đăng nhập thành công nhưng quay về trang đăng nhập: kiểm tra COOKIE_SECURE; HTTP LAN cần false, HTTPS cần true.
- Thông báo nguồn truy cập không được phép: dùng IP được log in hoặc thêm origin tên miền vào ALLOWED_ORIGINS và restart.

## Bảo mật và vận hành ở giai đoạn tiếp theo

Bản mặc định là **HTTP thử nghiệm LAN**, không mã hóa đường truyền. Chỉ dùng tài khoản thử nghiệm trên LAN tin cậy. Khi thực hiện giai đoạn HTTPS trên máy mới, đặt reverse proxy có hỗ trợ WebSocket phía trước backend và chỉnh `.env`:

```dotenv
HOST=127.0.0.1
PORT=8080
LAN_MODE=false
NODE_ENV=production
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://TEN_MIEN_THUC_TE
```

Proxy chuyển HTTP và `/ws` tới `127.0.0.1:8080`, giữ cookie và Origin, hỗ trợ Upgrade WebSocket. Chứng chỉ phải được máy người chơi tin cậy. Chỉ mở cổng HTTPS của proxy ra mạng; bỏ quy tắc LAN 8080. Frontend tự đổi sang WSS, không cần sửa code hoặc build lại để đổi tên miền. Cấu hình tên miền/chứng chỉ/firewall là công việc theo môi trường, không được repo tự quyết định.

Để tự chạy sau khi khởi động Windows, có thể cấu hình Task Scheduler trên máy triển khai: chương trình là đường dẫn đầy đủ tới `node.exe`, arguments là `backend/dist/index.js`, Start in là thư mục repo; dùng tài khoản Windows có quyền SQL, bật khởi động lại khi task lỗi và không chạy đồng thời nhiều instance. Xác minh thực tế sau một lần restart máy. Không chạy bằng SYSTEM khi chưa cấu hình quyền SQL tương ứng.

Database cần backup theo lịch vào thư mục có quyền ghi của dịch vụ SQL Server, sao chép bản backup sang nơi khác và kiểm tra restore vào database riêng. Không coi việc commit repo là backup database. Phần thiết lập task, HTTPS, giám sát và backup sẽ làm trên máy triển khai; chưa được cấu hình tự động trên máy hiện tại.

## Cập nhật phiên bản

Dừng ứng dụng, backup database rồi chạy:

```powershell
git pull --ff-only origin main
npm run setup
npm start
```

Không dùng `git reset --hard` để cập nhật. Nếu có thay đổi cục bộ hoặc nhánh bị phân kỳ, xử lý trước khi pull. Schema hiện tại tạo bảng khi thiếu, không xóa database. Các thay đổi schema tương lai cần kế hoạch migration riêng.

## Kiểm thử và thu bằng chứng

```powershell
npm test
npm run lint
```

Trong cửa sổ khác khi ứng dụng đang chạy:

```powershell
npm run test:integration
npm run evidence -- http://localhost:8080
```

Integration chạy trên máy chủ, dùng cùng `.env` và database với server, tạo rồi dọn tài khoản thử nghiệm. Không chạy với dữ liệu production. `evidence` ghi JSON vào thư mục `evidence/` gồm thời gian, commit, URL và 10 lần đo HTTP/database liên tiếp; đây là kiểm tra sức khỏe, không phải kết quả kiểm thử tải nhiều người chơi.

Trên hai máy thật, ghi kết quả và chụp ảnh theo `docs/ACCEPTANCE.md`. IP, log, backup và bằng chứng tại máy triển khai không được tự đưa lên GitHub. Hiệu năng, firewall, chứng chỉ và kết nối hai máy chỉ được kết luận sau khi kiểm thử tại mạng đích.
