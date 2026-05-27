import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ZONA_EMOJI = { electrolineras: '⚡', papa: '🏢', maestria: '🎓', personal: '🌿' };

async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });
}

export default async function handler(req, res) {
  const now = new Date();

  const { data: tareas } = await supabase
    .from('tareas')
    .select('*')
    .neq('estado', 'hecho')
    .not('fecha_hora', 'is', null)
    .not('remind_minutes', 'is', null);

  if (!tareas?.length) return res.json({ sent: 0 });

  const sent = [];

  for (const tarea of tareas) {
    const due     = new Date(tarea.fecha_hora);
    const diffMin = (due - now) / 60000;
    const window  = tarea.remind_minutes;

    if (diffMin > window - 1 && diffMin <= window) {
      const emoji = ZONA_EMOJI[tarea.zona] || '📋';
      const hora  = due.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      await sendTelegram(
        `🔔 *Recordatorio — ${window} min*\n\n` +
        `${emoji} *${tarea.titulo}*\n` +
        `⏰ Programado a las ${hora}`
      );
      sent.push(tarea.titulo);
    }
  }

  res.json({ sent: sent.length, tasks: sent });
}
