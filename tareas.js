const { createClient } = require('@supabase/supabase-js');

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

  if (req.method === 'PATCH') {
    const { id, estado } = req.body;
    const { error } = await supabase.from('tareas').update({ estado }).eq('id', id);
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
