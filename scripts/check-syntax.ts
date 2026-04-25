import { execSync } from "child_process";

const targetFile = "src/routes/parceiro.tsx";

function check() {
  console.log(`Checking syntax for ${targetFile}...`);
  try {
    // We use a simple regex check or basic parsing check if tsc is too noisy with module resolution
    // For now, let's try to just check if it's valid JS/TS using bun's internal transpiler check
    execSync(`bun build ${targetFile} --outdir /tmp/check-build`, { stdio: 'pipe' });
    console.log("✅ Syntax check passed.");
  } catch (error: any) {
    console.error("❌ Syntax error detected!");
    console.error(error.stdout?.toString() || error.stderr?.toString() || error.message);
    process.exit(1);
  }
}

check();
