/* -------- VISTAS: lista / día -------- */
let vista='lista';
let calSel=dayKey(new Date());

function setVista(v){
  vista=v;
  $('#tabLista').classList.toggle('on',v==='lista');
  $('#tabCal').classList.toggle('on',v==='dia');
  $('#main').classList.toggle('hidden',v!=='lista');
  $('#calView').classList.toggle('hidden',v!=='dia');
  if(v==='dia'){irDiaConCitas();renderDia();}else render();
}

function irDiaConCitas(){
  const map=citasPorDia();
  const claves=Object.keys(map);
  if(!claves.length)return;
  if(map[calSel])return;
  const hoy=new Date();
  const fechas=claves.map(k=>new Date(k+'T12:00:00')).sort((a,b)=>Math.abs(a-hoy)-Math.abs(b-hoy));
  calSel=dayKey(fechas[0]);
}

function citasPorDia(){
  const map={};
  DATA.filter(d=>{
    if(!d.fecha)return false;
    if(F.persona.size && ![...F.persona].some(p=>(d.persona||'').includes(p)))return false;
    if(F.objetivo.size && !F.objetivo.has(d.objetivo))return false;
    if(F.franja.size){const h=new Date(d.fecha).getHours();
      if(![...F.franja].some(k=>h>=FRANJAS[k].min && h<FRANJAS[k].max))return false;}
    if(F.texto){const blob=(d.evento+' '+d.contacto+' '+d.ubicacion+' '+d.persona+' '+d.objetivo).toLowerCase();
      if(!blob.includes(F.texto))return false;}
    return true;
  }).forEach(d=>{const k=dayKey(d.fecha);(map[k]=map[k]||[]).push(d);});
  return map;
}

function calDia(delta){const d=new Date(calSel+'T12:00:00');d.setDate(d.getDate()+delta);calSel=dayKey(d);renderDia();}
function irHoy(){calSel=dayKey(new Date());renderDia();}
function selDia(k){calSel=k;renderDia();}

const HORA_INI=7, HORA_FIN=21, PX_HORA=58;

function renderDia(){
  const cont=$('#calView');
  const map=citasPorDia();
  const citas=(map[calSel]||[]).slice().sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  $('#subCount').innerHTML=`<b>${citas.length}</b> cita${citas.length!==1?'s':''}`;

  const dObj=new Date(calSel+'T12:00:00');
  const esHoy=calSel===dayKey(new Date());
  const titulo=dObj.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});

  let html=`<div class="day-bar">
    <button class="day-arrow" onclick="calDia(-1)">‹</button>
    <div class="day-bar-center">
      <div class="day-bar-title ${esHoy?'is-today':''}">${esHoy?'Hoy':titulo}</div>
      ${esHoy?`<div class="day-bar-sub">${titulo}</div>`:''}
    </div>
    <button class="day-arrow" onclick="calDia(1)">›</button>
  </div>
  <div class="day-actions">
    <button class="day-hoy" onclick="irHoy()">Hoy</button>
    <button class="day-add" onclick="abrirModal('${calSel}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Agregar cita</button>
  </div>`;

  const eventos=citas.map(c=>{
    const dt=new Date(c.fecha);
    const min=dt.getHours()*60+dt.getMinutes();
    return {c,min};
  });
  const colsDe={};
  eventos.forEach(ev=>{const slot=Math.floor((ev.min-HORA_INI*60)/30);colsDe[slot]=(colsDe[slot]||0)+1;});

  html+=`<div class="tl" style="height:${(HORA_FIN-HORA_INI+1)*PX_HORA}px">`;
  for(let h=HORA_INI;h<=HORA_FIN;h++){
    const top=(h-HORA_INI)*PX_HORA;
    html+=`<div class="tl-row" style="top:${top}px">
      <span class="tl-hora">${String(h).padStart(2,'0')}:00</span>
      <div class="tl-line"></div>
    </div>`;
  }
  if(esHoy){
    const now=new Date();const nmin=now.getHours()*60+now.getMinutes();
    if(nmin>=HORA_INI*60 && nmin<=HORA_FIN*60+59){
      const top=((nmin-HORA_INI*60)/60)*PX_HORA;
      html+=`<div class="tl-now" style="top:${top}px"><span class="tl-now-dot"></span></div>`;
    }
  }
  const usados={};
  eventos.forEach(ev=>{
    let min=ev.min;
    const topRaw=((min-HORA_INI*60)/60)*PX_HORA;
    const top=Math.max(0,topRaw);
    const slot=Math.floor((min-HORA_INI*60)/30);
    const totalCol=colsDe[slot]||1;
    const idx=(usados[slot]=(usados[slot]||0));usados[slot]++;
    const wPct=100/totalCol;
    const t=OBJ_MAP[ev.c.objetivo]||'otro';
    const fueraRango=(min<HORA_INI*60||min>HORA_FIN*60+59);
    html+=`<div class="tl-ev ${t}" style="top:${top}px;left:calc(54px + ${idx*wPct}%);width:calc(${wPct}% - ${idx===0&&totalCol===1?'12':'6'}px)" onclick="abrirDetalle('${ev.c.id}')">
      <div class="tl-ev-h">${fmtTime(ev.c.fecha)}${fueraRango?' ⚠':''}</div>
      <div class="tl-ev-t">${esc(ev.c.contacto||ev.c.evento||'(sin título)')}</div>
      ${ev.c.objetivo?`<div class="tl-ev-o">${esc(ev.c.objetivo)}</div>`:''}
    </div>`;
  });
  html+='</div>';

  if(!citas.length){
    html+='<div class="cal-empty-day">Sin citas este día</div>';
  }
  cont.innerHTML=html;
}

