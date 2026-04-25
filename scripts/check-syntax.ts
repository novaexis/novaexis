import { execSync } from "child_process";
import { rmSync, existsSync } from "fs";

const targetFile = "src/routes/parceiro.tsx";
const cacheDir = "node_modules/.vite";

function check() {
  console.log(`Checking syntax for ${targetFile}...`);
  try {
    // If it's a major build or we are fixing a stale state, clear vite cache
    if (existsSync(cacheDir)) {
      console.log("🧹 Cleaning Vite cache...");
      rmSync(cacheDir, { recursive: true, force: true });
    }

    execSync(`bun build ${targetFile} --outdir /tmp/check-build`, { stdio: 'pipe' });
    console.log("✅ Syntax check passed.");
  } catch (error: any) {
    console.error("❌ Syntax error detected!");
    console.error(error.stdout?.toString() || error.stderr?.toString() || error.message);
    process.exit(1);
  }
}

check();
