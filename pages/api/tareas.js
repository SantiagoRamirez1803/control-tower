import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { zona } = req.query;
    let query = supabase.from('tareas').select('*').order('fecha_hora', { ascending: true, nullsFirst: false });
    if (zona && zona !== 'all') query = query.eq('zona', zona);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { titulo, zona, prioridad, fecha_hora, fecha_fin, notas, remind_minutes } = req.body;
    const { data, error } = await supabase.from('tareas').insert({
      titulo, zona, prioridad: prioridad || 'media',
      fecha_hora: fecha_hora || null,
      fecha_fin:  fecha_fin  || null,
      notas:      notas      || null,
      remind_minutes: remind_minutes ? parseInt(remind_minutes) : null,
    }).select().single();
    if (error) return res.status(500).json({ error });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, estado, fecha_hora, fecha_fin, notas } = req.body;
    const updates = {};
    if (estado     !== undefined) updates.estado     = estado;
    if (fecha_hora !== undefined) updates.fecha_hora = fecha_hora;
    if (fecha_fin  !== undefined) updates.fecha_fin  = fecha_fin;
    if (notas      !== undefined) updates.notas      = notas;
    const { error } = await supabase.from('tareas').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) return res.status(500).json({ error });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
