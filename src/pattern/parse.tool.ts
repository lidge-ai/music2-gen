import { Music2Error } from "../shared/index.ts";
import type { Atom, Node } from "./ast.schema.ts";

type Step = { node: Node; weight: number };
const atomChar = /[A-Za-z0-9#.-]/;

class Parser {
  private pos = 0;
  private readonly src: string;

  constructor(src: string) { this.src = src; }

  private fail(expected: string, offset = this.pos): never {
    throw new Music2Error("E_PARSE", `expected ${expected} at offset ${offset}`, {
      details: { src: this.src, offset, expected },
      fix: `${this.src}\n${" ".repeat(offset)}^ expected ${expected}`,
    });
  }

  private peek(): string { return this.src[this.pos] ?? ""; }
  private space(): void { while (/\s/.test(this.peek()) && this.peek()) this.pos++; }

  private integer(max: number, allowZero = false): number {
    const start = this.pos;
    while (/\d/.test(this.peek()) && this.peek()) this.pos++;
    if (start === this.pos) return this.fail("integer", start);
    const value = Number(this.src.slice(start, this.pos));
    if (!Number.isSafeInteger(value) || value > max || (!allowZero && value === 0)) {
      return this.fail(`integer ${allowZero ? "0" : "1"}..${max}`, start);
    }
    return value;
  }

  private term(depth: number): Node {
    if (depth > 32) return this.fail("nesting depth <= 32");
    const ch = this.peek();
    if (ch === "~") { this.pos++; return { type: "rest", id: -1 }; }
    if (ch === "[" || ch === "<") {
      this.pos++;
      const node = this.group(ch === "[" ? "]" : ">", ch === "<", depth + 1);
      this.pos++;
      return node;
    }
    const start = this.pos;
    while (atomChar.test(this.peek()) && this.peek()) this.pos++;
    const base = this.src.slice(start, this.pos);
    if (!base) return this.fail("atom, ~, [group], or <group>");
    if (!/^(?:-?\d+(?:\.\d+)?|[A-Za-z0-9#.]+)$/.test(base)) return this.fail("atom", start);
    let index: number | null = null;
    if (this.peek() === ":") {
      this.pos++;
      index = this.integer(Number.MAX_SAFE_INTEGER, true);
    }
    const raw = this.src.slice(start, this.pos);
    const atom: Atom = { raw, name: base, index, num: /^-?\d+(?:\.\d+)?$/.test(base) && index === null ? Number(base) : null, offset: start };
    if (atom.num !== null && !Number.isFinite(atom.num)) return this.fail("finite number", start);
    return { type: "atom", atom, id: -1 };
  }

  private step(depth: number): Step[] {
    let node = this.term(depth);
    let weight = 1;
    let stage = 0;
    while ("*/(?@".includes(this.peek()) && this.peek()) {
      const at = this.pos;
      const op = this.peek();
      this.pos++;
      const nextStage = op === "*" || op === "/" ? 1 : op === "(" ? 2 : op === "?" ? 3 : 4;
      if (nextStage <= stage) return this.fail("suffix order: speed, euclid, ?, @", at);
      stage = nextStage;
      if (op === "*" || op === "/") {
        node = { type: op === "*" ? "fast" : "slow", node, factor: this.integer(64), id: -1 };
      } else if (op === "(") {
        const k = this.integer(64, true);
        if (this.peek() !== ",") return this.fail(",");
        this.pos++;
        const n = this.integer(64);
        let r = 0;
        if (this.peek() === ",") { this.pos++; r = this.integer(64, true); }
        if (this.peek() !== ")") return this.fail(")");
        this.pos++;
        if (k > n) return this.fail("euclidean k <= n", at);
        node = { type: "euclid", node, k, n, r, id: -1 };
      } else if (op === "?") {
        const start = this.pos;
        while (/[0-9.]/.test(this.peek()) && this.peek()) this.pos++;
        const text = this.src.slice(start, this.pos);
        const prob = text ? Number(text) : 0.5;
        if (text && (!/^(?:\d+)(?:\.\d+)?$/.test(text) || prob < 0 || prob > 1)) {
          return this.fail("probability 0..1", start);
        }
        node = { type: "degrade", node, prob, id: -1 };
      } else {
        weight = this.integer(64);
      }
    }
    let copies = 1;
    while (this.peek() === "!") {
      this.pos++;
      const count = /\d/.test(this.peek()) && this.peek() ? this.integer(64) : 2;
      copies *= count;
      if (copies > 20000) return this.fail("at most 20000 expanded copies");
    }
    return Array.from({ length: copies }, () => ({ node: structuredClone(node), weight }));
  }

  private branch(close: string, depth: number): Step[] {
    const steps: Step[] = [];
    this.space();
    while (this.peek() && this.peek() !== close && this.peek() !== "," && this.peek() !== "|") {
      steps.push(...this.step(depth));
      const before = this.pos;
      this.space();
      if (this.peek() && this.peek() !== close && this.peek() !== "," && this.peek() !== "|" && before === this.pos) {
        return this.fail("space or group separator");
      }
    }
    if (steps.length === 0) return this.fail("nonempty branch");
    return steps;
  }

  private asSequence(steps: Step[]): Node {
    return steps.length === 1 && steps[0]?.weight === 1 ? steps[0].node : { type: "seq", steps, id: -1 };
  }

  private asAlternation(steps: Step[]): Node {
    if (steps.some((step) => step.weight !== 1)) return this.fail("unweighted alternation item");
    return { type: "alt", items: steps.map((step) => step.node), id: -1 };
  }

  group(close = "", alternate = false, depth = 0): Node {
    const branches: Step[][] = [this.branch(close, depth)];
    let separator = "";
    while (this.peek() === "," || this.peek() === "|") {
      const at = this.pos;
      const next = this.peek();
      if (separator && separator !== next) return this.fail("one separator kind per group", at);
      separator = next;
      this.pos++;
      branches.push(this.branch(close, depth));
    }
    if (close && this.peek() !== close) return this.fail(close);
    if (!close && this.peek()) return this.fail("end of pattern");
    if (alternate) {
      if (separator === "|") return this.asAlternation([{ node: { type: "choose", options: branches.map((b) => this.asSequence(b)), id: -1 }, weight: 1 }]);
      const alternatives = branches.map((branch) => this.asAlternation(branch));
      return alternatives.length === 1 ? alternatives[0]! : { type: "stack", branches: alternatives, id: -1 };
    }
    const nodes = branches.map((branch) => this.asSequence(branch));
    if (separator === ",") return { type: "stack", branches: nodes, id: -1 };
    if (separator === "|") return { type: "choose", options: nodes, id: -1 };
    return nodes[0] ?? this.fail("nonempty group");
  }
}

function assignIds(node: Node, next: { value: number }): void {
  node.id = next.value++;
  switch (node.type) {
    case "seq": for (const step of node.steps) assignIds(step.node, next); break;
    case "stack": for (const branch of node.branches) assignIds(branch, next); break;
    case "alt": for (const item of node.items) assignIds(item, next); break;
    case "choose": for (const option of node.options) assignIds(option, next); break;
    case "fast": case "slow": case "euclid": case "degrade": assignIds(node.node, next); break;
    case "atom": case "rest": break;
  }
}

export function parseMini(src: string): Node {
  if (src.length > 4000) {
    throw new Music2Error("E_PARSE", "pattern exceeds 4000 characters", {
      details: { src, offset: 4000, expected: "pattern length <= 4000" },
      fix: `${src}\n${" ".repeat(4000)}^ shorten pattern`,
    });
  }
  const node = new Parser(src).group();
  assignIds(node, { value: 0 });
  return node;
}
