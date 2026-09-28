#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 music2 contributors
"""Optional, separately installed pedalboard effect host for music2's JSON+WAV protocol."""

import json
import math
import os
import struct
import sys
from importlib.metadata import version

PROTOCOL = "music2-plugin-bridge/1"
MAX_FRAMES = 67_108_864
MAX_JSON = 65_536
HEADER = struct.Struct("<4sI4s4sIHHIIHHH4sII4sI")


def fail(code, message, exit_code):
    print(json.dumps({"protocol": PROTOCOL, "ok": False,
                      "error": {"code": code, "message": message}}, separators=(",", ":")))
    raise SystemExit(exit_code)


def only(obj, allowed, required):
    if not isinstance(obj, dict) or set(obj) - set(allowed) or set(required) - set(obj):
        fail("BAD_REQUEST", "invalid request shape", 2)


def read_request():
    raw = sys.stdin.buffer.read(MAX_JSON + 1)
    if len(raw) > MAX_JSON:
        fail("BAD_REQUEST", "request exceeds 64 KiB", 2)

    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                fail("BAD_REQUEST", "duplicate JSON key", 2)
            result[key] = value
        return result

    try:
        request = json.loads(raw, object_pairs_hook=unique,
                             parse_constant=lambda _: fail("BAD_REQUEST", "nonfinite JSON", 2))
    except (UnicodeError, ValueError):
        fail("BAD_REQUEST", "invalid JSON", 2)
    if not isinstance(request, dict) or request.get("protocol") != PROTOCOL:
        fail("BAD_REQUEST", "invalid protocol", 2)
    return request


def read_wav(path, frames, rate, numpy):
    if not os.path.isfile(path):
        fail("BAD_REQUEST", "input WAV is not a file", 2)
    with open(path, "rb") as stream:
        data = stream.read(58 + frames * 8 + 1)
    if len(data) != 58 + frames * 8:
        fail("BAD_REQUEST", "input WAV size mismatch", 2)
    riff, size, wave, fmt, fmt_size, tag, channels, sr, byte_rate, align, bits, extra, fact, fact_size, count, chunk, data_size = HEADER.unpack_from(data)
    if (riff, wave, fmt, fact, chunk) != (b"RIFF", b"WAVE", b"fmt ", b"fact", b"data") or \
            (size, fmt_size, tag, channels, sr, byte_rate, align, bits, extra, fact_size, count, data_size) != \
            (50 + frames * 8, 18, 3, 2, rate, rate * 8, 8, 32, 0, 4, frames, frames * 8):
        fail("BAD_REQUEST", "input WAV format mismatch", 2)
    samples = numpy.frombuffer(data, dtype="<f4", count=frames * 2, offset=58)
    for start in range(0, samples.size, 16384):
        part = samples[start:start + 16384]
        if not numpy.isfinite(part).all() or numpy.any(numpy.abs(part) > 64):
            fail("BAD_REQUEST", "input WAV samples are invalid", 2)
    return samples.reshape((frames, 2)).T.copy()


def write_wav(path, samples, rate, numpy):
    frames = samples.shape[1]
    peak = 0.0
    energy = 0.0
    for start in range(0, frames, 8192):
        part = samples[:, start:start + 8192]
        if not numpy.isfinite(part).all() or numpy.any(numpy.abs(part) > 64):
            fail("RENDER_FAILED", "output samples are invalid", 4)
        peak = max(peak, float(numpy.max(numpy.abs(part))))
        energy += float(numpy.sum(numpy.square(part, dtype=numpy.float64)))
    header = HEADER.pack(b"RIFF", 50 + frames * 8, b"WAVE", b"fmt ", 18, 3, 2,
                         rate, rate * 8, 8, 32, 0, b"fact", 4, frames, b"data", frames * 8)
    with open(path, "xb") as stream:
        stream.write(header)
        for start in range(0, frames, 8192):
            part = samples[:, start:start + 8192].T
            stream.write(numpy.asarray(part, dtype="<f4").tobytes(order="C"))
    return peak, math.sqrt(energy / (frames * 2)) if frames else 0.0


def pedalboard_module():
    try:
        import pedalboard  # Optional GPLv3 dependency; loaded only when this standalone script runs.
        import numpy
        return pedalboard, numpy
    except ImportError:
        fail("PEDALBOARD_MISSING", "pedalboard is unavailable", 5)


def probe():
    pedalboard, _ = pedalboard_module()
    print(json.dumps({"protocol": PROTOCOL, "ok": True, "op": "probe",
                      "hostVersion": "music2-python/1", "capabilities": {"audioEffect": True},
                      "pedalboard": version("pedalboard")}, separators=(",", ":")))