/* -------- MODAL DETALLE DE CITA -------- */
function abrirDetalle(id){
  const d=DATA.find(x=>String(x.id)===String(id));if(!d)return;
  const tel=(d.telefono||'').replace(/\D/g,'');
  const waLink=tel?`https://wa.me/${tel.length<=10?'54'+tel:tel}`:'';
  const mLink=mapURL(d);
  const cls=OBJ_MAP[d.objetivo]||'otro';
  const fechaTxt=new Date(d.fecha).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  const pers=(d.persona||'').split(',').map(p=>p.trim()).filter(Boolean);
  let html=`<div class="dt-head t-${cls}">
      <div class="dt-time">${fmtTime(d.fecha)}</div>
      <div class="dt-fecha">${fechaTxt}</div>
      ${d.objetivo?`<span class="c-tag ${cls}">${esc(d.objetivo)}</span>`:''}
    </div>
    <div class="dt-title">${esc(d.evento)||'(sin título)'}</div>
    <div class="dt-rows">
      ${d.contacto?`<div class="dt-row">${iconUser()}<div><span class="dt-lbl">Contacto</span><b>${esc(d.contacto)}</b></div></div>`:''}
      ${d.telefono?`<div class="dt-row">${iconWa()}<div><span class="dt-lbl">Teléfono</span><b>${esc(d.telefono)}</b></div></div>`:''}
      ${d.ubicacion?`<div class="dt-row">${iconLoc()}<div><span class="dt-lbl">Ubicación</span><b>${esc(d.ubicacion)}</b></div></div>`:''}
      ${pers.length?`<div class="dt-row">${iconUser()}<div><span class="dt-lbl">Atiende</span><b>${pers.map(esc).join(', ')}</b></div></div>`:''}
      ${d.estado?`<div class="dt-row">${iconClock()}<div><span class="dt-lbl">Estado</span><b>${esc(d.estado)}</b></div></div>`:''}
      ${d.creacion_iso?`<div class="dt-row">${iconClock()}<div><span class="dt-lbl">Creado</span><b>${d.creado_por?esc(d.creado_por)+' · ':''}${fmtCrea(d.creacion_iso)}</b></div></div>`:''}
    </div>
    <div class="dt-actions">
      <a class="act wa ${waLink?'':'disabled'}" ${waLink?`href="${waLink}" target="_blank" rel="noopener"`:''}>${iconWa()}WhatsApp</a>
      <a class="act map ${mLink?'':'disabled'}" ${mLink?`href="${mLink}" target="_blank" rel="noopener"`:''}>${iconMap()}Mapa</a>
    </div>
    <button class="dt-close" onclick="cerrarDetalle()">Cerrar</button>`;
  $('#detalleInner').innerHTML=html;
  $('#detalleBg').classList.add('show');
}
function cerrarDetalle(){$('#detalleBg').classList.remove('show');}
function iconClock(){return'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';}
