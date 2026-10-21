import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
let failed = false;
function check(ok, message) { console.log(`${ok ? "PASS" : "FAIL"} ${message}`); if (!ok) failed = true; }
check(process.platform === "win32" && process.arch === "x64", "Windows x64");
check(Number(process.versions.node.split(".")[0]) === 24, `Node.js 24 LTS (hiện tại ${process.version})`);
for (const path of [".env", "frontend/dist/index.html", "backend/dist/index.js"]) check(existsSync(join(root, path)), path);
try {
    const { config } = await import("../backend/dist/config.js");
    console.log(`Listen ${config.host}:${config.port}; Secure cookie: ${config.secureCookies}`);
    for (const origin of config.origins) console.log(`Origin: ${origin}`);
    const { query } = await import("../backend/dist/database.js");
    const rows = await query("SELECT HAS_PERMS_BY_NAME(NULL,NULL,'CREATE ANY DATABASE') AS canCreate, DB_ID(?) AS databaseId", [process.env.DB_NAME || "KingOfChess"], "master");
    check(true, "Kết nối SQL Server bằng cấu hình hiện tại");
    check(Boolean(rows[0]?.canCreate || rows[0]?.databaseId), "Database tồn tại hoặc tài khoản có quyền tạo database");
    if (rows[0]?.databaseId) console.log("Quyền tạo bảng/đọc/ghi sẽ được kiểm tra khi npm start khởi tạo schema.");
} catch (error) {
    check(false, error instanceof Error ? error.message : String(error));
    console.error("Kiểm tra dịch vụ SQLEXPRESS, ODBC Driver 18 x64 và quyền tài khoản Windows. Xem docs/DEPLOYMENT.md.");
}
process.exitCode = failed ? 1 : 0;
