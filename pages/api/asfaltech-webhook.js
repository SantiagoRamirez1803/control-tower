import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const ASFALTECH_TOKEN = process.env.ASFALTECH_TOKEN;
const GROQ_KEY        = process.env.GROQ_KEY;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${ASFALTECH_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

async function parseWithAI(text, authorName) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `Eres el asistente de ASFALTECH Energy, empresa de puntos de carga para vehículos eléctricos.
Hoy: ${today}. El mensaje lo envía: ${authorName}.
Analiza el mensaje y responde SOLO JSON sin backticks.

Si es una TAREA nueva:
{ "tipo": "tarea", "titulo": "...", "prioridad": "alta|media|baja", "fecha_hora": "ISO8601 fecha inicio o null", "fecha_fin": "ISO8601 fecha fin o null (solo si hay rango)", "notas": "... o null", "confirmacion": "mensaje corto" }

Si es una CONSULTA (pendientes, hoy, semana, qué hay):
{ "tipo": "consulta", "filtro": "hoy|semana|todo" }

Si es /start o saludo:
{ "tipo": "bienvenida" }`
        },
        { role: 'user', content: text }
      ]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.choices[0].message.content.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  const { message } = req.body;
  if (!message?.text) return res.status(200).json({ ok: true });

  const chatId     = message.chat.id;
  const text       = message.text;
  const authorName = message.from?.first_name || 'Accionista';

  try {
    const parsed = await parseWithAI(text, authorName);

    if (parsed.tipo === 'bienvenida') {
      await sendMessage(chatId,
        `⚡ *ASFALTECH Energy Bot*\n\n` +
        `Hola ${authorName}. Escríbeme en lenguaje natural:\n\n` +
        `• _"Reunión con Codensa el jueves 3pm"_\n` +
        `• _"Llamar al proveedor de cables mañana"_\n` +
        `• _"¿Qué hay pendiente esta semana?"_\n\n` +
        `Todas las tareas van directo al dashboard de ASFALTECH.`
      );
      return res.status(200).json({ ok: true });
    }

    if (parsed.tipo === 'tarea') {
      const { error } = await supabase.from('tareas').insert({
        titulo:     parsed.titulo,
        zona:       'electrolineras',
        prioridad:  parsed.prioridad || 'media',
        fecha_hora: parsed.fecha_hora || null,
        fecha_fin:  parsed.fecha_fin  || null,
        notas:      parsed.notas ? `[${authorName}] ${parsed.notas}` : `Agregado por ${authorName}`,
      });
      if (error) throw error;
      const fecha = parsed.fecha_hora
        ? `\n📅 ${new Date(parsed.fecha_hora).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : '';
      await sendMessage(chatId, `⚡ *${parsed.titulo}*${fecha}\n\n${parsed.confirmacion}`);
    }

    if (parsed.tipo === 'consulta') {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      let query = supabase.from('tareas').select('*')
        .eq('zona', 'electrolineras')
        .neq('estado', 'hecho')
        .order('fecha_hora', { ascending: true, nullsFirst: false });
      if (parsed.filtro === 'hoy')    query = query.lte('fecha_hora', todayStr + 'T23:59:59');
      if (parsed.filtro === 'semana') query = query.lte('fecha_hora', nextWeek + 'T23:59:59');
      const { data: tareas } = await query.limit(15);

      if (!tareas?.length) {
        await sendMessage(chatId, '✅ No hay tareas pendientes en ASFALTECH.');
      } else {
        const lista = tareas.map(t => {
          const f = t.fecha_hora ? ` · ${new Date(t.fecha_hora).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
          const p = t.prioridad === 'alta' ? ' 🔴' : t.prioridad === 'media' ? ' 🟡' : '';
          return `⚡ ${t.titulo}${f}${p}`;
        }).join('\n');
        await sendMessage(chatId, `📋 *Pendientes ASFALTECH:*\n\n${lista}`);
      }
    }
  } catch (e) {
    console.error('ASFALTECH ERROR:', e.message);
    await sendMessage(chatId, '❌ Error: ' + e.message);
  }

  res.status(200).json({ ok: true });
}
