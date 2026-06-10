import { addVisit, fetchVisitsByDate } from './visitService';

const LM_STUDIO_URL = typeof window !== 'undefined' ? '/lm/v1' : 'http://192.168.0.31:1234/v1';
const API_URL = typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

const SYSTEM_PROMPT = `Jesteś konkretnym asystentem medycznym w aplikacji klinicznej.

Gdy potrzebujesz danych, użyj DOKŁADNIE tego formatu (bez żadnego tekstu przed/po):
[TOOL_REQUEST]
{"name": "get_patients", "arguments": {"name_search": "..."}}
[END_TOOL_REQUEST]

Dostępne narzędzia:
- get_patients: args: name_search?, min_age?, max_age?, diagnosis?
- get_visits_by_date: args: date (YYYY-MM-DD) — WYMAGANE
- schedule_appointment: args: patient_name, date (YYYY-MM-DD), time (HH:MM), reason?

ZASADY:
1. Pytanie o pacjentów → użyj get_patients.
2. Pytanie o wizyty/harmonogram → użyj get_visits_by_date.
3. Umówienie wizyty → użyj schedule_appointment.
4. Odpowiadaj krótko, po polsku. Bez komentarzy o wywoływaniu narzędzi.
5. Po otrzymaniu danych — odpowiedz naturalnie.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_patients',
      description: 'Pobiera listę pacjentów.',
      parameters: {
        type: 'object',
        properties: {
          name_search: { type: 'string' },
          min_age: { type: 'integer' },
          max_age: { type: 'integer' },
          diagnosis: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_visits_by_date',
      description: 'Pobiera wizyty na dany dzień.',
      parameters: {
        type: 'object',
        properties: { date: { type: 'string' } },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_appointment',
      description: 'Umawia wizytę — sprawdza pacjenta i konflikty.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['patient_name', 'date', 'time'],
      },
    },
  },
];

async function fetchPatientsFiltered({ name_search, min_age, max_age, diagnosis } = {}) {
  const params = ['order=last_name.asc'];
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

async function executeTool(name, args) {
  if (name === 'get_patients') {
    const patients = await fetchPatientsFiltered(args);
    if (!patients.length) return 'Brak pacjentów spełniających kryteria.';
    return patients.map(p =>
      `${p.firstName} ${p.lastName}${p.age ? `, ${p.age} lat` : ''}${p.diagnosis ? `, ${p.diagnosis}` : ''}`
    ).join('\n');
  }

  if (name === 'get_visits_by_date') {
    const visits = await fetchVisitsByDate(args.date);
    if (!visits.length) return `Brak wizyt na ${args.date}.`;
    return visits.map(v => `${v.visitTime} — ${v.patientName} (${v.reason})`).join('\n');
  }

  if (name === 'schedule_appointment') {
    const { patient_name, date, time, reason } = args;
    if (!/^\d{2}:\d{2}$/.test(time)) return `Nieprawidłowy format godziny "${time}". Użyj HH:MM.`;
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return `Nieprawidłowa data "${date}".`;

    let allPatients = await fetchPatientsFiltered({ name_search: patient_name });
    if (!allPatients.length) {
      for (const part of patient_name.split(' ')) {
        if (part.length < 3) continue;
        const res = await fetchPatientsFiltered({ name_search: part });
        allPatients = [...allPatients, ...res.filter(p => !allPatients.find(f => f.id === p.id))];
      }
      if (!allPatients.length) return `Nie znaleziono pacjenta "${patient_name}". Sprawdź pisownię lub dodaj pacjenta do systemu.`;
    }
    if (allPatients.length > 1) {
      return `Znaleziono ${allPatients.length} pasujących pacjentów: ${allPatients.map(p => `${p.firstName} ${p.lastName} (${p.age} lat, PESEL: ${p.pesel})`).join(' | ')}. Podaj PESEL lub wiek, żebym wybrał właściwego.`;
    }

    const patient = allPatients[0];
    const existingVisits = await fetchVisitsByDate(date);
    const conflict = existingVisits.find(v => v.visitTime === time);
    if (conflict) return `Termin ${date} ${time} jest zajęty przez ${conflict.patientName} (${conflict.reason}). Wybierz inną godzinę.`;

    await addVisit({
      patientId: patient.id,
      visitDate: date,
      visitTime: time,
      reason: reason || 'Wizyta umówiona przez asystenta',
    });

    const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    return `Wizyta umówiona. Pacjent: ${patient.firstName} ${patient.lastName}${patient.age ? ` (${patient.age} lat)` : ''}. Termin: ${days[parsedDate.getDay()]}, ${date} o ${time}. Powód: ${reason || 'wizyta'}.`;
  }

  return 'Nieznane narzędzie.';
}

// Parse custom [TOOL_REQUEST]...[END_TOOL_REQUEST] format
function parseTextToolCall(content) {
  const match = content.match(/\[TOOL_REQUEST\]\s*([\s\S]*?)\s*\[END_TOOL_REQUEST\]/);
  if (!match) return null;
  try {
    const { name, arguments: args } = JSON.parse(match[1]);
    return { name, args };
  } catch { return null; }
}

// Parse standard OpenAI tool_calls format
function parseOpenAIToolCalls(toolCalls) {
  return toolCalls.map(tc => {
    let args = {};
    try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
    return { id: tc.id, name: tc.function?.name, args };
  });
}

async function callLMStream(messages, useTools, onDelta) {
  const body = {
    model: 'local-model',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.65,
    max_tokens: 700,
    stream: true,
  };
  if (useTools) { body.tools = TOOLS; body.tool_choice = 'auto'; }

  const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LM Studio ${res.status}: ${txt.slice(0, 150)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let toolCallsAcc = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // Accumulate content
        if (delta.content) {
          fullContent += delta.content;
          onDelta?.(fullContent);
        }

        // Accumulate OpenAI-style tool_calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: tc.id || '', function: { name: '', arguments: '' } };
            if (tc.function?.name) toolCallsAcc[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCallsAcc[idx].function.arguments += tc.function.arguments;
          }
        }
      } catch {}
    }
  }

  const openAIToolCalls = Object.values(toolCallsAcc).filter(tc => tc.function.name);
  return { content: fullContent, toolCallsAcc: openAIToolCalls };
}

const TOOL_LABELS = {
  get_patients: '📋 Pobrano pacjentów',
  get_visits_by_date: '📅 Sprawdzono harmonogram',
  schedule_appointment: '✅ Przetworzono wizytę',
};

export async function sendMessage(messages, onDelta) {
  // Phase 1: get model response
  const { content: phase1Content, toolCallsAcc } = await callLMStream(messages, true, onDelta);

  // Detect tool calls (OpenAI format or custom text format)
  const openAITools = toolCallsAcc.length > 0 ? parseOpenAIToolCalls(toolCallsAcc) : [];
  const textTool = openAITools.length === 0 ? parseTextToolCall(phase1Content) : null;

  const toolsToRun = openAITools.length > 0 ? openAITools : (textTool ? [textTool] : []);

  if (toolsToRun.length === 0) {
    // No tools — direct response already streamed
    return { content: stripThinking(phase1Content), toolsUsed: [] };
  }

  // Execute tools
  const toolsUsedLabels = [];
  const toolMessages = [];

  for (const tool of toolsToRun) {
    toolsUsedLabels.push(TOOL_LABELS[tool.name] || tool.name);
    const result = await executeTool(tool.name, tool.args);
    if (openAITools.length > 0) {
      toolMessages.push({ role: 'tool', tool_call_id: tool.id, content: result });
    } else {
      // Text format: inject result as user message
      toolMessages.push({ role: 'user', content: `Wynik narzędzia ${tool.name}:\n${result}` });
    }
  }

  // Build Phase 2 messages
  let phase2Messages;
  if (openAITools.length > 0) {
    const assistantMsg = {
      role: 'assistant',
      content: phase1Content || null,
      tool_calls: toolCallsAcc.map(tc => ({ id: tc.id, type: 'function', function: tc.function })),
    };
    phase2Messages = [...messages, assistantMsg, ...toolMessages];
  } else {
    phase2Messages = [...messages, { role: 'assistant', content: phase1Content }, ...toolMessages];
  }

  // Phase 2: stream final answer (no tools)
  onDelta?.(null); // null = tool executing, reset display
  const { content: phase2Content } = await callLMStream(phase2Messages, false, onDelta);
  return { content: stripThinking(phase2Content), toolsUsed: toolsUsedLabels };
}

function stripThinking(text) {
  if (!text) return text;
  return text
    .replace(/\[TOOL_REQUEST\][\s\S]*?\[END_TOOL_REQUEST\]/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<\|channel>[\s\S]*?<channel\|>/g, '')
    .trim();
}

export function getLMStudioURL() { return LM_STUDIO_URL; }
