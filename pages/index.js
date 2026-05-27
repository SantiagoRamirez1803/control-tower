import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC = 'BD1NnKTxkP7R2MjVuw8qUatakSdYmo8jaa-fC-xd_WivA_3_gqh6-1_gGO7621XsSfF73OObjNIcHw_0IApxS00';

const ZONES = {
  all:            { label: 'Todo',             icon: '📋', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  electrolineras: { label: 'ASFALTECH Energy', icon: '⚡', color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  papa:           { label: 'Ayudas Familia',   icon: '🏢', color: '#0284C7', bg: '#F0F9FF', border: '#7DD3FC' },
  maestria:       { label: 'Maestría',          icon: '🎓', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  personal:       { label: 'Personal',          icon: '🌿', color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
};

const PRIO = {
  alta:  { label: 'Alta',  color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  media: { label: 'Media', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  baja:  { label: 'Baja',  color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

const DAY_NAMES   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = d => d.toISOString().split('T')[0];

function parseFechaHora(iso) {
  if (!iso) return { fecha: null, hora: null };
  const [datePart, timePart] = iso.split('T');
  if (!datePart) return { fecha: null, hora: null };
  const [y, m, d] = datePart.split('-').map(Number);
  const fecha = new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  let hora = null;
  if (timePart && timePart !== '00:00:00' && timePart !== '00:00:00.000Z') {
    const [h, min] = timePart.split(':').map(Number);
    hora = `${h % 12 || 12}:${String(min).padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`;
  }
  return { fecha, hora };
}

function getWeekDays(ref) {
  const d = new Date(ref), dow = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => { const nd = new Date(mon); nd.setDate(mon.getDate() + i); return nd; });
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1), dow = first.getDay();
  const start = new Date(first); start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

function taskCoversDay(task, ds) {
  const start = task.fecha_hora?.split('T')[0];
  const end   = task.fecha_fin?.split('T')[0];
  if (!start) return false;
  return end ? (ds >= start && ds <= end) : start === ds;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

const EMPTY_FORM = { titulo: '', zona: 'electrolineras', prioridad: 'media', fecha: '', hora: '', fecha_fin: '', notas: '', remind_minutes: '' };

export default function Dashboard() {
  const [tasks,      setTasks]      = useState([]);
  const [zone,       setZone]       = useState('all');
  const [selDay,     setSelDay]     = useState(null);
  const [calView,    setCalView]    = useState('week');
  const [calRef,     setCalRef]     = useState(new Date());
  const [showAdd,    setShowAdd]    = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [remindMin,  setRemindMin]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [fb,         setFb]         = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({ fecha: '', hora: '', fecha_fin: '', notas: '', remind_minutes: '' });
  const [notifStatus, setNotifStatus] = useState('idle'); // idle | asking | granted | denied

  const TODAY = fmt(new Date());

  // Register service worker + subscribe to push
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.register('/sw.js').then(async reg => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setNotifStatus('granted'); return; }
      if (Notification.permission === 'granted') {
        await subscribePush(reg);
      } else if (Notification.permission !== 'denied') {
        setNotifStatus('asking');
      }
    }).catch(() => {});
  }, []);

  const subscribePush = async (reg) => {
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      });
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });
      setNotifStatus('granted');
    } catch (e) {
      setNotifStatus('denied');
    }
  };

  const requestNotifPermission = async () => {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      await subscribePush(reg);
    } else {
      setNotifStatus('denied');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/tareas');
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, msg) => { setFb({ type, msg }); setTimeout(() => setFb(null), 3500); };

  const handleAdd = async () => {
    if (!form.titulo.trim()) return flash('err', 'El título es obligatorio.');
    setSaving(true);
    const fecha_hora = form.fecha ? (form.hora ? `${form.fecha}T${form.hora}:00` : `${form.fecha}T00:00:00`) : null;
    const fecha_fin  = form.fecha_fin ? `${form.fecha_fin}T00:00:00` : null;
    const res = await fetch('/api/tareas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: form.titulo, zona: form.zona, prioridad: form.prioridad, fecha_hora, fecha_fin, notas: form.notas || null, remind_minutes: remindMin ? parseInt(remindMin) : null })
    });
    if (res.ok) { flash('ok', 'Tarea agregada.'); setForm(EMPTY_FORM); setRemindMin(''); setShowAdd(false); load(); }
    else flash('err', 'Error al guardar.');
    setSaving(false);
  };

  const openEdit = (task) => {
    setEditingId(task.id);
    setEditForm({
      fecha:     task.fecha_hora?.split('T')[0] || '',
      hora:      (() => { const tp = task.fecha_hora?.split('T')[1]; return tp && tp !== '00:00:00' ? tp.slice(0,5) : ''; })(),
      fecha_fin: task.fecha_fin?.split('T')[0]  || '',
      notas:     task.notas || '',
      remind_minutes: task.remind_minutes ?? '',
    });
  };

  const handleEditSave = async (id) => {
    const { fecha, hora, fecha_fin, notas, remind_minutes } = editForm;
    const fecha_hora = fecha ? (hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`) : null;
    await fetch('/api/tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fecha_hora, fecha_fin: fecha_fin ? `${fecha_fin}T00:00:00` : null, notas: notas || null, remind_minutes: remind_minutes ? parseInt(remind_minutes) : null })
    });
    setEditingId(null); load(); flash('ok', 'Tarea actualizada.');
  };

  const updateEstado = async (id, estado) => {
    await fetch('/api/tareas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }) });
    load();
  };

  const deleteTask = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await fetch('/api/tareas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  const pending  = tasks.filter(t => t.estado !== 'hecho');
  const overdue  = pending.filter(t => t.fecha_hora && t.fecha_hora.split('T')[0] < TODAY);
  const calDays  = calView === 'week' ? getWeekDays(calRef) : getMonthDays(calRef.getFullYear(), calRef.getMonth());

  const navCal = dir => {
    const d = new Date(calRef);
    calView === 'week' ? d.setDate(d.getDate() + dir * 7) : d.setMonth(d.getMonth() + dir);
    setCalRef(d);
  };

  const calLabel = calView === 'week'
    ? (() => { const w = getWeekDays(calRef); return `${w[0].getDate()} – ${w[6].getDate()} ${MONTH_NAMES[w[6].getMonth()]} ${w[6].getFullYear()}`; })()
    : `${MONTH_NAMES[calRef.getMonth()]} ${calRef.getFullYear()}`;

  const visible = tasks
    .filter(t => zone === 'all' || t.zona === zone)
    .filter(t => !selDay || taskCoversDay(t, selDay))
    .sort((a, b) => {
      if (a.estado === 'hecho' && b.estado !== 'hecho') return 1;
      if (a.estado !== 'hecho' && b.estado === 'hecho') return -1;
      if (a.fecha_hora && b.fecha_hora) return a.fecha_hora.localeCompare(b.fecha_hora);
      if (a.fecha_hora) return -1; if (b.fecha_hora) return 1;
      return ({ alta: 0, media: 1, baja: 2 }[a.prioridad] || 1) - ({ alta: 0, media: 1, baja: 2 }[b.prioridad] || 1);
    });

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* NOTIF BANNER */}
      {notifStatus === 'asking' && (
        <div style={S.notifBanner}>
          <span>🔔 Activa las notificaciones para recibir recordatorios en tu iPhone</span>
          <button onClick={requestNotifPermission} style={S.notifBtn}>Activar</button>
          <button onClick={() => setNotifStatus('idle')} style={S.notifDismiss}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>⚡ Control Tower</div>
          <div style={S.sub}>{new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div style={S.hRight}>
          {overdue.length > 0 && <span style={{...S.chip,background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA'}}>⚠ {overdue.length} vencidas</span>}
          {notifStatus === 'granted' && <span style={{...S.chip,background:'#ECFDF5',color:'#059669',border:'1px solid #6EE7B7'}}>🔔 Notif. ON</span>}
          <a href="https://t.me/controltower_pipe_bot" target="_blank" style={S.tgBtn}>✈ Bot</a>
          <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Nueva</button>
        </div>
      </div>

      {fb && <div style={{...S.fb,background:fb.type==='ok'?'#ECFDF5':'#FEF2F2',color:fb.type==='ok'?'#065F46':'#DC2626',border:`1px solid ${fb.type==='ok'?'#6EE7B7':'#FECACA'}`}}>{fb.type==='ok'?'✓ ':'✕ '}{fb.msg}</div>}

      {/* ZONE CARDS */}
      <div style={S.zoneGrid}>
        {Object.entries(ZONES).map(([key, z]) => {
          const cnt = key === 'all' ? pending.length : tasks.filter(t => t.zona === key && t.estado !== 'hecho').length;
          const on  = zone === key;
          return (
            <button key={key} onClick={() => { setZone(key); setSelDay(null); }} style={{
              ...S.zoneCard,
              background:  on ? z.bg    : '#FFFFFF',
              borderColor: on ? z.color : '#E2E8F0',
              boxShadow:   on ? `0 0 0 2px ${z.color}40` : '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={S.zIcon}>{z.icon}</div>
              <div style={{...S.zLabel, color: on ? z.color : '#475569'}}>{z.label}</div>
              <div style={{...S.zCount, color: on ? z.color : '#94A3B8'}}>{cnt}</div>
            </button>
          );
        })}
      </div>

      {/* CALENDAR */}
      <div style={S.cal}>
        <div style={S.calTop}>
          <button style={S.nav} onClick={() => navCal(-1)}>‹</button>
          <span style={S.calLabel}>{calLabel}</span>
          <button style={S.nav} onClick={() => navCal(1)}>›</button>
          {fmt(calRef) !== TODAY && <button style={{...S.nav,color:'#059669',borderColor:'#6EE7B7'}} onClick={() => { setCalRef(new Date()); setSelDay(null); }}>Hoy</button>}
          <div style={S.viewToggle}>
            <button onClick={() => setCalView('week')} style={{...S.viewBtn,background:calView==='week'?'#1E293B':'transparent',color:calView==='week'?'#fff':'#64748B'}}>Sem</button>
            <button onClick={() => setCalView('month')} style={{...S.viewBtn,background:calView==='month'?'#1E293B':'transparent',color:calView==='month'?'#fff':'#64748B'}}>Mes</button>
          </div>
        </div>
        {calView === 'month' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
            {DAY_NAMES.map(d => <div key={d} style={{fontSize:9,fontWeight:700,color:'#94A3B8',textAlign:'center',padding:'4px 0'}}>{d}</div>)}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:calView==='month'?2:4}}>
          {calDays.map((day, i) => {
            const ds = fmt(day);
            const isToday = ds === TODAY, isSel = selDay === ds;
            const isOther = calView === 'month' && day.getMonth() !== calRef.getMonth();
            const dayTasks = tasks.filter(t => taskCoversDay(t, ds) && t.estado !== 'hecho');
            return (
              <button key={ds} onClick={() => setSelDay(isSel ? null : ds)} style={{
                ...S.calCell,
                minHeight: calView === 'month' ? 52 : 62,
                background:  isSel ? '#ECFDF5' : isToday ? '#F0FDF4' : '#FFFFFF',
                borderColor: isSel ? '#059669' : isToday ? '#6EE7B7' : '#E2E8F0',
                opacity: isOther ? 0.35 : 1,
              }}>
                {calView === 'week' && <span style={{fontSize:9,fontWeight:700,color:isToday?'#059669':'#94A3B8'}}>{DAY_NAMES[i]}</span>}
                <span style={{fontSize:calView==='month'?13:15,fontWeight:700,color:isSel?'#059669':isToday?'#065F46':'#334155'}}>{day.getDate()}</span>
                <div style={S.dots}>
                  {dayTasks.slice(0,3).map((t,j) => <div key={j} style={{...S.dot,background:(ZONES[t.zona]||ZONES.personal).color}}/>)}
                  {dayTasks.length > 3 && <div style={{...S.dot,background:'#CBD5E1'}}/>}
                </div>
              </button>
            );
          })}
        </div>
        {selDay && <button onClick={() => setSelDay(null)} style={S.clearDay}>✕ Ver todas las tareas</button>}
      </div>

      {/* MOSAIC */}
      {loading && <div style={S.empty}>Cargando tareas...</div>}
      {!loading && visible.length === 0 && (
        <div style={S.empty}>{selDay ? `Sin tareas el ${selDay}.` : 'Sin tareas. Agrega una arriba o desde Telegram.'}</div>
      )}
      <div style={S.mosaic}>
        {visible.map(t => {
          const z = ZONES[t.zona] || ZONES.personal;
          const p = PRIO[t.prioridad] || PRIO.media;
          const ds = t.fecha_hora?.split('T')[0];
          const isOver   = ds && ds < TODAY && t.estado !== 'hecho';
          const isToday2 = ds === TODAY && t.estado !== 'hecho';
          const done     = t.estado === 'hecho';
          const hasRange = t.fecha_fin && t.fecha_fin.split('T')[0] !== ds;
          const isEditing = editingId === t.id;
          const { fecha: fLabel, hora: hLabel } = parseFechaHora(t.fecha_hora);
          const { fecha: fFinLabel } = parseFechaHora(t.fecha_fin);

          return (
            <div key={t.id} style={{ ...S.card, opacity: done?0.45:1, borderTop: `3px solid ${done?'#E2E8F0':z.color}` }}>
              <div style={S.cardHead}>
                <span style={{...S.tag,background:z.bg,color:z.color,border:`1px solid ${z.border}`}}>{z.icon} {z.label}</span>
                <span style={{...S.tag,background:p.bg,color:p.color,border:`1px solid ${p.border}`}}>● {p.label}</span>
                {t.remind_minutes && <span style={{...S.tag,background:'#F5F3FF',color:'#7C3AED',border:'1px solid #C4B5FD'}}>🔔 {t.remind_minutes}min</span>}
              </div>
              <div style={{...S.taskTitle,textDecoration:done?'line-through':'none',color:done?'#94A3B8':'#1E293B'}}>{t.titulo}</div>
              {fLabel && (
                <div style={{...S.dateChip,background:isOver?'#FEF2F2':isToday2?'#FFFBEB':'#F8FAFC',color:isOver?'#DC2626':isToday2?'#D97706':'#475569',border:`1px solid ${isOver?'#FECACA':isToday2?'#FDE68A':'#E2E8F0'}`}}>
                  {isOver?'⚠ ':isToday2?'⏰ ':'📅 '}{fLabel}{hLabel?` · ${hLabel}`:''}{hasRange?` → ${fFinLabel}`:''}
                </div>
              )}
              {t.notas && !isEditing && <div style={S.notes}>{t.notas}</div>}

              {isEditing && (
                <div style={S.editPanel}>
                  <div style={S.editLabel}>Descripción</div>
                  <textarea value={editForm.notas} onChange={e => setEditForm({...editForm,notas:e.target.value})} placeholder="Notas..." style={{...S.editField,minHeight:55,resize:'vertical',marginBottom:8}}/>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <div><div style={S.editLabel}>Fecha inicio</div><input type="date" value={editForm.fecha} onChange={e => setEditForm({...editForm,fecha:e.target.value})} style={S.editField}/></div>
                    <div><div style={S.editLabel}>Hora</div><input type="time" value={editForm.hora} onChange={e => setEditForm({...editForm,hora:e.target.value})} style={S.editField}/></div>
                  </div>
                  <div style={{marginTop:6}}><div style={S.editLabel}>Fecha fin</div><input type="date" value={editForm.fecha_fin} onChange={e => setEditForm({...editForm,fecha_fin:e.target.value})} style={S.editField}/></div>
                  <div style={{marginTop:6}}>
                    <div style={S.editLabel}>🔔 Recordatorio (minutos antes)</div>
                    <select value={remindMin} onChange={e => setRemindMin(e.target.value)} style={S.field}>
                      <option value="">Sin recordatorio</option>
                      <option value="10">10 minutos antes</option>
                      <option value="15">15 minutos antes</option>
                      <option value="30">30 minutos antes</option>
                      <option value="60">1 hora antes</option>
                      <option value="120">2 horas antes</option>
                      <option value="1440">1 día antes</option>
                  </select>
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:8}}>
                    <button onClick={() => handleEditSave(t.id)} style={S.saveEditBtn}>✓ Guardar</button>
                    <button onClick={() => setEditingId(null)} style={S.clearEditBtn}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={S.cardFooter}>
                <select value={t.estado} onChange={e => updateEstado(t.id, e.target.value)} style={S.sel}>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_progreso">En progreso</option>
                  <option value="hecho">✅ Hecho</option>
                </select>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={() => isEditing ? setEditingId(null) : openEdit(t)} style={{...S.iconBtn,color:isEditing?'#7C3AED':'#94A3B8',background:isEditing?'#F5F3FF':'#F8FAFC'}}>✏</button>
                  <button onClick={() => deleteTask(t.id)} style={{...S.iconBtn,color:'#EF4444',background:'#FEF2F2'}}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD MODAL */}
      {showAdd && (
        <div style={S.overlay} onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div style={S.modal}>
            <div style={S.mHead}>
              <span style={S.mTitle}>➕ Nueva tarea</span>
              <button onClick={() => setShowAdd(false)} style={S.mClose}>✕</button>
            </div>
            <div style={S.mBody}>
              <label style={S.label}>Título *</label>
              <input value={form.titulo} onChange={e => setForm({...form,titulo:e.target.value})} placeholder="¿Qué hay que hacer?" style={S.field}/>
              <label style={S.label}>Zona</label>
              <select value={form.zona} onChange={e => setForm({...form,zona:e.target.value})} style={S.field}>
                <option value="electrolineras">⚡ ASFALTECH Energy</option>
                <option value="papa">🏢 Ayudas Familia</option>
                <option value="maestria">🎓 Maestría</option>
                <option value="personal">🌿 Personal</option>
              </select>
              <label style={S.label}>Prioridad</label>
              <select value={form.prioridad} onChange={e => setForm({...form,prioridad:e.target.value})} style={S.field}>
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">⚫ Baja</option>
              </select>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={S.label}>Fecha inicio</label><input type="date" value={form.fecha} onChange={e => setForm({...form,fecha:e.target.value})} style={S.field}/></div>
                <div><label style={S.label}>Hora</label><input type="time" value={form.hora} onChange={e => setForm({...form,hora:e.target.value})} style={S.field}/></div>
              </div>
              <label style={S.label}>Fecha fin <span style={{fontWeight:400,color:'#94A3B8'}}>(opcional)</span></label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm({...form,fecha_fin:e.target.value})} style={S.field}/>
              <label style={S.label}>🔔 Recordatorio</label>
              <select value={form.remind_minutes || ''} onChange={e => {
                const val = e.target.value;
                setForm(prev => ({...prev, remind_minutes: val}));
              }} style={S.field}>
                <option value="">Sin recordatorio</option>
                <option value="10">10 minutos antes</option>
                <option value="15">15 minutos antes</option>
                <option value="30">30 minutos antes</option>
                <option value="60">1 hora antes</option>
                <option value="120">2 horas antes</option>
                <option value="1440">1 día antes</option>
              </select>
              <label style={S.label}>Descripción / Notas</label>
              <textarea value={form.notas} onChange={e => setForm({...form,notas:e.target.value})} placeholder="Detalles, contexto, etc." style={{...S.field,minHeight:70,resize:'vertical'}}/>
              <button onClick={handleAdd} disabled={saving} style={{...S.saveBtn,opacity:saving?0.6:1}}>{saving?'Guardando...':'✓ Guardar tarea'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #F1F5F9; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
  button { cursor: pointer; transition: all 0.15s; }
  button:active { transform: scale(0.97); }
`;

const S = {
  root:{fontFamily:"'Inter',sans-serif",background:'#F1F5F9',minHeight:'100vh',color:'#1E293B',padding:'20px 16px',maxWidth:1000,margin:'0 auto',display:'flex',flexDirection:'column',gap:14},
  notifBanner:{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'},
  notifBtn:{background:'#2563EB',border:'none',borderRadius:8,color:'#fff',padding:'6px 14px',fontSize:12,fontWeight:600,fontFamily:'inherit'},
  notifDismiss:{background:'none',border:'none',color:'#94A3B8',fontSize:16,fontFamily:'inherit'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10},
  logo:{fontSize:20,fontWeight:700,color:'#1E293B',letterSpacing:'-0.02em'},
  sub:{fontSize:11,color:'#94A3B8',marginTop:2,textTransform:'capitalize'},
  hRight:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'},
  chip:{borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:600},
  tgBtn:{background:'#0088CC',borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:600,color:'#fff',textDecoration:'none'},
  addBtn:{background:'#1E293B',border:'none',borderRadius:20,color:'#fff',padding:'6px 16px',fontSize:12,fontWeight:600,fontFamily:'inherit'},
  fb:{borderRadius:10,padding:'10px 14px',fontSize:12,fontWeight:500},
  zoneGrid:{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8},
  zoneCard:{border:'1px solid',borderRadius:14,padding:'12px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:4,transition:'all 0.15s',fontFamily:'inherit'},
  zIcon:{fontSize:20},
  zLabel:{fontSize:9,fontWeight:600,textAlign:'center',lineHeight:1.2},
  zCount:{fontSize:20,fontWeight:700},
  cal:{background:'#FFFFFF',borderRadius:16,padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'},
  calTop:{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'},
  calLabel:{flex:1,textAlign:'center',fontSize:12,fontWeight:600,color:'#475569'},
  nav:{background:'none',border:'1px solid #E2E8F0',borderRadius:8,color:'#64748B',width:26,height:26,padding:0,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'},
  viewToggle:{display:'flex',background:'#F1F5F9',borderRadius:8,padding:2,gap:2},
  viewBtn:{border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,fontFamily:'inherit'},
  calCell:{border:'1px solid',borderRadius:10,padding:'5px 3px',display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'all 0.15s',fontFamily:'inherit'},
  dots:{display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center',minHeight:6},
  dot:{width:5,height:5,borderRadius:'50%'},
  clearDay:{marginTop:10,background:'none',border:'1px solid #E2E8F0',borderRadius:8,color:'#64748B',fontSize:11,padding:'5px 12px',fontFamily:'inherit',width:'100%'},
  empty:{color:'#CBD5E1',fontSize:13,textAlign:'center',padding:'40px 20px'},
  mosaic:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12},
  card:{background:'#FFFFFF',borderRadius:14,padding:'14px',display:'flex',flexDirection:'column',gap:10,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'},
  cardHead:{display:'flex',gap:6,flexWrap:'wrap'},
  tag:{fontSize:10,borderRadius:6,padding:'3px 8px',fontWeight:500,whiteSpace:'nowrap'},
  taskTitle:{fontSize:14,fontWeight:600,lineHeight:1.4},
  dateChip:{fontSize:11,borderRadius:8,padding:'5px 9px',fontWeight:500,display:'inline-flex',alignItems:'center',gap:2,alignSelf:'flex-start'},
  notes:{fontSize:12,color:'#64748B',lineHeight:1.5,background:'#F8FAFC',borderRadius:8,padding:'8px 10px'},
  cardFooter:{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'auto',paddingTop:4},
  sel:{fontSize:11,background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:8,color:'#475569',padding:'5px 8px',fontFamily:'inherit'},
  iconBtn:{border:'none',borderRadius:8,padding:'6px 8px',fontSize:13,fontFamily:'inherit'},
  editPanel:{background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10,padding:'12px'},
  editLabel:{fontSize:10,fontWeight:600,color:'#64748B',marginBottom:4},
  editField:{width:'100%',background:'#FFFFFF',border:'1px solid #E2E8F0',borderRadius:8,padding:'7px 10px',color:'#1E293B',fontSize:12,fontFamily:'inherit',outline:'none'},
  saveEditBtn:{background:'#059669',border:'none',borderRadius:8,color:'#fff',padding:'7px 14px',fontSize:12,fontWeight:600,fontFamily:'inherit'},
  clearEditBtn:{background:'none',border:'1px solid #E2E8F0',borderRadius:8,color:'#94A3B8',padding:'7px 12px',fontSize:12,fontFamily:'inherit'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:100,padding:'16px'},
  modal:{background:'#FFFFFF',borderRadius:20,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'},
  mHead:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid #F1F5F9',position:'sticky',top:0,background:'#FFFFFF',borderRadius:'20px 20px 0 0'},
  mTitle:{fontSize:15,fontWeight:700,color:'#1E293B'},
  mClose:{background:'none',border:'none',color:'#94A3B8',fontSize:18,fontFamily:'inherit'},
  mBody:{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12},
  label:{fontSize:11,fontWeight:600,color:'#64748B'},
  field:{width:'100%',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px',color:'#1E293B',fontSize:13,fontFamily:'inherit',outline:'none'},
  saveBtn:{background:'#1E293B',border:'none',borderRadius:12,color:'#fff',padding:'13px',fontSize:14,fontWeight:600,fontFamily:'inherit',width:'100%',marginTop:4},
};
