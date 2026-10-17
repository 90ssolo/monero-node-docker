#!/usr/bin/env node
/**
 * Checks a running Monero node's RPC health, sync status, restricted mode, and CORS headers.
 * Usage: node scripts/check-node.mjs [http://127.0.0.1:18089 | https://node.example.com]
 */

const endpoint = (process.argv[2] || "http://127.0.0.1:18089").replace(/\/+$/, "");

async function checkNode() {
  console.log(`Checking Monero RPC node at ${endpoint} ...\n`);
  const start = Date.now();

  let res;
  try {
    res = await fetch(`${endpoint}/json_rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://monkstash.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "0", method: "get_info" }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error(`Connection failed: ${err.message}`);
    process.exit(1);
  }

  const latencyMs = Date.now() - start;
  const corsHeader = res.headers.get("access-control-allow-origin");
  const payload = await res.json();
  const info = payload?.result;

  if (!info || info.status !== "OK") {
    console.error("Unexpected RPC response:", JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const height = Number(info.height || 0);
  const target = Math.max(Number(info.target_height || 0), height);
  const pct = target > 0 ? ((height / target) * 100).toFixed(2) : "100.00";
  const network = info.stagenet ? "stagenet" : info.testnet ? "testnet" : "mainnet";

  console.log(`Network          : ${network}`);
  console.log(`Version          : ${info.version || "unknown"}`);
  console.log(`Sync Progress    : ${height} / ${target} (${pct}%)`);
  console.log(`Restricted RPC   : ${info.restricted ? "Yes (Safe)" : "NO (Unrestricted!)"}`);
  console.log(`Incoming / Out   : ${info.incoming_connections_count ?? 0} in / ${info.outgoing_connections_count ?? 0} out`);
  console.log(`CORS Header      : ${corsHeader ? corsHeader : "Missing (browser wallets will be blocked)"}`);
  console.log(`Response Latency : ${latencyMs} ms`);

  if (!info.restricted) {
    console.warn("\nWARNING: Node is running without --restricted-rpc. Do not expose this port to the internet.");
    process.exit(2);
  }
}

checkNode();
