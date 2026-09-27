import { discoverFfmpeg } from "../../probe/index.ts";
import { Music2Error } from "../../shared/index.ts";
import type { DoctorData } from "../../probe/index.ts";
import type { CommandSpec } from "../registry.ts";

export const doctor: CommandSpec = {
  name: "doctor", summary: "Inspect ffmpeg capabilities",
  usage: "music2 doctor [--json]", options: {},
  async run({ args }) {
    if (args.length) throw new Music2Error("E_INPUT", "doctor takes no positional arguments");
    const required = process.env.MUSIC2_REQUIRE_FFMPEG === "1";
    const ffmpeg = await discoverFfmpeg();
    if (required && ffmpeg === null) throw new Music2Error("E_FFMPEG_MISSING", "ffmpeg executable not found");
    const ready = ffmpeg !== null && ffmpeg.encoders.libmp3lame && ffmpeg.encoders.libvorbis;
    if (required && !ready) throw new Music2Error("E_CAPABILITY", "ffmpeg requires libmp3lame and libvorbis encoders");
    const data: DoctorData = { ffmpeg, required, ready };
    return { command: "doctor", data: { ...data } };
  },
};
