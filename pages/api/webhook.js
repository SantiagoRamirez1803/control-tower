import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const ZONA_EMOJI = { electrolineras: '⚡', papa: '🏢', maestria: '🎓', personal: '🌿' };

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

async function parseWithAI(text) {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Eres el asistente de Pipe. Analiza el mensaje y responde SOLO JSON válido sin backticks ni texto extra.

Hoy: ${today}. Calcula fechas relativas correctamente.
Zonas: electrolineras (empresa puntos carga EV), papa (empresa del papá), maestria (maestría datos), personal (médico/salidas/trámites).
Prioridades: alta, media, baja.

Si es una TAREA nueva:
{ "tipo": "tarea", "titulo": "...", "zona": "...", "prioridad": "...", "fecha_hora": "ISO8601 o null", "notas": "... o null", "confirmacion": "mensaje corto" }

Si es una CONSULTA (pendientes, hoy, semana, resumen):
{ "tipo": "consulta", "filtro": "hoy|semana|todo", "zona": "zona o null" }

Si es /start o saludo:
{ "tipo": "bienvenida" }

Mensaje de Pipe: ${text}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      })
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.candidates[0].content.parts[0].text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  const { message } = req.body;
  if (!message?.text) return res.status(200).json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text;

  try {
    const parsed = await parseWithAI(text);

    if (parsed.tipo === 'bienvenida') {
      await sendMessage(chatId,
        `⚡ *Control Tower activo, Pipe*\n\n` +
        `Escríbeme en lenguaje natural:\n\n` +
        `• _"Reunión Codensa jueves 3pm electrolineras"_\n` +
        `• _"Cita médica mañana 10am"_\n` +
        `• _"¿Qué tengo pendiente hoy?"_\n` +
        `• _"Resumen de esta semana"_`
      );
      return res.status(200).json({ ok: true });
    }

    if (parsed.tipo === 'tarea') {
      const { error } = await supabase.from('tareas').insert({
        titulo: parsed.titulo,
        zona: parsed.zona,
        prioridad: parsed.prioridad || 'media',
        fecha_hora: parsed.fecha_hora || null,
        notas: parsed.notas || null,
      });
      if (error) throw error;
      const emoji = ZONA_EMOJI[parsed.zona] || '✓';
      const fecha = parsed.fecha_hora
        ? `\n📅 ${new Date(parsed.fecha_hora).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : '';
      await sendMessage(chatId, `${emoji} *${parsed.titulo}*${fecha}\n\n${parsed.confirmacion}`);
    }

    if (parsed.tipo === 'consulta') {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      let query = supabase.from('tareas').select('*').neq('estado', 'hecho').order('fecha_hora', { ascending: true, nullsFirst: false });
      if (parsed.filtro === 'hoy') query = query.lte('fecha_hora', todayStr + 'T23:59:59');
      if (parsed.filtro === 'semana') query = query.lte('fecha_hora', nextWeek + 'T23:59:59');
      if (parsed.zona) query = query.eq('zona', parsed.zona);
      const { data: tareas } = await query.limit(15);

      if (!tareas?.length) {
        await sendMessage(chatId, '✅ No tienes tareas pendientes.');
      } else {
        const lista = tareas.map(t => {
          const e = ZONA_EMOJI[t.zona] || '•';
          const f = t.fecha_hora ? ` · ${new Date(t.fecha_hora).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
          const p = t.prioridad === 'alta' ? ' 🔴' : t.prioridad === 'media' ? ' 🟡' : '';
          return `${e} ${t.titulo}${f}${p}`;
        }).join('\n');
        await sendMessage(chatId, `📋 *Pendientes:*\n\n${lista}`);
      }
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    await sendMessage(chatId, '❌ Error: ' + e.message);
  }

  res.status(200).json({ ok: true });
}
