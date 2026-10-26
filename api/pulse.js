// live proof: how many public transactions per second, and a few real traders to scan
const { B58, rpc, send } = require("./_lib");
const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
module.exports = async (req, res) => {
  const out = { tps: null, traders: [], t: Date.now() };
  try {
    const s = await rpc("getRecentPerformanceSamples", [4]);
    const ok = (Array.isArray(s) ? s : []).filter(x => x && x.samplePeriodSecs > 0 && typeof x.numTransactions === "number");
    if (ok.length) out.tps = ok.reduce((a, x) => a + x.numTransactions / x.samplePeriodSecs, 0) / ok.length;
  } catch (e) {}
  try {
    const sigs = await rpc("getSignaturesForAddress", [PUMP, { limit: 8 }]);
    const pick = (Array.isArray(sigs) ? sigs : []).filter(x => x && !x.err).slice(0, 4);
    const opt = { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" };
    const txs = await Promise.all(pick.map(x => rpc("getTransaction", [x.signature, opt]).catch(() => null)));
    const seen = {};
    txs.forEach(tx => {
      const ks = (((tx || {}).transaction || {}).message || {}).accountKeys || [];
      const k = ks.find(a => a && a.signer), pk = k && k.pubkey;
      if (pk && B58.test(pk) && !seen[pk]) { seen[pk] = 1; out.traders.push(pk); }
    });
  } catch (e) {}
  send(res, 200, out, 15);
};
