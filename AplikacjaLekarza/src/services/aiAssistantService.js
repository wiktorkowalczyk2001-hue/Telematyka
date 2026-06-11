import { addVisit, fetchVisitsByDate } from './visitService';

const LM_STUDIO_URL = typeof window !== 'undefined' ? '/lm/v1' : 'http://192.168.0.31:1234/v1';
const API_URL = typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

const MARKER_START = '[TOOL_REQUEST]';
const MARKER_END = '[END_TOOL_REQUEST]';
const MAX_TOOL_ROUNDS = 4;

const DAYS_PL = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

// ── System prompt (date injected each call so relative dates resolve) ─────────
function buildSystemPrompt() {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return `Jesteś konkretnym asystentem medycznym w aplikacji klinicznej dla lekarza.

Dzisiejsza data: ${iso} (${DAYS_PL[now.getDay()]}). Relatywne terminy (jutro, pojutrze, w poniedziałek) PRZELICZ samodzielnie na format YYYY-MM-DD.

KIEDY POTRZEBUJESZ DANYCH Z SYSTEMU — PIERWSZYM ZNAKIEM ODPOWIEDZI MUSI BYĆ [TOOL_REQUEST]. Zero słów przed blokiem. Zero słów po [END_TOOL_REQUEST]. Tylko blok, nic więcej.
${MARKER_START}
{"name": "NAZWA", "arguments": { ... }}
${MARKER_END}

DOSTĘPNE NARZĘDZIA:
1. get_patients — wyszukaj pacjentów.
   arguments: { "name_search"?: string, "min_age"?: number, "max_age"?: number, "diagnosis"?: string }
2. get_visits_by_date — wizyty na dany dzień.
   arguments: { "date": "YYYY-MM-DD" }
3. schedule_appointment — umów wizytę (sam sprawdza pacjenta i konflikt godzin).
   arguments: { "patient_name": string, "date": "YYYY-MM-DD", "time": "HH:MM", "reason"?: string }

ZASADY:
- Pozdrowienia ("hej", "cześć", "dzień dobry", "jak się masz") → odpowiedz bezpośrednio, BEZ narzędzi.
- Pytania ogólne, pytania o możliwości asystenta → odpowiedz bezpośrednio, BEZ narzędzi.
- Pytanie o pacjentów → get_patients. Pytanie o harmonogram/wizyty → get_visits_by_date. Prośba o umówienie → schedule_appointment.
- Przy umawianiu wizyty: jeśli imię/nazwisko pacjenta jest niejasne lub ogólne — NAJPIERW wywołaj get_patients aby znaleźć właściwego pacjenta, POTEM schedule_appointment z dokładnym imieniem.
- Wywołuj JEDNO narzędzie naraz. Po otrzymaniu wyniku wywołaj kolejne jeśli potrzeba, lub odpowiedz.
- Gdy masz już wszystkie dane — odpowiedz naturalnie, krótko, po polsku. Nie pokazuj bloków narzędzi.
- Jeśli pytanie nie wymaga danych z systemu — odpowiedz od razu, bez narzędzia.`;
}

// Minimal prompt for the final answer phase — no tool machinery, so the small
// model focuses purely on turning gathered data into a natural reply.
function buildAnswerSystemPrompt() {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return `Jesteś pomocnym asystentem medycznym lekarza. Dzisiejsza data: ${iso}.
Odpowiadaj krótko, naturalnie i po polsku. Korzystaj WYŁĄCZNIE z danych podanych przez użytkownika — nie wymyślaj pacjentów, wizyt ani faktów. Nie pokazuj formatów technicznych ani bloków narzędzi.`;
}

// ── Model id (LM Studio matches by id in newer versions) ──────────────────────
let cachedModelId = null;
async function getModelId() {
  if (cachedModelId) return cachedModelId;
  try {
    const r = await fetch(`${LM_STUDIO_URL}/models`);
    if (r.ok) {
      const d = await r.json();
      cachedModelId = d.data?.[0]?.id || 'local-model';
    } else {
      cachedModelId = 'local-model';
    }
  } catch {
    cachedModelId = 'local-model';
  }
  return cachedModelId;
}

// ── Display cleaning helpers ──────────────────────────────────────────────────
function stripCompleteThink(s) {
  return s.replace(/<think>[\s\S]*?<\/think>/g, '');
}

function hasOpenThink(s) {
  const open = (s.match(/<think>/g) || []).length;
  const close = (s.match(/<\/think>/g) || []).length;
  return open > close;
}

