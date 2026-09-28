import { discoverFfmpeg } from "../../probe/index.ts";
import { music2Home, Music2Error } from "../../shared/index.ts";
import type { DoctorData } from "../../probe/index.ts";
import { loadPluginConfig, parseHostArgv, probeConfiguredPlugins, probePluginHost } from "../../plugin-host/index.ts";
import type { CommandSpec } from "../registry.ts";

export const doctor: CommandSpec = {
  name: "doctor", summary: "Inspect ffmpeg capabilities and the music2 storage home",
  usage: "music2 doctor [--plugins] [--plugin-host JSON-argv] [--json]", options: {
    plugins: { type: "boolean", description: "Probe configured external effect hosts" },
    "plugin-host": { type: "string", description: "Trusted host command as a JSON argv array" },
  },
  async run({ args, values }) {
    if (args.length) throw new Music2Error("E_INPUT", "doctor takes no positional arguments");
    const required = process.env.MUSIC2_REQUIRE_FFMPEG === "1";
    const ffmpeg = await discoverFfmpeg();
    if (required && ffmpeg === null) throw new Music2Error("E_FFMPEG_MISSING", "ffmpeg executable not found");
    const ready = ffmpeg !== null && ffmpeg.encoders.libmp3lame && ffmpeg.encoders.libvorbis;
    if (required && !ready) throw new Music2Error("E_CAPABILITY", "ffmpeg requires libmp3lame and libvorbis encoders");
    const data: DoctorData = { ffmpeg, required, ready };
    let plugins: Record<string, unknown>;
    try {
      const host = values["plugin-host"] === undefined ? undefined : parseHostArgv(values["plugin-host"] as string);
      const config = await loadPluginConfig();
      if (values["plugins"] === true) {
        plugins = { configured: Object.keys(config.plugins).length > 0 || host !== undefined, probed: true,
          ...(host ? { host: await probePluginHost(host) } : {}), entries: await probeConfiguredPlugins(config, host) };
      } else plugins = { configured: Object.keys(config.plugins).length > 0, probed: false };
    } catch (cause) {
      if (values["plugins"] === true) throw cause;
      const code = cause instanceof Music2Error && cause.code === "E_ACCESS" ? "E_ACCESS" : "E_INPUT";
      plugins = { configured: null, probed: false, error: code };
    }
    return { command: "doctor", data: { ...data, home: music2Home(), plugins } };
  },
};