def selftest():
    pedalboard, numpy = pedalboard_module()
    rate = 48000
    source = numpy.sin(2 * numpy.pi * 1000 * numpy.arange(rate) / rate).astype("float32") * 0.5
    stereo = numpy.stack((source, source))
    result = pedalboard.Gain(gain_db=-6)(stereo, rate)
    peak = float(numpy.max(numpy.abs(result)))
    correlation = float(numpy.corrcoef(source, result[0])[0, 1])
    print(json.dumps({"protocol": PROTOCOL, "ok": True, "op": "selftest",
                      "hostVersion": "music2-python/1", "frames": rate, "sampleRate": rate,
                      "peak": peak, "correlation": correlation}, separators=(",", ":")))


def render(request):
    only(request, ["protocol", "op", "sampleRate", "channels", "bufferSize", "durationSec", "tailSec",
                   "input", "chain", "output", "seed"],
         ["protocol", "op", "sampleRate", "channels", "bufferSize", "durationSec", "tailSec",
          "input", "chain", "output", "seed"])
    rate = request["sampleRate"]
    duration = request["durationSec"]
    if type(rate) is not int or rate not in (44100, 48000) or request["channels"] != 2 or \
            request["bufferSize"] != 512 or type(duration) not in (float, int) or \
            not math.isfinite(duration) or duration < 0 or request["tailSec"] != 0:
        fail("BAD_REQUEST", "invalid audio parameters", 2)
    frames = round(duration * rate)
    if frames > MAX_FRAMES or frames * 8 > 512 * 1024 * 1024:
        fail("BAD_REQUEST", "audio exceeds bridge limit", 2)
    inp, out, chain = request["input"], request["output"], request["chain"]
    only(inp, ["kind", "wavPath"], ["kind", "wavPath"])
    only(out, ["wavPath", "format"], ["wavPath", "format"])
    if inp["kind"] != "wav" or out["format"] != "f32" or not isinstance(chain, list) or len(chain) != 1:
        fail("BAD_REQUEST", "unsupported render shape", 2)
    if not isinstance(inp["wavPath"], str) or not isinstance(out["wavPath"], str) or \
            not os.path.isabs(inp["wavPath"]) or not os.path.isabs(out["wavPath"]):
        fail("BAD_REQUEST", "WAV paths must be absolute", 2)
    stage = chain[0]
    only(stage, ["path", "pluginName", "params", "initTimeoutSec"],
         ["path", "pluginName", "params", "initTimeoutSec"])
    if not isinstance(stage["path"], str) or not os.path.isabs(stage["path"]) or \
            not isinstance(stage["params"], dict) or stage["initTimeoutSec"] != 10:
        fail("BAD_REQUEST", "invalid plugin stage", 2)
    pedalboard, numpy = pedalboard_module()
    audio = read_wav(inp["wavPath"], frames, rate, numpy)
    try:
        plugin = pedalboard.load_plugin(stage["path"], plugin_name=stage["pluginName"],
                                        initialization_timeout=10)
    except Exception as exc:
        print(f"plugin load failed: {type(exc).__name__}", file=sys.stderr)
        fail("PLUGIN_LOAD_FAILED", "plugin load failed", 3)
    try:
        for name, value in stage["params"].items():
            if name not in plugin.parameters or type(value) not in (int, float, str, bool):
                fail("BAD_REQUEST", "unsupported plugin parameter", 2)
            setattr(plugin, name, value)
        processed = numpy.asarray(plugin(audio, rate, buffer_size=512), dtype=numpy.float32)
        if processed.shape != (2, frames):
            fail("RENDER_FAILED", "plugin changed output shape", 4)
        peak, rms = write_wav(out["wavPath"], processed, rate, numpy)
    except (SystemExit, KeyboardInterrupt):
        raise
    except Exception as exc:
        print(f"plugin render failed: {type(exc).__name__}", file=sys.stderr)
        fail("RENDER_FAILED", "plugin render failed", 4)
    latency = int(getattr(plugin, "reported_latency_samples", 0))
    print(json.dumps({"protocol": PROTOCOL, "ok": True, "wavPath": out["wavPath"], "frames": frames,
                      "sampleRate": rate, "channels": 2, "peak": peak, "rms": rms,
                      "latencySamples": [latency], "hostVersion": "music2-python/1", "warnings": []},
                     separators=(",", ":")))


def main():
    request = read_request()
    op = request.get("op")
    if op == "probe":
        only(request, ["protocol", "op"], ["protocol", "op"])
        probe()
    elif op == "selftest":
        only(request, ["protocol", "op"], ["protocol", "op"])
        selftest()
    elif op == "render":
        render(request)
    else:
        fail("BAD_REQUEST", "unsupported operation", 2)


if __name__ == "__main__":
    main()
