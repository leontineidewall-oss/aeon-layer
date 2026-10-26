// pure analysis of public wallet data (shared by api/scan.js and the tests)
const KNOWN = {
  "11111111111111111111111111111111": "System",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token-2022",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "Token accounts",
  "ComputeBudget111111111111111111111111111111": null,
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "pump.fun",
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA": "PumpSwap",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium CLMM",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr": "Memo",
  "Stake11111111111111111111111111111111111111": "Staking",
};
function keysOf(tx) {
  const ks = (((tx || {}).transaction || {}).message || {}).accountKeys || [];
  return ks.map(k => (typeof k === "string" ? k : k && k.pubkey)).filter(Boolean);
}
function instrs(tx) {
  const m = ((tx || {}).transaction || {}).message || {}, out = (m.instructions || []).slice();
  (((tx || {}).meta || {}).innerInstructions || []).forEach(g => (g.instructions || []).forEach(i => out.push(i)));
  return out;
}
// sigs: [{signature, blockTime, err}] newest first. txs: parsed txs (newest sample). oldest: parsed tx of oldest sig or null
function analyse(addr, balanceLamports, sigs, txs, oldest, cap) {
  sigs = Array.isArray(sigs) ? sigs : [];
  const times = sigs.map(s => s && s.blockTime).filter(t => typeof t === "number");
  const links = {}, progs = {};
  let sampled = 0;
  (txs || []).forEach(tx => {
    if (!tx) return; sampled++;
    const seen = {};
    instrs(tx).forEach(ins => {
      const pid = ins.programId; if (pid && !seen[pid]) { seen[pid] = 1; if (KNOWN[pid] !== null) progs[pid] = (progs[pid] || 0) + 1; }
      const p = ins.parsed, info = p && p.info;
      if (p && info && ins.program === "system" && (p.type === "transfer" || p.type === "transferWithSeed")) {
        const other = info.source === addr ? info.destination : info.destination === addr ? info.source : null;
        if (other && other !== addr) { const l = links[other] || (links[other] = { addr: other, out: 0, in: 0 }); info.source === addr ? l.out++ : l.in++; }
      }
    });
  });
  let funder = null;
  if (oldest) instrs(oldest).forEach(ins => {
    const p = ins.parsed, info = p && p.info;
    if (!funder && p && info && ins.program === "system" && p.type === "transfer" && info.destination === addr && info.source !== addr) funder = info.source;
  });
  const linkList = Object.values(links).sort((a, b) => (b.in + b.out) - (a.in + a.out)).slice(0, 24);
  const progList = Object.keys(progs).map(id => ({ id, name: KNOWN[id] || null, n: progs[id] })).sort((a, b) => b.n - a.n).slice(0, 8);
  return {
    addr, balance: typeof balanceLamports === "number" ? balanceLamports / 1e9 : null,
    txs: sigs.length, capped: sigs.length >= cap, failed: sigs.filter(s => s && s.err).length,
    first: times.length ? Math.min(...times) : null, last: times.length ? Math.max(...times) : null,
    sampled, links: linkList, linkCount: Object.keys(links).length, funder, programs: progList,
  };
}
module.exports = { analyse, KNOWN };
