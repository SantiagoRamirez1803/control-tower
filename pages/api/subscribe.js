import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'No subscription' });
  await supabase.from('push_subscriptions').upsert({ subscription }, { onConflict: 'subscription' });
  res.json({ ok: true });
}
