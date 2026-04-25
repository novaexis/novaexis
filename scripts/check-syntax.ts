import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const targetFile = "src/routes/parceiro.tsx";

function check() {
  console.log(`Checking ${targetFile}...`);
  try {
    // Run tsc on the specific file to check for syntax and type errors
    // We use --noEmit to just check, and --jsx preserve to handle React files
    execSync(`bunx tsc --noEmit --jsx react-jsx --allowJs --target esnext --moduleResolution bundler --skipLibCheck ${targetFile}`, { stdio: 'inherit' });
    console.log("✅ No syntax errors found.");
  } catch (error) {
    console.error("❌ Syntax or type errors detected!");
    process.exit(1);
  }
}

check();
