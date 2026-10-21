import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
if (process.platform !== "win32" || Number(process.versions.node.split(".")[0]) !== 24) {
    console.error("Bộ cài này hỗ trợ Windows x64 và Node.js 24 LTS. Xem docs/DEPLOYMENT.md.");
    process.exit(1);
}
if (process.arch !== "x64") throw new Error("Cần Node.js Windows x64");
if (!existsSync(join(root, ".env"))) copyFileSync(join(root, ".env.example"), join(root, ".env"));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Hãy chạy npm run setup từ thư mục repo");
for (const folder of ["", "backend", "frontend"]) {
    const result = spawnSync(process.execPath, [npm, "ci", "--include=dev"], { cwd: join(root, folder), stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
}
for (const args of [["run", "build"], ["run", "doctor"]]) {
    const result = spawnSync(process.execPath, [npm, ...args], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Sẵn sàng. Chạy npm start. Máy khác chỉ cần trình duyệt truy cập URL LAN được in ra.");
