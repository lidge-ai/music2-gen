/** Ordered, dependency-free XML 1.0 writer shared by DAW exporters. */
export interface XmlNode { tag: string; attrs: readonly (readonly [string, string])[]; children: readonly (XmlNode | string)[] }
export type XmlAttrs = readonly (readonly [string, string | number | boolean])[] | Readonly<Record<string, string | number | boolean>>;
const name = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function formatAlsNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("XML number must be finite");
  if (Object.is(value, -0)) return "0";
  const raw = String(value);
  if (!/[eE]/.test(raw)) return raw;
  const [mantissa = "", exponent = "0"] = raw.toLowerCase().split("e");
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace("-", "").replace(".", "");
  const dot = mantissa.replace("-", "").indexOf(".");
  const position = (dot < 0 ? digits.length : dot) + Number(exponent);
  const plain = position <= 0 ? `0.${"0".repeat(-position)}${digits}` :
    position >= digits.length ? `${digits}${"0".repeat(position - digits.length)}` :
      `${digits.slice(0, position)}.${digits.slice(position)}`;
  return (negative ? "-" : "") + plain;
}
function scalar(value: string | number | boolean): string {
  return typeof value === "number" ? formatAlsNumber(value) : String(value);
}
function escapeXml(value: string): string {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffe || code === 0xffff)
      throw new RangeError("XML 1.0 disallowed character");
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new RangeError("unpaired XML surrogate");
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new RangeError("unpaired XML surrogate");
  }
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
/** Attribute object insertion order is preserved; tuple arrays allow an explicit order. */
export function element(tag: string, attrs: XmlAttrs = [], children: readonly (XmlNode | string)[] = []): XmlNode {
  if (!name.test(tag)) throw new RangeError(`invalid XML element name: ${tag}`);
  const pairs: readonly (readonly [string, string | number | boolean])[] = Array.isArray(attrs) ?
    (attrs as readonly (readonly [string, string | number | boolean])[]) :
    Object.entries(attrs as Readonly<Record<string, string | number | boolean>>);
  const seen = new Set<string>();
  const fixed: [string, string][] = pairs.map(([key, value]) => {
    if (!name.test(key) || seen.has(key)) throw new RangeError(`invalid or duplicate XML attribute: ${key}`);
    seen.add(key);
    const encoded = scalar(value);
    escapeXml(encoded);
    return [key, encoded];
  });
  for (const child of children) if (typeof child === "string") escapeXml(child);
  return { tag, attrs: fixed, children: [...children] };
}
export const xml = element;
export const value = (tag: string, entry: string | number | boolean): XmlNode => element(tag, { Value: entry });
/** Stable LF layout, two-space indentation and a final newline. */
export function serialize(root: XmlNode, options: { declaration?: boolean | "xml" | "xmlStandalone" } = {}): string {
  const declaration = options.declaration === "xmlStandalone" ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' :
    options.declaration === false ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n';
  function write(node: XmlNode, depth: number): string {
    if (!name.test(node.tag)) throw new RangeError("invalid XML element name");
    const seen = new Set<string>();
    const attrs = node.attrs.map(([key, entry]) => {
      if (!name.test(key) || seen.has(key)) throw new RangeError("invalid or duplicate XML attribute");
      seen.add(key);
      return ` ${key}="${escapeXml(entry)}"`;
    }).join("");
    const prefix = "  ".repeat(depth);
    if (node.children.length === 0) return `${prefix}<${node.tag}${attrs} />\n`;
    if (node.children.every((child) => typeof child === "string"))
      return `${prefix}<${node.tag}${attrs}>${node.children.map((child) => escapeXml(child)).join("")}</${node.tag}>\n`;
    return `${prefix}<${node.tag}${attrs}>\n${node.children.map((child) =>
      typeof child === "string" ? `${"  ".repeat(depth + 1)}${escapeXml(child)}\n` : write(child, depth + 1)).join("")}${prefix}</${node.tag}>\n`;
  }
  return declaration + write(root, 0);
}
export function serializeXml(root: XmlNode, options: { declaration?: "xml" | "xmlStandalone" } = {}): Uint8Array {
  return Buffer.from(serialize(root, options), "utf8");
}
