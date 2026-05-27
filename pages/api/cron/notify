import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

webpush.setVapidDetails(
  'mailto:pipe@controltower.app',
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

export default async function handler(req, res) {
  // Vercel cron sends GET
  const now = new Date();
  const results = [];

  // Busca tareas con recordatorio pendiente
  const { data: tareas } = await supabase
    .from('tareas')
    .select('*')
    .neq('estado', 'hecho')
    .not('fecha_hora', 'is', null)
    .not('remind_minutes', 'is', null);

  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  if (!subs?.length || !tareas?.length) return res.json({ sent: 0 });

  for (const tarea of tareas) {
    const due = new Date(tarea.fecha_hora);
    const diffMin = (due - now) / 60000;
    const window = tarea.remind_minutes;

    // Notifica si estamos dentro del minuto de la ventana de recordatorio
    if (diffMin > window - 1 && diffMin <= window) {
      const ZONA = { electrolineras: '⚡', papa: '🏢', maestria: '🎓', personal: '🌿' };
      const emoji = ZONA[tarea.zona] || '📋';
      const payload = JSON.stringify({
        title: `${emoji} Recordatorio — ${tarea.titulo}`,
        body: `Programado en ${window} min · ${due.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
        tag: tarea.id,
        url: '/'
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub.subscription, payload);
          results.push(tarea.titulo);
        } catch (e) {
          // Suscripción expirada — eliminar
          if (e.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }
  }

  res.json({ sent: results.length, tasks: results });
}
