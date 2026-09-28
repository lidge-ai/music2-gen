export { PLUGIN_PROTOCOL, MAX_PLUGIN_FRAMES, MAX_PLUGIN_JSON_BYTES, parseStrictJson, parseHostArgv,
  validatePluginConfig, validatePluginUse, validatePluginRequest, validatePluginResponse } from "./contract.schema.ts";
export type { PluginValue, PluginUse, PluginEntry, PluginConfig, PluginRequest, PluginResponse } from "./contract.schema.ts";
export { loadPluginConfig, resolveHostArgv, runPluginHost, createExternalProcessor,
  encodePluginWav, decodePluginWav } from "./host.tool.ts";
export type { ExternalProcessor, PluginContext, PluginRunResult } from "./host.tool.ts";
export { probePluginHost, probeConfiguredPlugins, pluginConfigured } from "./detect.tool.ts";
export type { PluginProbe } from "./detect.tool.ts";
