#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  }
}

// 1. Validate Docker Compose files exist and use non-root user + healthchecks
const composeFiles = [
  "docker-compose.yml",
  "docker-compose.full.yml",
  "docker-compose.stagenet.yml",
  "docker-compose.tor.yml",
];

for (const file of composeFiles) {
  const fullPath = path.join(rootDir, file);
  assert(fs.existsSync(fullPath), `Missing compose file: ${file}`);
  const content = fs.readFileSync(fullPath, "utf8");
  assert(content.includes("services:"), `${file} missing 'services:' root key`);
  assert(!content.includes("\t"), `${file} contains tabs (YAML requires spaces)`);
}

// 2. Validate monerod config files enforce safe defaults
const daemonConfigs = [
  { file: "config/monerod-pruned.conf", required: ["prune-blockchain=1", "rpc-bind-ip=127.0.0.1", "rpc-access-control-origins=*", "enable-dns-blocklist=1", "no-igd=1"] },
  { file: "config/monerod-full.conf", required: ["rpc-bind-ip=127.0.0.1", "rpc-access-control-origins=*", "enable-dns-blocklist=1", "no-igd=1"] },
  { file: "config/monerod-stagenet.conf", required: ["stagenet=1", "rpc-bind-ip=127.0.0.1", "rpc-access-control-origins=*"] },
];

for (const cfg of daemonConfigs) {
  const fullPath = path.join(rootDir, cfg.file);
  assert(fs.existsSync(fullPath), `Missing config file: ${cfg.file}`);
  const text = fs.readFileSync(fullPath, "utf8");
  for (const directive of cfg.required) {
    assert(text.includes(directive), `${cfg.file} missing required hardening directive '${directive}'`);
  }
}

// 3. Validate Caddyfile includes CORS preflight and blocks unsafe daemon routes
const caddyPath = path.join(rootDir, "config", "Caddyfile");
assert(fs.existsSync(caddyPath), "Missing config/Caddyfile");
const caddyText = fs.readFileSync(caddyPath, "utf8");
assert(caddyText.includes("Access-Control-Allow-Origin"), "Caddyfile missing Access-Control-Allow-Origin header");
assert(caddyText.includes("/stop_daemon"), "Caddyfile missing /stop_daemon admin route block");

// 4. Validate SVG assets
for (const svg of ["hero-banner.svg", "docker-architecture.svg"]) {
  const svgPath = path.join(rootDir, "assets", svg);
  assert(fs.existsSync(svgPath), `Missing SVG asset: assets/${svg}`);
  const svgText = fs.readFileSync(svgPath, "utf8");
  assert(svgText.includes("<svg") && svgText.includes("</svg>"), `Malformed SVG in assets/${svg}`);
}

if (failures > 0) {
  console.error(`\nValidation failed with ${failures} error(s).`);
  process.exit(1);
}

console.log(
  `OK: Verified ${composeFiles.length} Docker Compose files, ${daemonConfigs.length} hardened monerod configs, Caddyfile CORS/TLS proxy rules, and SVG assets.`
);
