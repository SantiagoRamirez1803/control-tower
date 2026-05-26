import { useState, useEffect, useCallback } from 'react';

const ZONE_COLOR = '#059669';
const ZONE_BG    = '#ECFDF5';
const ZONE_BORDER= '#6EE7B7';
const PRIO_COLOR = { alta: '#EF4444', media: '#F59E0B', baja: '#94A3B8' };
const DAY_NAMES  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MONTH_NAMES= ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = d => d.toISOString().split('T')[0];

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

const EMPTY_FORM = { titulo: '', prioridad: 'media', fecha: '', hora: '', fecha_fin: '', notas: '' };

export default function AsfaltechDashboard() {
  const [auth,      setAuth]      = useState(false);
  const [pwInput,   setPwInput]   = useState('');
  const [pwError,   setPwError]   = useState(false);
  const [tasks,     setTasks]     = useState([]);
  const [selDay,    setSelDay]    = useState(null);
  const [calView,   setCalView]   = useState('week');
  const [calRef,    setCalRef]    = useState(new Date());
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [fb,        setFb]        = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm,  setEditForm]  = useState({ fecha: '', hora: '', fecha_fin: '' });

  const TODAY = fmt(new Date());

  const checkAuth = () => {
    if (pwInput === process.env.NEXT_PUBLIC_ASFALTECH_PASSWORD || pwInput === 'PRI123') {
      setAuth(true); setPwError(false);
      if (typeof window !== 'undefined') sessionStorage.setItem('asfaltech_auth', '1');
    } else {
      setPwError(true);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('asfaltech_auth')) setAuth(true);
  }, []);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    const res = await fetch('/api/tareas?zona=electrolineras');
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [auth]);

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
      body: JSON.stringify({ titulo: form.titulo, zona: 'electrolineras', prioridad: form.prioridad, fecha_hora, fecha_fin, notas: form.notas || null })
    });
    if (res.ok) { flash('ok', 'Tarea agregada.'); setForm(EMPTY_FORM); setShowAdd(false); load(); }
    else flash('err', 'Error al guardar.');
    setSaving(false);
  };

  const openEdit = (task) => {
    setEditingId(task.id);
    setEditForm({
      fecha:     task.fecha_hora ? task.fecha_hora.split('T')[0] : '',
      hora:      task.fecha_hora && task.fecha_hora.split('T')[1] !== '00:00:00' ? task.fecha_hora.split('T')[1]?.slice(0,5) : '',
      fecha_fin: task.fecha_fin  ? task.fecha_fin.split('T')[0]  : '',
    });
  };

  const handleEditSave = async (id) => {
    const { fecha, hora, fecha_fin } = editForm;
    const fecha_hora = fecha ? (hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`) : null;
    await fetch('/api/tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fecha_hora, fecha_fin: fecha_fin ? `${fecha_fin}T00:00:00` : null })
    });
    setEditingId(null); load(); flash('ok', 'Fecha actualizada.');
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

  const pending = tasks.filter(t => t.estado !== 'hecho');
  const overdue = pending.filter(t => t.fecha_hora && t.fecha_hora.split('T')[0] < TODAY);
  const calDays = calView === 'week' ? getWeekDays(calRef) : getMonthDays(calRef.getFullYear(), calRef.getMonth());

  const navCal = dir => {
    const d = new Date(calRef);
    calView === 'week' ? d.setDate(d.getDate() + dir * 7) : d.setMonth(d.getMonth() + dir);
    setCalRef(d);
  };

  const calLabel = calView === 'week'
    ? (() => { const w = getWeekDays(calRef); return `${w[0].getDate()} – ${w[6].getDate()} ${MONTH_NAMES[w[6].getMonth()]} ${w[6].getFullYear()}`; })()
    : `${MONTH_NAMES[calRef.getMonth()]} ${calRef.getFullYear()}`;

  const visible = tasks
    .filter(t => !selDay || taskCoversDay(t, selDay))
    .sort((a, b) => {
      if (a.estado === 'hecho' && b.estado !== 'hecho') return 1;
      if (a.estado !== 'hecho' && b.estado === 'hecho') return -1;
      if (a.fecha_hora && b.fecha_hora) return a.fecha_hora.localeCompare(b.fecha_hora);
      if (a.fecha_hora) return -1; if (b.fecha_hora) return 1;
      return ({ alta: 0, media: 1, baja: 2 }[a.prioridad] || 1) - ({ alta: 0, media: 1, baja: 2 }[b.prioridad] || 1);
    });

  // LOGIN SCREEN
  if (!auth) return (
    <div style={S.loginRoot}>
      <style>{CSS}</style>
      <div style={S.loginBox}>
        <div style={S.loginLogo}>⚡</div>
        <div style={S.loginTitle}>ASFALTECH Energy</div>
        <div style={S.loginSub}>Panel de tareas y pendientes</div>
        <input
          type="password"
          placeholder="Contraseña de acceso"
          value={pwInput}
          onChange={e => setPwInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkAuth()}
          style={{...S.field, marginTop: 20, textAlign: 'center'}}
        />
        {pwError && <div style={{color:'#DC2626',fontSize:12,marginTop:6}}>Contraseña incorrecta.</div>}
        <button onClick={checkAuth} style={{...S.saveBtn, marginTop: 12}}>Entrar</button>
        <div style={{marginTop:16,fontSize:11,color:'#94A3B8'}}>
          También puedes agregar tareas desde <a href="https://t.me/ASFALTECH_Energy_bot" target="_blank" style={{color:ZONE_COLOR}}>@ASFALTECH_Energy_bot</a>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>⚡ ASFALTECH Energy</div>
          <div style={S.sub}>{new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div style={S.hRight}>
          {overdue.length > 0 && <span style={{...S.chip,background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA'}}>⚠ {overdue.length} vencidas</span>}
          <span style={{...S.chip,background:ZONE_BG,color:ZONE_COLOR,border:`1px solid ${ZONE_BORDER}`}}>{pending.length} pendientes</span>
          <a href="https://t.me/ASFALTECH_Energy_bot" target="_blank" style={S.tgBtn}>✈ Bot</a>
          <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Nueva tarea</button>
        </div>
      </div>

      {fb && <div style={{...S.fb,background:fb.type==='ok'?'#ECFDF5':'#FEF2F2',color:fb.type==='ok'?'#065F46':'#DC2626',border:`1px solid ${fb.type==='ok'?'#6EE7B7':'#FECACA'}`}}>{fb.type==='ok'?'✓ ':'✕ '}{fb.msg}</div>}

      {/* CALENDAR */}
      <div style={S.cal}>
        <div style={S.calTop}>
          <button style={S.nav} onClick={() => navCal(-1)}>‹</button>
          <span style={S.calLabel}>{calLabel}</span>
          <button style={S.nav} onClick={() => navCal(1)}>›</button>
          {fmt(calRef) !== TODAY && <button style={{...S.nav,color:ZONE_COLOR,borderColor:ZONE_BORDER}} onClick={() => { setCalRef(new Date()); setSelDay(null); }}>Hoy</button>}
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
            const cnt = tasks.filter(t => taskCoversDay(t, ds) && t.estado !== 'hecho').length;
            return (
              <button key={ds} onClick={() => setSelDay(isSel ? null : ds)} style={{
                ...S.calCell,
                minHeight: calView === 'month' ? 52 : 62,
                background: isSel ? ZONE_BG : isToday ? '#F0FDF4' : '#FFFFFF',
                borderColor: isSel ? ZONE_COLOR : isToday ? ZONE_BORDER : '#E2E8F0',
                opacity: isOther ? 0.35 : 1,
              }}>
                {calView === 'week' && <span style={{fontSize:9,fontWeight:700,color:isToday?ZONE_COLOR:'#94A3B8'}}>{DAY_NAMES[i]}</span>}
                <span style={{fontSize:calView==='month'?13:15,fontWeight:700,color:isSel?ZONE_COLOR:isToday?'#065F46':'#334155'}}>{day.getDate()}</span>
                {cnt > 0 && <div style={{...S.dot,background:ZONE_COLOR}}/>}
              </button>
            );
          })}
        </div>
        {selDay && <button onClick={() => setSelDay(null)} style={S.clearDay}>✕ Ver todas las tareas</button>}
      </div>

      {/* TASK LIST */}
      <div style={S.list}>
        {loading && <div style={S.empty}>Cargando...</div>}
        {!loading && visible.length === 0 && <div style={S.empty}>{selDay ? `Sin tareas el ${selDay}.` : 'Sin tareas. Agrega una arriba o desde el bot.'}</div>}
        {visible.map(t => {
          const ds = t.fecha_hora?.split('T')[0];
          const isOver = ds && ds < TODAY && t.estado !== 'hecho';
          const isToday2 = ds === TODAY && t.estado !== 'hecho';
          const done = t.estado === 'hecho';
          const hasRange = t.fecha_fin && t.fecha_fin !== t.fecha_hora;
          const isEditing = editingId === t.id;
          return (
            <div key={t.id} className="tc" style={{...S.card, borderLeftColor: done?'#E2E8F0':ZONE_COLOR, opacity: done?0.5:1}}>
              <div style={{flex:1}}>
                <div style={S.cardTop}>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                    <span style={{...S.tag,background:ZONE_BG,color:ZONE_COLOR,border:`1px solid ${ZONE_BORDER}`}}>⚡ ASFALTECH</span>
                    <span style={{...S.tag,color:PRIO_COLOR[t.prioridad]}}>● {t.prioridad}</span>
                    {t.fecha_hora && (
                      <span style={{...S.tag,background:isOver?'#FEF2F2':isToday2?'#FFFBEB':'#F8FAFC',color:isOver?'#DC2626':isToday2?'#D97706':'#64748B',border:`1px solid ${isOver?'#FECACA':isToday2?'#FDE68A':'#E2E8F0'}`}}>
                        {isOver?'⚠ ':isToday2?'⏰ ':'📅 '}
                        {new Date(t.fecha_hora).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}
                        {t.fecha_hora.split('T')[1] !== '00:00:00' && ` ${new Date(t.fecha_hora).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}`}
                        {hasRange && ` → ${new Date(t.fecha_fin).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}`}
                      </span>
                    )}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <button onClick={() => isEditing ? setEditingId(null) : openEdit(t)} style={{...S.editBtn,color:isEditing?'#7C3AED':'#94A3B8',background:isEditing?'#F5F3FF':'transparent',border:isEditing?'1px solid #C4B5FD':'1px solid #E2E8F0'}}>✏ {isEditing?'Cerrar':'Editar'}</button>
                    <select value={t.estado} onChange={e => updateEstado(t.id, e.target.value)} style={S.sel}>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="hecho">✅ Hecho</option>
                    </select>
                  </div>
                </div>
                <div style={{...S.taskTitle,textDecoration:done?'line-through':'none',color:done?'#94A3B8':'#1E293B'}}>{t.titulo}</div>
                {t.notas && <div style={S.notes}>{t.notas}</div>}
                {isEditing && (
                  <div style={S.editPanel}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                      <div><div style={S.editLabel}>Fecha inicio</div><input type="date" value={editForm.fecha} onChange={e => setEditForm({...editForm,fecha:e.target.value})} style={S.editField}/></div>
                      <div><div style={S.editLabel}>Hora</div><input type="time" value={editForm.hora} onChange={e => setEditForm({...editForm,hora:e.target.value})} style={S.editField}/></div>
                      <div><div style={S.editLabel}>Fecha fin</div><input type="date" value={editForm.fecha_fin} onChange={e => setEditForm({...editForm,fecha_fin:e.target.value})} style={S.editField}/></div>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={() => handleEditSave(t.id)} style={S.saveEditBtn}>✓ Guardar</button>
                      <button onClick={() => setEditForm({...editForm,fecha:'',hora:'',fecha_fin:''})} style={S.clearEditBtn}>✕ Limpiar</button>
                    </div>
                  </div>
                )}
              </div>
              <button className="db" onClick={() => deleteTask(t.id)} style={S.del}>🗑</button>
            </div>
          );
        })}
      </div>

      {/* ADD MODAL */}
      {showAdd && (
        <div style={S.overlay} onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div style={S.modal}>
            <div style={S.mHead}>
              <span style={S.mTitle}>⚡ Nueva tarea ASFALTECH</span>
              <button onClick={() => setShowAdd(false)} style={S.mClose}>✕</button>
            </div>
            <div style={S.mBody}>
              <label style={S.label}>Título *</label>
              <input value={form.titulo} onChange={e => setForm({...form,titulo:e.target.value})} placeholder="¿Qué hay que hacer?" style={S.field}/>
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
              <label style={S.label}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm({...form,notas:e.target.value})} placeholder="Detalles, contexto..." style={{...S.field,minHeight:70,resize:'vertical'}}/>
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
  .tc:hover .db { opacity: 1 !important; }
  button { cursor: pointer; transition: all 0.15s; }
  button:active { transform: scale(0.97); }
`;

const S = {
  loginRoot:{fontFamily:"'Inter',sans-serif",background:'#F1F5F9',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'},
  loginBox:{background:'#fff',borderRadius:20,padding:'40px 32px',maxWidth:360,width:'100%',textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,0.08)'},
  loginLogo:{fontSize:48,marginBottom:8},
  loginTitle:{fontSize:22,fontWeight:700,color:'#1E293B'},
  loginSub:{fontSize:13,color:'#94A3B8',marginTop:4},
  root:{fontFamily:"'Inter',sans-serif",background:'#F1F5F9',minHeight:'100vh',color:'#1E293B',padding:'20px 16px',maxWidth:700,margin:'0 auto',display:'flex',flexDirection:'column',gap:14},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10},
  logo:{fontSize:20,fontWeight:700,color:'#1E293B'},
  sub:{fontSize:11,color:'#94A3B8',marginTop:2,textTransform:'capitalize'},
  hRight:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'},
  chip:{borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:600},
  tgBtn:{background:'#0088CC',borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:600,color:'#fff',textDecoration:'none'},
  addBtn:{background:'#059669',border:'none',borderRadius:20,color:'#fff',padding:'6px 16px',fontSize:12,fontWeight:600,fontFamily:'inherit'},
  fb:{borderRadius:10,padding:'10px 14px',fontSize:12,fontWeight:500},
  cal:{background:'#FFFFFF',borderRadius:16,padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'},
  calTop:{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'},
  calLabel:{flex:1,textAlign:'center',fontSize:12,fontWeight:600,color:'#475569'},
  nav:{background:'none',border:'1px solid #E2E8F0',borderRadius:8,color:'#64748B',width:26,height:26,padding:0,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'},
  viewToggle:{display:'flex',background:'#F1F5F9',borderRadius:8,padding:2,gap:2},
  viewBtn:{border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,fontFamily:'inherit'},
  calCell:{border:'1px solid',borderRadius:10,padding:'5px 3px',display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'all 0.15s',fontFamily:'inherit'},
  dot:{width:6,height:6,borderRadius:'50%',marginTop:2},
  clearDay:{marginTop:10,background:'none',border:'1px solid #E2E8F0',borderRadius:8,color:'#64748B',fontSize:11,padding:'5px 12px',fontFamily:'inherit',width:'100%'},
  list:{display:'flex',flexDirection:'column',gap:8},
  empty:{color:'#CBD5E1',fontSize:13,textAlign:'center',padding:'40px 20px'},
  card:{background:'#FFFFFF',border:'1px solid #F1F5F9',borderLeft:'4px solid',borderRadius:12,padding:'14px',display:'flex',alignItems:'flex-start',gap:12,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'},
  cardTop:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:8,flexWrap:'wrap'},
  tag:{fontSize:10,borderRadius:6,padding:'3px 8px',fontWeight:500,whiteSpace:'nowrap'},
  taskTitle:{fontSize:14,fontWeight:600,lineHeight:1.4,marginBottom:6},
  notes:{fontSize:12,color:'#64748B',lineHeight:1.5,background:'#F8FAFC',borderRadius:6,padding:'6px 10px'},
  sel:{fontSize:11,background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:8,color:'#475569',padding:'4px 6px',fontFamily:'inherit'},
  editBtn:{fontSize:10,borderRadius:8,padding:'4px 8px',fontWeight:500,fontFamily:'inherit'},
  editPanel:{marginTop:10,background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10,padding:'12px'},
  editLabel:{fontSize:10,fontWeight:600,color:'#64748B',marginBottom:4},
  editField:{width:'100%',background:'#FFFFFF',border:'1px solid #E2E8F0',borderRadius:8,padding:'7px 10px',color:'#1E293B',fontSize:12,fontFamily:'inherit',outline:'none'},
  saveEditBtn:{background:'#059669',border:'none',borderRadius:8,color:'#fff',padding:'7px 14px',fontSize:12,fontWeight:600,fontFamily:'inherit'},
  clearEditBtn:{background:'none',border:'1px solid #E2E8F0',borderRadius:8,color:'#94A3B8',padding:'7px 12px',fontSize:12,fontFamily:'inherit'},
  del:{background:'none',border:'none',fontSize:14,opacity:0,padding:'2px 4px',flexShrink:0,transition:'opacity 0.15s'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:100,padding:'16px'},
  modal:{background:'#FFFFFF',borderRadius:20,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'},
  mHead:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid #F1F5F9',position:'sticky',top:0,background:'#FFFFFF',borderRadius:'20px 20px 0 0'},
  mTitle:{fontSize:15,fontWeight:700,color:'#1E293B'},
  mClose:{background:'none',border:'none',color:'#94A3B8',fontSize:18,fontFamily:'inherit'},
  mBody:{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12},
  label:{fontSize:11,fontWeight:600,color:'#64748B'},
  field:{width:'100%',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:10,padding:'10px 12px',color:'#1E293B',fontSize:13,fontFamily:'inherit',outline:'none'},
  saveBtn:{background:'#059669',border:'none',borderRadius:12,color:'#fff',padding:'13px',fontSize:14,fontWeight:600,fontFamily:'inherit',width:'100%',marginTop:4},
};
