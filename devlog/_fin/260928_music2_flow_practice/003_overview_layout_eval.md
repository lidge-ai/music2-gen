# 003 — Overview layout and vision-model evaluation protocol

Source: read-only research subagent (gpt-6-sol, 2026-09-28), written in Korean; kept verbatim. Evidence: ChartQA, CharXiv, BlindTest ('VLMs are blind'), Fico (text density/resolution), Okabe–Ito palette, WCAG contrast. Its ground-truth table for the examples was drafted before reading the songs; 040 recomputes ground truth from the song files. Main dispositions are in 004.

---

## (a) `overview.png` 설계

**1600×1000 px, 한 장.** 시간축은 모든 시간형 패널에서 `x=136…1168`로 고정합니다. 오른쪽 `x=1200…1576`은 섹션 표입니다. `Timeline.placements`의 0부터 시작하는 `startBar`는 이미지에서 **1부터 시작하는 바 번호**로 바꾸고, 마지막 경계는 `총 바 수+1`로 표시합니다. WAV 끝의 렌더링 tail은 음악 구간 축에서 제외합니다.

| 순서 | y 범위 | 표시 내용 |
| --- | ---: | --- |
| 헤더 | 0–108 | 제목, 길이와 박자표, `BPM 140 (DECLARED 140) | C MINOR | -14.1 LUFS | TP -1.3 DBTP` |
| 자동 판정 | 108–162 | `VERDICT 1 … | 2 … | 3 …` 한 줄. 경고 심각도, 가장 큰 섹션 음량 차, 첫 hook 진입을 정해진 우선순위로 선정. 값과 바 번호를 함께 적음 |
| 섹션 흐름 | 162–340 | 폭이 실제 바 길이에 비례하는 블록. 블록 안에 `01 INTRO`, `02 HOOK`처럼 **순번과 역할**을 직접 표기. 경계는 3 px 선, hook은 주황색 테두리와 `HOOK` 글자. 아래 두 줄 축은 `B01 B05 … B(N+1)`와 대응하는 `0:00 0:07 …` |
| 음량 | 340–580 | 바마다 측정한 LUFS 선과 점. y축은 `0, -12, -24, -36, -48 LUFS`; 범위를 벗어나면 끝점에 화살표와 실제 수치. 섹션 경계를 위 패널과 같은 x에 투영 |
| 편곡 밀도 | 580–800 | `DRUMS`, `BASS/808`, `OTHER NOTES` 3개 레인. 각 바의 이벤트 수를 막대 **높이**로 표현하고 `EVENTS/BAR`를 명시. 색이 사라져도 높이와 레인 이름으로 읽을 수 있음 |
| 전체 대역 | 800–930 | `GLOBAL BAND SHARE — NOT TIME` 제목 아래 `SUB`, `LOW`, `LOWMID`, `MID`, `PRESENCE`, `AIR`의 수평 막대와 백분율. 2열×3행으로 배치해 시간축으로 오인하지 않게 함 |
| 범례 | 930–1000 | `NUMBER = SECTION TABLE`, `ORANGE OUTLINE = HOOK`, `LOUDNESS = PER-BAR LUFS`, `BAR HEIGHT = EVENTS/BAR` |

오른쪽 표는 섹션 발생 순서대로 각 항목을 두 줄로 표시합니다. 예: `02 HOOK#1 B05 0:07` / `SECTION LUFS -12.4`. 가장 큰 값에는 `LOUDEST`를 추가합니다. **현재 코드의 `SectionMetrics.integratedLufs`는 해당 섹션의 게이트 적용 통합 LUFS**이므로, 산술 평균을 뜻하는 `MEAN LUFS`라고 쓰지 않는 편이 정확합니다. 15개를 넘는 섹션 발생을 모두 읽혀야 한다면 이미지 높이를 늘려 표 행을 보존해야 합니다.

