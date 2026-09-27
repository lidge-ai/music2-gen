
import { readFileSync } from 'node:fs';
const [model, api, fmt] = process.argv.slice(2);
const b64 = readFileSync((process.env.CLIP || '/tmp/music2-poc/clip.' + fmt)).toString('base64');
const q = 'Listen to the attached audio. Answer in JSON: {"heard_audio": true|false, "bpm_estimate": number|null, "instruments": [], "genre_guess": ""}. If you cannot access audio, set heard_audio false.';
let url, body;
if (api === 'chat') { url = 'http://127.0.0.1:10100/v1/chat/completions';
  body = { model, messages: [{ role: 'user', content: [{ type: 'text', text: q }, { type: 'input_audio', input_audio: { data: b64, format: fmt } }] }] }; }
else if (api === 'responses') { url = 'http://127.0.0.1:10100/v1/responses';
  body = { model, input: [{ role: 'user', content: [{ type: 'input_text', text: q }, { type: 'input_audio', input_audio: { data: b64, format: fmt } }] }] }; }
else { url = 'http://127.0.0.1:10100/v1/responses';
  body = { model, input: [{ role: 'user', content: [{ type: 'input_text', text: q }, { type: 'input_file', filename: 'clip.' + fmt, file_data: 'data:audio/' + (fmt==='mp3'?'mpeg':'wav') + ';base64,' + b64 }] }] }; }
const t0 = Date.now();
const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer x' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) }).catch(e => ({ status: 'ERR', text: async () => String(e) }));
const txt = await res.text();
let out = txt;
try { const j = JSON.parse(txt); out = j.choices?.[0]?.message?.content ?? j.output_text ?? (j.output||[]).flatMap(o=>o.content||[]).map(c=>c.text).filter(Boolean).join(' ') ?? txt; if(!out) out = txt; } catch {}
console.log(JSON.stringify({ model, api, fmt, status: res.status, ms: Date.now() - t0, out: String(out).slice(0, 500) }));

