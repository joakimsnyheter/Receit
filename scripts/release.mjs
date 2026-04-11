// npm run release -- 1.2.0
// Bumps version in package.json + manifest.json, commits, and pushes a version tag.
// GitHub Actions picks up the tag and creates the release automatically.

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: npm run release -- <major.minor.patch>  e.g. npm run release -- 1.2.0");
  process.exit(1);
}

// Update package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = version;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

// Update manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

console.log(`Bumped to v${version}`);

// Build
execSync("npm run build", { stdio: "inherit" });

// Git commit + tag + push
execSync(`git add package.json manifest.json main.js styles.css`);
execSync(`git commit -m "v${version}"`);
execSync(`git tag v${version}`);
execSync(`git push && git push --tags`);

console.log(`\nTag v${version} pushed — GitHub Actions will create the release.`);
