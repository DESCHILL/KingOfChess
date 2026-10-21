import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = new URL(process.argv[2] || "http://localhost:8080").origin;
const samples = [];
for (let i = 0; i < 10; i++) {
    const started = performance.now();
    try {
        const response = await fetch(`${target}/api/health`, { signal: AbortSignal.timeout(5000) });
        samples.push({ status: response.status, ms: Math.round((performance.now() - started) * 100) / 100, data: await response.json() });
    } catch (error) { samples.push({ error: String(error), ms: Math.round(performance.now() - started) }); }
}
let commit = "unknown";
try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
const report = { at: new Date().toISOString(), commit, target, node: process.version, platform: process.platform, description: "10 sequential HTTP/SQL health probes; not a multiplayer load test", samples };
const dir = join(root, "evidence");
await mkdir(dir, { recursive: true });
const file = join(dir, `health-${Date.now()}.json`);
await writeFile(file, JSON.stringify(report, null, 2));
console.log(`Bằng chứng kiểm tra HTTP/database: ${file}`);
if (samples.some(sample => sample.status !== 200 || sample.data?.database !== "connected")) process.exitCode = 1;
