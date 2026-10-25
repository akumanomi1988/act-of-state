/**
 * Deterministic statistics for independently measured HTTP response durations.
 * Measures actual wall time, not a synthetic workload or a throughput promise.
 */
export function percentile(values,p=95) {
  if(!Array.isArray(values)||values.length===0||
    values.some(x=>!Number.isFinite(x)||x<0)||p<0||p>100)
    throw new Error('LOAD_METRICS_INVALID_INPUT')
  const data=[...values].sort((a,b)=>a-b)
  return data[Math.ceil(p/100*data.length)-1]??data[0]
}
export function loadReceipt(durations,failures,opts={}) {
  const p95=percentile(durations,95)
  const ceiling=opts.ceilingMs??15_000
  if(!Number.isFinite(ceiling)||ceiling<=0)throw new Error('LOAD_BUDGET_INVALID')
  return {
    reads:durations.length,
    failed:failures,
    p50Ms:Math.round(percentile(durations,50)),
    p95Ms:Math.round(p95),
    worstMs:Math.round(percentile(durations,100)),
    withinBudget:failures===0&&p95<=ceiling,
    budgetMs:ceiling
  }
}
