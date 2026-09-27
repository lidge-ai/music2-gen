import { Fraction, max, min, unitHash } from "../shared/index.ts";
import type { Hap, Node, QueryCtx, Span } from "./ast.schema.ts";
import { bjorklund, rotateLeft } from "./euclid.tool.ts";

const F = (n: number, d = 1): Fraction => Fraction.of(n, d);

function clip(whole: Span, begin: Fraction, end: Fraction): Span | null {
  const part = { begin: max(whole.begin, begin), end: min(whole.end, end) };
  return part.begin.lt(part.end) ? part : null;
}

function mapHap(hap: Hap, map: (time: Fraction) => Fraction): Hap {
  return {
    ...hap,
    whole: { begin: map(hap.whole.begin), end: map(hap.whole.end) },
    part: { begin: map(hap.part.begin), end: map(hap.part.end) },
  };
}

function cycles(begin: Fraction, end: Fraction, visit: (cycle: number) => void): void {
  for (let cycle = begin.floor(); F(cycle).lt(end); cycle++) visit(cycle);
}

function querySteps(steps: readonly (Node | null)[], weights: readonly number[],
  begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const result: Hap[] = [];
  cycles(begin, end, (cycle) => {
    let used = 0;
    for (let i = 0; i < steps.length; i++) {
      const child = steps[i];
      const weight = weights[i];
      if (weight === undefined) continue;
      const left = F(cycle).add(F(used, total));
      const right = F(cycle).add(F(used + weight, total));
      used += weight;
      if (!child) continue;
      const region = clip({ begin: left, end: right }, begin, end);
      if (!region) continue;
      const scale = F(weight, total);
      const inverse = (time: Fraction): Fraction => F(cycle).add(time.sub(left).div(scale));
      const forward = (time: Fraction): Fraction => left.add(time.sub(F(cycle)).mul(scale));
      for (const hap of queryNode(child, inverse(region.begin), inverse(region.end), ctx)) {
        result.push(mapHap(hap, forward));
      }
    }
  });
  return result;
}

function queryPerCycle(begin: Fraction, end: Fraction, ctx: QueryCtx,
  sourceCycle: (cycle: number) => number, selected: (cycle: number) => Node): Hap[] {
  const result: Hap[] = [];
  cycles(begin, end, (cycle) => {
    const segment = clip({ begin: F(cycle), end: F(cycle + 1) }, begin, end);
    if (!segment) return;
    const origin = sourceCycle(cycle);
    const shift = F(cycle - origin);
    for (const hap of queryNode(selected(cycle), segment.begin.sub(shift), segment.end.sub(shift), ctx)) {
      result.push(mapHap(hap, (time) => time.add(shift)));
    }
  });
  return result;
}

function queryNode(node: Node, begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[] {
  if (!begin.lt(end)) return [];
  switch (node.type) {
    case "atom": {
      const result: Hap[] = [];
      cycles(begin, end, (cycle) => {
        const whole = { begin: F(cycle), end: F(cycle + 1) };
        const part = clip(whole, begin, end);
        if (part) result.push({ whole, part, atom: node.atom, order: node.id * 1000 });
      });
      return result;
    }
    case "rest": return [];
    case "seq": return querySteps(node.steps.map((step) => step.node), node.steps.map((step) => step.weight), begin, end, ctx);
    case "stack": return node.branches.flatMap((branch) => queryNode(branch, begin, end, ctx));
    case "alt": return queryPerCycle(begin, end, ctx,
      (cycle) => Math.floor(cycle / node.items.length),
      (cycle) => node.items[((cycle % node.items.length) + node.items.length) % node.items.length]!);
    case "choose": return queryPerCycle(begin, end, ctx,
      (cycle) => cycle,
      (cycle) => node.options[Math.floor(unitHash(ctx.seed, ctx.salt, node.id, cycle) * node.options.length)]!);
    case "fast": {
      const factor = F(node.factor);
      return queryNode(node.node, begin.mul(factor), end.mul(factor), ctx)
        .map((hap) => mapHap(hap, (time) => time.div(factor)));
    }
    case "slow": {
      const factor = F(node.factor);
      return queryNode(node.node, begin.div(factor), end.div(factor), ctx)
        .map((hap) => mapHap(hap, (time) => time.mul(factor)));
    }
    case "euclid": {
      const bits = rotateLeft(bjorklund(node.k, node.n), node.r);
      return querySteps(bits.map((bit) => bit ? node.node : null), bits.map(() => 1), begin, end, ctx);
    }
    case "degrade": return queryNode(node.node, begin, end, ctx)
      .filter((hap) => unitHash(ctx.seed, ctx.salt, node.id, hap.whole.begin.toString()) >= node.prob);
  }
}

/** All haps whose spans overlap the half-open arc, retaining uncut whole spans. */
export function queryArc(node: Node, begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[] {
  return queryNode(node, begin, end, ctx).sort((a, b) => a.whole.begin.cmp(b.whole.begin) || a.order - b.order);
}

/** New attacks in the arc, excluding a sustained event that began earlier. */
export function onsets(node: Node, begin: Fraction, end: Fraction, ctx: QueryCtx): Hap[] {
  return queryArc(node, begin, end, ctx)
    .filter((hap) => hap.whole.begin.gte(begin) && hap.whole.begin.lt(end));
}
