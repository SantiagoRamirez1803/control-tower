import { useState, useEffect, useCallback } from 'react';

const ZONES = {
  all:           { label: 'Todo',          icon: '📋', color: '#64748B' },
  electrolineras:{ label: 'Electrolineras',icon: '⚡', color: '#10B981' },
  papa:          { label: 'Empresa Papá',  icon: '🏢', color: '#38BDF8' },
  maestria:      { label: 'Maestría',      icon: '🎓', color: '#C084FC' },
  personal:      { label: 'Personal',      icon: '🌿', color: '#FB923C' },
};

function getWeekDays() {
  const today = new Date();
  const dow = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
  });
}

const DAY = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const fmt = d => d.toISOString().split('T')[0];

export default function Dashboard() {
  const [tasks,     setTasks]    = useState([]);
  const [zone,      setZone]     = useState('all');
  const [selDay,    setSelDay]   = useState(null);
  const [loading,   setLoading]  = useState(true);
  const week = getWeekDays();
  const today = fmt(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const url = zone === 'all' ? '/api/tareas' : `/api/tareas?zona=${zone}`;
    const res = await fetch(url);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [zone]);

  useEffect(() => { load(); }, [load]);

  const updateEstado = async (id, estado) => {
    await fetch('/api/tareas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }) });
    load();
  };

  const deleteTask = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await fetch('/api/tareas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  const visible = tasks
    .filter(t => !selDay || (t.fecha_hora && t.fecha_hora.startsWith(selDay)))
    .sort((a, b) => {
      if (a.estado === 'hecho' && b.estado !== 'hecho') return 1;
      if (a.estado !== 'hecho' && b.estado === 'hecho') return -1;
      const po = { alta: 0, media: 1, baja: 2 };
      return (po[a.prioridad] || 1) - (po[b.prioridad] || 1);
    });

  const pending = tasks.filter(t => t.estado !== 'hecho');
  const overdue = pending.filter(t => t.fecha_hora && t.fecha_hora.split('T')[0] < today);

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>⚡ CONTROL TOWER</div>
          <div style={S.sub}>{new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</div>
        </div>
        <div style={S.hRight}>
          {overdue.length > 0 && <span style={{...S.badge,color:'#EF4444',background:'rgba(239,68,68,0.1)'}}>⚠ {overdue.length} vencidas</span>}
          <span style={{...S.badge,color:'#475569',background:'rgba(255,255,255,0.05)'}}>{pending.length} pendientes</span>
          <a href="https://t.me/controltower_pipe_bot" target="_blank" style={S.tgBtn}>✈ Bot</a>
        </div>
      </div>

      {/* WEEKLY CALENDAR */}
      <div style={S.cal}>
        <div style={S.calGrid}>
          {week.map((day, i) => {
            const ds = fmt(day);
            const isToday = ds === today;
            const isSel = selDay === ds;
            const cnt = tasks.filter(t => t.fecha_hora?.startsWith(ds) && t.estado !== 'hecho').length;
            return (
              <button key={ds} onClick={() => setSelDay(isSel ? null : ds)} style={{
                ...S.calCell,
                background: isSel ? 'rgba(16,185,129,0.18)' : isToday ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                borderColor: isSel ? '#10B981' : isToday ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              }}>
                <span style={{fontSize:9,color:isToday?'#10B981':'#334155',fontWeight:700}}>{DAY[i]}</span>
                <span style={{fontSize:15,fontWeight:700,color:isSel?'#10B981':isToday?'#F1F5F9':'#64748B'}}>{day.getDate()}</span>
                {cnt > 0 && <span style={{fontSize:9,background:'#10B981',color:'#fff',borderRadius:10,padding:'0 4px',fontWeight:700}}>{cnt}</span>}
              </button>
            );
          })}
        </div>
        {selDay && <button onClick={() => setSelDay(null)} style={S.clearDay}>✕ Ver todo</button>}
      </div>

      {/* ZONES */}
      <div style={S.zones}>
        {Object.entries(ZONES).map(([key, z]) => {
          const cnt = key === 'all'
            ? pending.length
            : tasks.filter(t => t.zona === key && t.estado !== 'hecho').length;
          const on = zone === key;
          return (
            <button key={key} onClick={() => setZone(key)} style={{
              ...S.zBtn,
              borderColor: on ? z.color : 'rgba(255,255,255,0.07)',
              color: on ? z.color : '#475569',
              background: on ? `${z.color}18` : 'rgba(255,255,255,0.02)',
            }}>
              {z.icon} {z.label}
              {cnt > 0 && <span style={{...S.cnt,background:z.color}}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* TASK LIST */}
      <div style={S.list}>
        {loading && <div style={S.empty}>Cargando...</div>}
        {!loading && visible.length === 0 && (
          <div style={S.empty}>
            {selDay ? `Sin tareas el ${selDay}.` : 'Sin tareas. Escríbele al bot en Telegram.'}
          </div>
        )}
        {visible.map(t => {
          const z = ZONES[t.zona] || ZONES.personal;
          const ds = t.fecha_hora?.split('T')[0];
          const isOver = ds && ds < today && t.estado !== 'hecho';
          const isToday2 = ds === today && t.estado !== 'hecho';
          const done = t.estado === 'hecho';
          return (
            <div key={t.id} className="tc" style={{
              ...S.card,
              borderLeftColor: done ? '#1E293B' : z.color,
              opacity: done ? 0.4 : 1,
            }}>
              <div style={{flex:1}}>
                {t.fecha_hora && (
                  <div style={{fontSize:10,color:isOver?'#EF4444':isToday2?'#FBBF24':'#10B981',fontFamily:'monospace',marginBottom:3,fontWeight:600}}>
                    {isOver?'⚠ ':isToday2?'⏰ ':'📅 '}
                    {new Date(t.fecha_hora).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                )}
                <div style={{fontSize:13,fontWeight:500,color:done?'#475569':'#E2E8F0',textDecoration:done?'line-through':'none',marginBottom:5}}>
                  {t.titulo}
                </div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:`${z.color}18`,color:z.color,border:`1px solid ${z.color}30`}}>
                    {z.icon} {z.label}
                  </span>
                  <span style={{fontSize:10,padding:'2px 6px',color:{alta:'#EF4444',media:'#FBBF24',baja:'#475569'}[t.prioridad]}}>
                    ● {t.prioridad}
                  </span>
                  <select value={t.estado} onChange={e => updateEstado(t.id, e.target.value)} style={S.sel}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="hecho">✅ Hecho</option>
                  </select>
                </div>
                {t.notas && <div style={{marginTop:4,fontSize:11,color:'#334155'}}>{t.notas}</div>}
              </div>
              <button className="db" onClick={() => deleteTask(t.id)} style={S.del}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #06090F; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  select option { background: #0D1320; color: #CBD5E1; }
  .tc:hover .db { opacity: 1 !important; }
  button { transition: filter 0.15s; }
  button:active { filter: brightness(0.85); }
`;

const S = {
  root:{fontFamily:"'Space Grotesk',sans-serif",background:'#06090F',minHeight:'100vh',color:'#CBD5E1',padding:'18px 16px',maxWidth:640,margin:'0 auto',display:'flex',flexDirection:'column',gap:12},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.06)',flexWrap:'wrap',gap:8},
  logo:{fontFamily:'monospace',fontSize:14,fontWeight:700,letterSpacing:'0.1em',color:'#F1F5F9'},
  sub:{fontSize:10,color:'#334155',marginTop:3,textTransform:'capitalize'},
  hRight:{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'},
  badge:{borderRadius:20,padding:'3px 9px',fontSize:10,fontWeight:600},
  tgBtn:{background:'linear-gradient(135deg,#229ED9,#1A7FB5)',borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700,color:'#fff',textDecoration:'none'},
  cal:{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'10px'},
  calGrid:{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3},
  calCell:{border:'1px solid',borderRadius:10,padding:'5px 2px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,minHeight:54},
  clearDay:{marginTop:8,background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#475569',fontSize:11,cursor:'pointer',padding:'4px 10px',fontFamily:'inherit'},
  zones:{display:'flex',gap:6,flexWrap:'wrap'},
  zBtn:{border:'1px solid',borderRadius:20,padding:'4px 10px',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontFamily:'inherit',fontWeight:500},
  cnt:{borderRadius:10,padding:'0 5px',fontSize:9,color:'#fff',fontWeight:700},
  list:{display:'flex',flexDirection:'column',gap:5},
  empty:{color:'#1E293B',fontSize:12,textAlign:'center',padding:'44px 16px',lineHeight:1.7},
  card:{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.05)',borderLeft:'3px solid',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'flex-start',gap:10},
  sel:{fontSize:10,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:4,color:'#94A3B8',padding:'2px 4px',cursor:'pointer',fontFamily:'inherit'},
  del:{background:'none',border:'none',color:'#EF4444',fontSize:12,cursor:'pointer',opacity:0,padding:'2px 4px',flexShrink:0,transition:'opacity 0.15s'},
};