function cleanForDisplay(s) {
  return s
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/\[TOOL_REQUEST\][\s\S]*?\[END_TOOL_REQUEST\]/g, '')
    .replace(/\[TOOL_REQUEST\][\s\S]*$/, '')   // trailing partial tool block
    .replace(/<think>[\s\S]*$/, '')            // trailing partial think
    .replace(/^\s+/, '');
}

// Simulates token streaming from an already-complete string (no extra model call)
async function fakeStream(text, onToken) {
  if (!onToken || !text) { onToken?.(text || ''); return; }
  const words = text.split(' ');
  let acc = '';
  for (const w of words) {
    acc += (acc ? ' ' : '') + w;
    onToken(acc);
    await new Promise(r => setTimeout(r, 22));
  }
  onToken(text); // guarantee exact final text
}

// Extract only the [TOOL_REQUEST]...[END_TOOL_REQUEST] block from raw output.
// When the model writes prose before the tool call, we strip it so the
// history sent in the next round doesn't look like the model already "responded".
function toolCallOnly(raw) {
  const match = raw.match(/\[TOOL_REQUEST\][\s\S]*?\[END_TOOL_REQUEST\]/);
  return match ? match[0] : raw;
}

function parseTextToolCall(content) {
  if (!content) return null;
  const match = content.match(/\[TOOL_REQUEST\]\s*([\s\S]*?)\s*\[END_TOOL_REQUEST\]/);
  if (!match) return null;

  let body = match[1].trim();
  // Strip markdown code fences the model sometimes adds
  body = body.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Extract first balanced {...} object
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonStr = body.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed?.name) return null;
    return { name: parsed.name, args: parsed.arguments || parsed.args || {} };
  } catch {
    return null;
  }
}

// ── Streaming round with tool-vs-prose gate ───────────────────────────────────
// onDisplay(text) is called with cumulative cleaned prose as it streams.
// Returns { raw, toolCall, displayText }.
async function streamRound(messages, onDisplay) {
  const model = await getModelId();
  const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...messages],
      temperature: 0.9,
      max_tokens: 800,
      stream: true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LM Studio ${res.status}: ${txt.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  let mode = 'deciding'; // 'deciding' | 'prose' | 'tool'

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break outer;
      let parsed;
      try { parsed = JSON.parse(data); } catch { continue; }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (!delta) continue;
      raw += delta;

      if (mode === 'tool') {
        if (raw.includes(MARKER_END)) break outer;
        continue;
      }
      if (mode === 'prose') {
        // Model started with prose then emitted a tool call — switch silently
        if (raw.includes(MARKER_START)) {
          mode = 'tool';
          if (raw.includes(MARKER_END)) break outer;
        } else {
          onDisplay?.(cleanForDisplay(raw));
        }
        continue;
      }

      // mode === 'deciding'
      if (hasOpenThink(raw)) continue;          // wait for think block to close
      const probe = stripCompleteThink(raw).replace(/^\s+/, '');
      if (probe === '') continue;
      if (probe.startsWith(MARKER_START)) {
        mode = 'tool';
        if (raw.includes(MARKER_END)) break outer;
        continue;
      }
      if (MARKER_START.startsWith(probe)) continue; // ambiguous prefix e.g. "[TOOL"
      // definitely prose
      mode = 'prose';
      onDisplay?.(cleanForDisplay(raw));
    }
  }

  try { reader.cancel(); } catch { /* ignore */ }

  return {
    raw,
    toolCall: parseTextToolCall(raw),
    displayText: cleanForDisplay(raw),
  };
}

// ── Plain answer streamer (no tool gate) — used for final answer phase ────────
async function streamPlainAnswer(messages, systemPrompt, onToken) {
  const model = await getModelId();
  const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.9,
      max_tokens: 600,
      stream: true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LM Studio ${res.status}: ${txt.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = '';

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break outer;
      let parsed;
      try { parsed = JSON.parse(data); } catch { continue; }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (!delta) continue;
      raw += delta;
      if (!hasOpenThink(raw)) onToken?.(cleanForDisplay(raw));
    }
  }

  try { reader.cancel(); } catch { /* ignore */ }
  return cleanForDisplay(raw);
}

