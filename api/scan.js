// what anyone can read about a wallet, from public RPC only
const { B58, rpc, send } = require("./_lib");
const { analyse } = require("./_scan");
const CAP = 1000, SAMPLE = 10;
const opt = { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" };
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } }
  }));
  return out;
}
module.exports = async (req, res) => {
  const a = String((req.query || {}).a || "").trim();
  if (!B58.test(a)) return send(res, 400, { error: "not a solana address" });
  try {
    const [bal, sigs] = await Promise.all([rpc("getBalance", [a, { commitment: "confirmed" }]), rpc("getSignaturesForAddress", [a, { limit: CAP }])]);
    const list = Array.isArray(sigs) ? sigs : [];
    const recent = list.slice(0, SAMPLE).map(s => s.signature);
    const txs = await pool(recent, 4, s => rpc("getTransaction", [s, opt]));
    let oldest = null;
    if (list.length && list.length < CAP) { try { oldest = await rpc("getTransaction", [list[list.length - 1].signature, opt]); } catch (e) {} }
    const out = analyse(a, bal && typeof bal.value === "number" ? bal.value : null, list, txs, oldest, CAP);
    out.t = Date.now();
    send(res, 200, out, 30);
  } catch (e) { send(res, 502, { error: "solana rpc unavailable right now" }); }
};
