// live proof: how many public transactions per second, and a few real traders to scan
const { B58, rpc, send } = require("./_lib");
const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const opt = { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" };
let last = { traders: [], at: 0 };
module.exports = async (req, res) => {
  const out = { tps: null, traders: [], t: Date.now() };
  try {
    const s = await rpc("getRecentPerformanceSamples", [4]);
    const ok = (Array.isArray(s) ? s : []).filter(x => x && x.samplePeriodSecs > 0 && typeof x.numTransactions === "number");
    if (ok.length) out.tps = ok.reduce((a, x) => a + x.numTransactions / x.samplePeriodSecs, 0) / ok.length;
  } catch (e) {}
  try {
    const sigs = await rpc("getSignaturesForAddress", [PUMP, { limit: 10 }]);
    const pick = (Array.isArray(sigs) ? sigs : []).filter(x => x && !x.err).slice(0, 6);
    for (const x of pick) {
      if (out.traders.length >= 3) break;
      try {
        const tx = await rpc("getTransaction", [x.signature, opt]);
        const pk = ((((tx || {}).transaction || {}).message || {}).accountKeys || [])[0];
        if (typeof pk === "string" && B58.test(pk) && out.traders.indexOf(pk) < 0) out.traders.push(pk);
      } catch (e) {}
    }
  } catch (e) {}
  if (out.traders.length) last = { traders: out.traders, at: Date.now() };
  else if (Date.now() - last.at < 600000) out.traders = last.traders;
  send(res, 200, out, out.traders.length ? 15 : 4);
};