// ── Tool execution ────────────────────────────────────────────────────────────
async function fetchPatientsFiltered(doctorId, { name_search, min_age, max_age, diagnosis } = {}) {
  const params = [`doctor_id=eq.${doctorId}`, 'order=last_name.asc'];
  if (min_age != null) params.push(`age=gte.${min_age}`);
  if (max_age != null) params.push(`age=lte.${max_age}`);
  if (diagnosis) params.push(`primary_diagnosis=ilike.*${encodeURIComponent(diagnosis)}*`);
  if (name_search) {
    const t = encodeURIComponent(`%${name_search}%`);
    params.push(`or=(first_name.ilike.${t},last_name.ilike.${t})`);
  }
  const res = await fetch(`${API_URL}/patients?${params.join('&')}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Błąd pobierania pacjentów');
  return (await res.json()).map(p => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    age: p.age,
    pesel: p.pesel,
    diagnosis: p.primary_diagnosis,
  }));
}

async function resolvePatient(doctorId, patientName) {
  let patients = await fetchPatientsFiltered(doctorId, { name_search: patientName });
  if (!patients.length) {
    // fallback: search each name part separately
    for (const part of patientName.split(' ').filter(p => p.length >= 3)) {
      const found = await fetchPatientsFiltered(doctorId, { name_search: part });
      patients = [...patients, ...found.filter(p => !patients.find(f => f.id === p.id))];
    }
  }
  return patients;
}

async function executeTool(name, args, ctx) {
  const { doctorId } = ctx;

  if (name === 'get_patients') {
    const patients = await fetchPatientsFiltered(doctorId, args || {});
    if (!patients.length) return 'Brak pacjentów spełniających kryteria.';
    return patients
      .map(p => `- ${p.firstName} ${p.lastName}${p.age ? `, ${p.age} lat` : ''}${p.diagnosis ? `, ${p.diagnosis}` : ''}`)
      .join('\n');
  }

  if (name === 'get_visits_by_date') {
    if (!args?.date) return 'Brak daty. Podaj datę w formacie YYYY-MM-DD.';
    const visits = await fetchVisitsByDate(args.date, doctorId);
    if (!visits.length) return `Brak wizyt na ${args.date}.`;
    return visits.map(v => `- ${v.visitTime} ${v.patientName} (${v.reason})`).join('\n');
  }

  if (name === 'schedule_appointment') {
    const { patient_name, date, time, reason } = args || {};
    if (!patient_name) return 'Brak imienia pacjenta.';
    if (!/^\d{2}:\d{2}$/.test(time || '')) return `Nieprawidłowy format godziny "${time}". Użyj HH:MM.`;
    const parsedDate = new Date(date);
    if (!date || isNaN(parsedDate.getTime())) return `Nieprawidłowa data "${date}". Użyj YYYY-MM-DD.`;

    const patients = await resolvePatient(doctorId, patient_name);
    if (!patients.length) {
      return `Nie znaleziono pacjenta "${patient_name}". Wywołaj teraz narzędzie get_patients (bez filtrów) aby zobaczyć pełną listę pacjentów, a następnie wybierz właściwego i umów wizytę.`;
    }
    if (patients.length > 1) {
      const list = patients
        .map(p => `${p.firstName} ${p.lastName} (${p.age} lat, PESEL ${p.pesel})`)
        .join(' | ');
      return `Znaleziono ${patients.length} pasujących pacjentów: ${list}. Poproś użytkownika o PESEL lub wiek, by wskazać właściwego.`;
    }

    const patient = patients[0];
    const existing = await fetchVisitsByDate(date, doctorId);
    const conflict = existing.find(v => v.visitTime === time);
    if (conflict) {
      return `Termin ${date} ${time} jest już zajęty przez ${conflict.patientName} (${conflict.reason}). Zaproponuj inną godzinę.`;
    }

    await addVisit({
      patientId: patient.id,
      visitDate: date,
      visitTime: time,
      reason: reason || 'Wizyta umówiona przez asystenta',
    }, doctorId);

    // Notify any listener (e.g. calendar) that data changed
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('visits-changed')); } catch { /* ignore */ }
    }

    return `OK — wizyta zapisana. Pacjent: ${patient.firstName} ${patient.lastName}${patient.age ? ` (${patient.age} lat)` : ''}. Termin: ${DAYS_PL[parsedDate.getDay()]} ${date}, godz. ${time}. Powód: ${reason || 'wizyta'}.`;
  }

  return `Nieznane narzędzie: ${name}.`;
}

const TOOL_LABELS = {
  get_patients: '📋 Pobrano pacjentów',
  get_visits_by_date: '📅 Sprawdzono harmonogram',
  schedule_appointment: '✅ Umówiono wizytę',
};

const TOOL_RUNNING = {
  get_patients: 'Szukam pacjentów…',
  get_visits_by_date: 'Sprawdzam harmonogram…',
  schedule_appointment: 'Umawiam wizytę…',
};

// ── Public API ────────────────────────────────────────────────────────────────
// callbacks: { onToken(text), onTool(runningLabel) }
// ctx: { doctorId }
export async function sendMessage(messages, callbacks = {}, ctx = {}) {
  const { onToken, onTool } = callbacks;
  if (!ctx.doctorId) {
    const msg = 'Brak zalogowanego lekarza — nie mogę pobrać danych. Zaloguj się ponownie.';
    onToken?.(msg);
    return { content: msg, toolsUsed: [] };
  }

  const working = [...messages];
  const toolsUsed = [];
  const gathered = []; // collected tool results for the answer phase

  // ── Phase 1: tool loop (detect + execute). Stream live only on round 0 so a
  //    pure-chat reply appears instantly; once a tool runs we suppress the
  //    messy intermediate and produce a clean answer in phase 2. ──────────────
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Never stream live during tool detection — prevents jarring prose→tool overwrite.
    // Pure prose gets fake-streamed after the round; tools go to Phase 2.
    const { raw, toolCall, displayText } = await streamRound(working, null);

    if (!toolCall) {
      if (gathered.length === 0) {
        // Pure chat — fake-stream so user still sees word-by-word animation
        const final = displayText || 'Nie mam odpowiedzi.';
        await fakeStream(final, onToken);
        return { content: final, toolsUsed };
      }
      // Tools were used and model gave a real response — use it directly (skip Phase 2)
      if (displayText && displayText.trim().length > 15) {
        await fakeStream(displayText, onToken);
        return { content: displayText, toolsUsed };
      }
      break; // model was silent (EOS) → fall through to Phase 2 synthesis
    }

    onTool?.(TOOL_RUNNING[toolCall.name] || 'Przetwarzam…');
    let result;
    try {
      result = await executeTool(toolCall.name, toolCall.args, ctx);
    } catch (e) {
      result = `Nie udało się pobrać danych (${e.message}). Poinformuj użytkownika krótko, że wystąpił problem z systemem.`;
    }
    toolsUsed.push(TOOL_LABELS[toolCall.name] || toolCall.name);
    gathered.push({ tool: toolCall.name, args: toolCall.args, result });

    working.push({ role: 'assistant', content: toolCallOnly(raw) });
    working.push({
      role: 'user',
      content: `Wynik narzędzia ${toolCall.name}:\n${result}\n\nJeśli wynik sugeruje użycie kolejnego narzędzia — wywołaj je. Jeśli masz już wszystkie dane — odpowiedz użytkownikowi. Nie wywołuj dokładnie tego samego narzędzia z identycznymi argumentami.`,
    });
  }

  // ── Phase 2: clean answer from gathered data (minimal prompt, real stream) ──
  const lastUserQuestion = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const dataBlock = gathered.map(g => g.result).join('\n\n');
  const answerMessages = [
    {
      role: 'user',
      content: `Pytanie użytkownika: ${lastUserQuestion}\n\nDane pobrane z systemu:\n${dataBlock}\n\nOdpowiedz na pytanie po polsku, krótko i naturalnie, używając tych danych.`,
    },
  ];

  onTool?.('Formułuję odpowiedź…');
  const final = await streamPlainAnswer(answerMessages, buildAnswerSystemPrompt(), onToken);
  return { content: final || 'Gotowe.', toolsUsed };
}

export function getLMStudioURL() { return LM_STUDIO_URL; }

// ── Demo / mock scenario (step-based) ────────────────────────────────────────
// "hej" starts the demo (step 0). Each subsequent user message advances one
// step regardless of what was typed. Only AI responses are scripted; real
// DB calls are used so data is authentic.
//
//  Step 0 — greeting
//  Step 1 — patient list  (real get_patients)
//  Step 2 — free slots    (real get_visits_by_date for 2026-06-12)
//  Step 3 — book visit    (real addVisit: Andrzej Nowicki, 12:30)
export async function runDemoStep(step, callbacks = {}, ctx = {}) {
  const { onToken, onTool } = callbacks;
  const { doctorId } = ctx;
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const DEMO_DATE = '2026-06-12';

  if (!doctorId) {
    const msg = 'Brak zalogowanego lekarza.';
    onToken?.(msg);
    return { content: msg, toolsUsed: [] };
  }

  // ── Step 0: greeting ──────────────────────────────────────────────────
  if (step === 0) {
    const text = 'Cześć! Mogę pokazać listę pacjentów, sprawdzić wolne terminy lub umówić wizytę. O co chodzi?';
    await fakeStream(text, onToken);
    return { content: text, toolsUsed: [] };
  }

  // ── Step 1: patient list ──────────────────────────────────────────────
  if (step === 1) {
    onTool?.('Szukam pacjentów…');
    await delay(500);
    let patients = [];
    try { patients = await fetchPatientsFiltered(doctorId, {}); } catch { /* offline */ }

    const lines = patients.slice(0, 8).map(p =>
      `• ${p.firstName} ${p.lastName}${p.age ? ` (${p.age} l.)` : ''}${p.diagnosis ? ` — ${p.diagnosis}` : ''}`
    );
    if (patients.length > 8) lines.push(`…i ${patients.length - 8} więcej`);

    const text = patients.length
      ? `Masz ${patients.length} pacjentów:\n\n${lines.join('\n')}`
      : 'Nie masz jeszcze żadnych pacjentów w systemie.';
    await fakeStream(text, onToken);
    return { content: text, toolsUsed: [TOOL_LABELS.get_patients] };
  }

  // ── Step 2: free slots on 12.06.2026 ─────────────────────────────────
  if (step === 2) {
    onTool?.('Sprawdzam harmonogram na 12.06.2026…');
    await delay(500);
    let visits = [];
    try { visits = await fetchVisitsByDate(DEMO_DATE, doctorId); } catch { /* offline */ }

    const ALL_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                       '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00'];
    const taken = new Set(visits.map(v => v.visitTime));
    const free = ALL_SLOTS.filter(s => !taken.has(s));

    const takenStr = visits.length
      ? visits.map(v => `${v.visitTime} — ${v.patientName}`).join('\n')
      : 'brak';
    const freeStr = free.length ? free.slice(0, 8).join('  ·  ') : 'Brak wolnych terminów';

    const [y,m,d] = DEMO_DATE.split('-').map(Number);
    const dayName = DAYS_PL[new Date(y, m - 1, d).getDay()];
    const text = `Harmonogram na ${dayName} ${d}.${String(m).padStart(2,'0')}.${y}:\n\nZajęte:\n${takenStr}\n\nWolne terminy:\n${freeStr}`;
    await fakeStream(text, onToken);
    return { content: text, toolsUsed: [TOOL_LABELS.get_visits_by_date] };
  }

  // ── Step 3: book Andrzej Nowicki at 12:30 ────────────────────────────
  if (step === 3) {
    onTool?.('Szukam pacjenta…');
    await delay(400);
    let patients = [];
    try { patients = await fetchPatientsFiltered(doctorId, { name_search: 'Nowicki' }); } catch { /* offline */ }

    const target = patients.find(p =>
      p.lastName?.toLowerCase().includes('nowicki') && p.firstName?.toLowerCase().includes('andrzej')
    ) ?? patients.find(p => p.lastName?.toLowerCase().includes('nowicki'))
      ?? patients[0];

    onTool?.('Umawiam wizytę…');
    await delay(400);

    let text = '';
    if (target) {
      try {
        await addVisit({ patientId: target.id, visitDate: DEMO_DATE, visitTime: '12:30', reason: 'Wizyta kontrolna' }, doctorId);
        if (typeof window !== 'undefined') {
          try { window.dispatchEvent(new CustomEvent('visits-changed')); } catch { /* ignore */ }
        }
        const [y,m,d] = DEMO_DATE.split('-').map(Number);
        const dayName = DAYS_PL[new Date(y, m - 1, d).getDay()];
        text = `✅ Gotowe! Wizyta umówiona:\n\nPacjent: ${target.firstName} ${target.lastName}\nData: ${dayName} ${d}.${String(m).padStart(2,'0')}.${y}\nGodzina: 12:30\nPowód: wizyta kontrolna\n\nWizyta pojawi się w kalendarzu.`;
      } catch (e) {
        text = `⚠️ Nie udało się umówić wizyty: ${e.message}`;
      }
    } else {
      text = '⚠️ Nie znalazłem pacjenta Andrzej Nowicki w systemie.';
    }
    await fakeStream(text, onToken);
    return { content: text, toolsUsed: [TOOL_LABELS.schedule_appointment] };
  }

  // ── Step 4+: demo over ────────────────────────────────────────────────
  const text = 'Demo zakończone. Możesz teraz korzystać normalnie z asystenta.';
  await fakeStream(text, onToken);
  return { content: text, toolsUsed: [] };
}
