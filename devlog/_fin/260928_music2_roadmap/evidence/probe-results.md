# opencodex audio-input probe (2026-09-28, local ocx :10100)
- chat.completions input_audio -> 400 'OpenCodex cannot translate audio input on this route' (google-antigravity/gemini-3.8-flash, cursor/gemini-3.8-flash, gpt-6-sol)
- responses input_audio (content part) -> 400 responses parse error (schema rejects)
- responses input_file data:audio/mpeg (drill 6s mp3) google-antigravity/gemini-3.8-flash -> 200 heard_audio=true bpm=145 (true 140) instruments=gamelan metallophones genre=Balinese Gamelan (8.6s)
- same, wav -> 200 heard_audio=true bpm=124 genre=Calypso (steelpan)
- same route, 90bpm 1kHz click mp3 control -> 200 heard_audio=false
- cursor/gemini-3.8-flash responses input_file -> failed unsupported_input_modality (document)
- gpt-6-sol responses input_file non-stream -> 400 'Stream must be set to true'
- /v1/models: 39 models, none advertises audio input_modalities (34 text+image)
