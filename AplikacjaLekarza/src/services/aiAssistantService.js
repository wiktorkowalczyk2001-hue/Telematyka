import { addVisit, fetchVisitsByDate } from './visitService';

const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1';
const API_URL = 'http://192.168.0.31:3001';

const SYSTEM_PROMPT = `Jesteś asystentem medycznym w aplikacji Obsidian Clinic. Masz do dyspozycji narzędzia do pobierania danych z systemu.

ZASADY (obowiązkowe):
1. Gdy pytanie dotyczy pacjentów (lista, wiek, diagnoza, liczba) → ZAWSZE wywołaj get_patients. Nawet jeśli masz dane w historii — mogą być nieaktualne.
2. Gdy pytanie dotyczy wizyt lub harmonogramu na dany dzień → ZAWSZE wywołaj get_visits_by_date.
3. Gdy chcesz umówić wizytę → ZAWSZE wywołaj schedule_appointment. Bez pytania o potwierdzenie.
4. Nigdy nie odpowiadaj na pytania o dane z pamięci lub historii rozmowy — zawsze pobieraj świeże dane narzędziem.
5. Odpowiadaj krótko i konkretnie, po polsku.`;


const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_patients',
      description: 'Pobiera listę pacjentów. Używaj filtrów gdy pytanie dotyczy konkretnych kryteriów (wiek, diagnoza, nazwisko) — NIE pobieraj wszystkich gdy pytasz o podzbiór.',
      parameters: {
        type: 'object',
        properties: {
          name_search: { type: 'string', description: 'Fragment imienia lub nazwiska do wyszukania' },
          min_age: { type: 'integer', description: 'Minimalny wiek pacjenta (włącznie)' },
          max_age: { type: 'integer', description: 'Maksymalny wiek pacjenta (włącznie)' },
          diagnosis: { type: 'string', description: 'Fragment diagnozy do wyszukania (case-insensitive)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_visits_by_date',
      description: 'Pobiera listę wizyt zaplanowanych na konkretny dzień.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data w formacie YYYY-MM-DD' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_appointment',
      description: 'Umawia nową wizytę dla pacjenta w systemie.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string', description: 'Imię i nazwisko pacjenta' },
          date: { type: 'string', description: 'Data wizyty YYYY-MM-DD' },
          time: { type: 'string', description: 'Godzina wizyty HH:MM' },
          reason: { type: 'string', description: 'Powód wizyty' },
        },
        required: ['patient_name', 'date', 'time'],
      },
    },
  },
];

let patientCacheInternal = [];

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
  const data = await res.json();
  return data.map(p => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    age: p.age,
    diagnosis: p.primary_diagnosis,
  }));
}

async function executeTool(name, args) {
  if (name === 'get_patients') {
    const patients = await fetchPatientsFiltered(args);
    if (!args || (!args.min_age && !args.max_age && !args.name_search && !args.diagnosis)) {
      patientCacheInternal = patients;
    } else if (patients.length) {
      patientCacheInternal = [...patientCacheInternal, ...patients.filter(
        p => !patientCacheInternal.find(c => c.id === p.id)
      )];
    }
    if (patients.length === 0) return 'Brak pacjentów spełniających kryteria.';
    return patients.map(p =>
      `${p.firstName} ${p.lastName}, ${p.age || '?'} lat${p.diagnosis ? `, ${p.diagnosis}` : ''}`
    ).join('\n');
  }

  if (name === 'get_visits_by_date') {
    const visits = await fetchVisitsByDate(args.date);
    if (visits.length === 0) return `Brak wizyt na ${args.date}.`;
    return visits.map(v => `${v.visitTime} — ${v.patientName} (${v.reason})`).join('\n');
  }

  if (name === 'schedule_appointment') {
    if (!patientCacheInternal.length) {
      patientCacheInternal = await fetchPatientsFiltered();
    }
    const nameLower = (args.patient_name || '').toLowerCase();
    const patient = patientCacheInternal.find(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(nameLower)
    );
    if (!patient) {
      return `Nie znaleziono pacjenta "${args.patient_name}". Dostępni: ${patientCacheInternal.map(p => `${p.firstName} ${p.lastName}`).join(', ')}`;
    }
    await addVisit({
      patientId: patient.id,
      visitDate: args.date,
      visitTime: args.time,
      reason: args.reason || 'Wizyta umówiona przez asystenta',
    });
    return `Wizyta umówiona: ${patient.firstName} ${patient.lastName}, ${args.date} ${args.time}`;
  }

  return 'Nieznane narzędzie.';
}

async function callLM(messages, useTools = true) {
  const body = {
    model: 'local-model',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.6,
    max_tokens: 512,
    stream: false,
  };
  if (useTools) {
    body.tools = TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LM Studio ${res.status}: ${txt.slice(0, 150)}`);
  }
  return res.json();
}

export async function sendMessage(messages) {
  const data = await callLM(messages, true);
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error('Brak odpowiedzi od modelu.');

  const toolsUsedLabels = [];

  if (msg.tool_calls?.length > 0) {
    const toolMessages = [];

    for (const call of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch {}

      const result = await executeTool(call.function.name, args);

      const label = {
        get_patients: '📋 Pobrano listę pacjentów',
        get_visits_by_date: '📅 Sprawdzono harmonogram',
        schedule_appointment: '✅ Umówiono wizytę',
      }[call.function.name] || call.function.name;
      toolsUsedLabels.push(label);

      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result,
      });
    }

    const followUpData = await callLM([...messages, msg, ...toolMessages], false);
    const finalContent = stripThinking(followUpData.choices?.[0]?.message?.content) || 'Gotowe.';

    return { content: finalContent, toolsUsed: toolsUsedLabels };
  }

  return { content: stripThinking(msg.content) || 'Gotowe.', toolsUsed: [] };
}

function stripThinking(text) {
  if (!text) return text;
  return text.replace(/<\|channel>[\s\S]*?<channel\|>/g, '').trim();
}

export function getLMStudioURL() {
  return LM_STUDIO_URL;
}