색은 배경 RGB `(15,23,34)`, 본문 `(241,245,249)`, 보조 글자 `(203,213,225)`, 격자 `(107,114,128)`입니다. 데이터와 표식에는 [Okabe–Ito 색 설계](https://jfly.uni-koeln.de/color/)에서 하늘색 `(86,180,233)`=LUFS, 주황 `(230,159,0)`=hook, 노랑 `(240,228,66)`=drums, 청록 `(0,158,115)`=bass, 자주 `(204,121,167)`=other notes를 사용합니다. 모든 색 의미를 글자·테두리·위치·막대 높이로 중복합니다. 본문과 배경의 대비는 [WCAG의 이미지 속 글자 기준](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)에 맞춰 확인합니다.

핵심 글자는 **5×7 비트맵을 3배 정수 확대**해 높이 21 px로 굽습니다. 긴 제목만 줄바꿈하고, 중요 값은 2배 글자로 축소하지 않습니다. 1600 px의 긴 변을 1024 px로 줄여도 글자 높이가 약 13 px 남습니다. 현재 [`font.tool.ts`](../../../src/analyze/font.tool.ts)는 확대 및 `(`, `)`, `|`, `%` 등의 글리프가 없으므로 구현 시 추가가 필요합니다.

이 선택은 논문의 **결과에서 도출한 설계 판단**입니다. [ChartQA](https://arxiv.org/abs/2203.10244)는 차트 질문이 시각 요소 추출과 논리 추론을 함께 요구함을 보였고, [CharXiv](https://arxiv.org/abs/2406.18521)는 복잡한 실제 차트에서 큰 성능 격차를 보고했습니다. [BlindTest](https://arxiv.org/abs/2407.06581)는 가까이 겹친 도형·선의 위치 판단이 취약함을, [Fico](https://aclanthology.org/2026.findings-acl.1758/)는 글자 밀도가 높아지거나 해상도가 낮아질 때 성능이 급락함을 보고했습니다. 따라서 빽빽한 스펙트럼 색상에서 섹션을 추측하게 하기보다, 큰 직접 표기와 분리된 경계·수치 표를 사용합니다.

## (b) 이미지 단독 평가

다음 네 저장소 예제로 정답 파일을 **모델 호출 전에** 고정합니다. 경계 배열의 마지막 값은 종료 다음 바입니다.

| 곡 | 섹션 순서 | 경계 바 | 첫 hook 바 |
| --- | --- | --- | ---: |
| `drill-140` | intro#0, hook#0, verse#0 | `[1,5,13,17]` | 5 |
| `trap-150` | intro#0, verse#0, hook#0, outro#0 | `[1,5,13,21,25]` | 13 |
| `boom-bap-90` | intro#0, verse#0, hook#0, outro#0 | `[1,5,13,21,25]` | 13 |
| `house-124` | groove#0, breakdown#0, return#0, outro#0 | `[1,9,13,21,25]` | `null` |

`#0`은 현재 코드의 첫 발생 번호입니다. **가장 큰 LUFS 섹션은 JSON의 섹션 수치를 이미지에서 베끼지 않고**, 같은 렌더에서 독립적으로 얻은 `SectionMetrics.integratedLufs` 최대값으로 정답을 고정합니다. 동률 판정 규칙은 미리 정합니다(예: 0.1 LU 이내면 사례 제외). 이 읽기 전용 조사에서는 렌더와 VLM 호출을 하지 않았으므로 그 값이나 성공률을 주장하지 않습니다.

모델에 전달할 **정확한 텍스트 프롬프트**는 아래와 같습니다. 호출마다 이미지 **한 장만** 첨부하고 파일명·곡명·JSON·오디오·다른 그림은 주지 않습니다.

```text
Read only the attached image. Report the section occurrences in left-to-right order, including their printed IDs. Boundary bars are the start of the first section, every section change, and the end boundary after the final section. Bar numbers are 1-based. Identify the section with the highest printed SECTION LUFS value, and the first bar of a section whose role is HOOK. If there is no hook, use null. Do not infer unheard audio. If a value cannot be read, use an empty list or null. Return only JSON with exactly these keys:
{"section_order":["id#occurrence"],"boundary_bars":[1],"loudest_section":"id#occurrence","hook_start_bar":null}
```

JSON 스키마는 `section_order: string[]`, `boundary_bars: integer[]`, `loudest_section: string|null`, `hook_start_bar: integer|null`이며 추가 키는 실패로 처리합니다. 순서는 **전체 배열 완전 일치**만 정답입니다. 순서가 맞을 때만 각 경계의 `|예측−정답|≤1` 비율을 계산하고, 길이가 다르면 경계 점수는 0입니다. 가장 큰 섹션은 정확한 발생 ID 일치, hook은 ±1바 또는 `null` 정확 일치로 채점합니다. 네 조건을 모두 만족한 곡의 비율도 별도로 보고합니다.

각 곡에서 동일한 프롬프트·모델·이미지 전처리로 `overview.png`와 **기존 `spectrogram.png` 단독**을 쌍으로 비교합니다. 긴 변 1600, 1280, 1024 px의 세 조건을 기록하고, 모델별 반복 호출의 점수와 원본 응답을 보관합니다. 판정 줄을 가린 overview도 보조 실험으로 두면 표·축을 실제로 읽는지 확인할 수 있습니다. 네 곡에서의 향상은 이 네 사례에 대한 근거이며, 일반적 VLM 성능의 통계적 증명으로 확대하지 않습니다.
