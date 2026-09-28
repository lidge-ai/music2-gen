import type { ProjectIR } from "../../project/index.ts";
import { element, serializeXml } from "../xml.tool.ts";

/** Schema-ordered, path- and clock-free DAWproject metadata. */
export function metadataXml(project: ProjectIR): Uint8Array {
  return serializeXml(element("MetaData", [], [
    element("Title", [], [project.title]),
    element("Comment", [], ["Exported by music2"]),
  ]), { declaration: "xmlStandalone" });
}
