const WEBHOOK_URL = "https://hook.us1.make.com/q67odesdv4mkrftpc7kwjdlfmku6wjem";
const API_TOKEN   = "TestFavre-0506";
const WEBHOOK_CREAR = ""; // <--- configurá el webhook de creación
const WEBHOOK_EDITAR = ""; // <--- URL del webhook de Make para EDITAR citas (lo conectás después)

const OBJ_MAP={'Reunion':'reunion','Venta':'venta','Alquilar':'alquilar','Tasacion':'tasacion','Turno':'turno'};
const FRANJAS={'manana':{label:'Mañana · 7 a 12',min:7,max:12},'mediodia':{label:'Mediodía · 12 a 15',min:12,max:15},'tarde':{label:'Tarde · 15 en adelante',min:15,max:24}};

const DEMO = [];

let DATA=[];
let CONTACTOS=[]; 
let F={persona:new Set(),objetivo:new Set(),franja:new Set(),dia:'',texto:'',orden:'fecha-asc'};
let panelAbierto=null;

const $=s=>document.querySelector(s);
function toast(msg,err){const t=$('#toast');if(!t)return;t.textContent=msg;t.className='toast show'+(err?' err':'');setTimeout(()=>t.className='toast',2800);}

function fmtTime(iso){const d=new Date(iso);if(isNaN(d))return'--';return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
function dayKey(iso){const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dayLabel(iso){const d=new Date(iso);const hoy=new Date();const ma=new Date();ma.setDate(hoy.getDate()+1);
  if(dayKey(iso)===dayKey(hoy))return'Hoy';if(dayKey(iso)===dayKey(ma))return'Mañana';
  return d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});}
function isToday(iso){return dayKey(iso)===dayKey(new Date());}
function fmtCrea(iso){if(!iso)return'';const d=new Date(iso);if(isNaN(d))return'';return d.toLocaleDateString('es-AR',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});}

function personas(){const s=new Set();DATA.forEach(d=>(d.persona||'').split(',').forEach(p=>{p=p.trim();if(p)s.add(p);}));return[...s].sort();}
function objetivos(){const s=new Set();DATA.forEach(d=>{if(d.objetivo)s.add(d.objetivo);});return[...s].sort();}

function mapURL(d){
  if(d.lat&&d.lng) return 'https://www.google.com/maps/search/?api=1&query=' + d.lat + ',' + d.lng;
  return d.ubicacion?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(d.ubicacion):'';
}

/* -------- PANEL DE FILTROS -------- */
function togglePanel(tipo){
  if(panelAbierto===tipo){cerrarPanel();return;}
  panelAbierto=tipo;
  document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('open'));
  $('#tg'+cap(tipo)).classList.add('open');
  $('#panel').classList.add('open');
  $('#panelInner').innerHTML=panelHTML(tipo);
}
function cerrarPanel(){panelAbierto=null;$('#panel').classList.remove('open');document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('open'));}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

function panelHTML(tipo){
  if(tipo==='persona'){
    return sec('Filtrar por persona',personas().map(p=>opt(p,F.persona.has(p),`toggleSet('persona','${esc(p).replace(/'/g,"\\'")}')`)).join(''));
  }
  if(tipo==='objetivo'){
    return sec('Filtrar por objetivo',objetivos().map(o=>opt(o,F.objetivo.has(o),`toggleSet('objetivo','${esc(o)}')`,'obj-'+(OBJ_MAP[o]||'otro'))).join(''));
  }
  if(tipo==='franja'){
    return sec('Franja horaria',Object.keys(FRANJAS).map(k=>opt(FRANJAS[k].label,F.franja.has(k),`toggleSet('franja','${k}')`)).join(''));
  }
  if(tipo==='fecha'){
    return sec('Día de la cita',
      `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="date" class="dateinput" id="diaInput" value="${F.dia}" onchange="setDia(this.value)">
        ${F.dia?`<button class="opt sel" onclick="setDia('')">Quitar ✕</button>`:''}
      </div>`);
  }
  if(tipo==='orden'){
    const ords=[['fecha-asc','Cita: más próxima primero'],['fecha-desc','Cita: más lejana primero'],['crea-desc','Creación: más reciente'],['crea-asc','Creación: más antigua'],['contacto','Contacto (A-Z)']];
    return sec('Ordenar por',ords.map(([v,l])=>opt(l,F.orden===v,`setOrden('${v}')`)).join(''));
  }
  return'';
}
function sec(title,inner){return`<div class="panel-sec"><h4>${title}</h4><div class="opts">${inner}</div></div>`;}
function opt(label,sel,onclick,extra){return`<button class="opt ${extra||''} ${sel?'sel':''}" onclick="${onclick}">${label}</button>`;}

function toggleSet(grupo,val){F[grupo].has(val)?F[grupo].delete(val):F[grupo].add(val);refreshUI();$('#panelInner').innerHTML=panelHTML(panelAbierto);}
function setDia(v){F.dia=v;refreshUI();if(panelAbierto==='fecha')$('#panelInner').innerHTML=panelHTML('fecha');}
function setOrden(v){F.orden=v;refreshUI();$('#panelInner').innerHTML=panelHTML('orden');}
function onSearch(v){F.texto=v.toLowerCase().trim();$('#searchClear').className='search-clear'+(v?' show':'');refreshUI();}
function clearSearch(){$('#search').value='';F.texto='';$('#searchClear').className='search-clear';refreshUI();}
function clearAll(){F={persona:new Set(),objetivo:new Set(),franja:new Set(),dia:'',texto:'',orden:'fecha-asc'};$('#search').value='';$('#searchClear').className='search-clear';cerrarPanel();refreshUI();}

function refreshUI(){
  badge('Persona',F.persona.size);badge('Objetivo',F.objetivo.size);badge('Franja',F.franja.size);
  setOn('tgPersona',F.persona.size);setOn('tgObjetivo',F.objetivo.size);setOn('tgFranja',F.franja.size);
  setOn('tgFecha',F.dia);setOn('tgOrden',F.orden!=='fecha-asc');

  // Ocultar correctamente los botones según la vista activa
  const esVistaDia = (vista === 'dia');
  if($('#tgFecha')) $('#tgFecha').style.display = esVistaDia ? 'none' : 'flex';
  if($('#tgOrden')) $('#tgOrden').style.display = esVistaDia ? 'none' : 'flex';

  const activo=F.persona.size||F.objetivo.size||F.franja.size||F.dia||F.texto||F.orden!=='fecha-asc';
  $('#clearAll').className='clear-all'+(activo?' show':'');
  if(vista==='dia')renderDia();else render();
}
function badge(name,n){const b=$('#b'+name);if(!b)return;if(n>0){b.textContent=n;b.style.display='flex';}else b.style.display='none';}
function setOn(id,cond){const el=$('#'+id);if(el)el.classList.toggle('on',!!cond);}

/* -------- APLICAR FILTROS -------- */
function filtrar(){
  return DATA.filter(d=>{
    if(!d.fecha)return false;
    if(F.persona.size && ![...F.persona].some(p=>(d.persona||'').includes(p)))return false;
    if(F.objetivo.size && !F.objetivo.has(d.objetivo))return false;
    if(F.dia && dayKey(d.fecha)!==F.dia)return false;
    if(F.franja.size){const h=new Date(d.fecha).getHours();
      if(![...F.franja].some(k=>h>=FRANJAS[k].min && h<FRANJAS[k].max))return false;}
    if(F.texto){const blob=(d.evento+' '+d.contacto+' '+d.ubicacion+' '+d.persona+' '+d.objetivo).toLowerCase();
      if(!blob.includes(F.texto))return false;}
    return true;
  });
}
function ordenar(items){
  const c=[...items];
  switch(F.orden){
    case'fecha-desc':c.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));break;
    case'crea-desc':c.sort((a,b)=>new Date(b.creacion_iso||0)-new Date(a.creacion_iso||0));break;
    case'crea-asc':c.sort((a,b)=>new Date(a.creacion_iso||0)-new Date(b.creacion_iso||0));break;
    case'contacto':c.sort((a,b)=>(a.contacto||'').localeCompare(b.contacto||''));break;
    default:c.sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  }
  return c;
}

function iconLoc(){return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';}
function iconUser(){return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';}
function iconWa(){return'<svg style="width: 14px; height: 14px; min-width: 14px; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2s-.7.9-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15l-1.3 4.7L7 20.4A10 10 0 1 0 12 2z"/></svg>';}
function iconMap(){return iconLoc();}
function iconClock(){return'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';}

/* -------- VISTAS: lista / día -------- */
let vista='lista';
let calSel=dayKey(new Date());

function setVista(v){
  vista=v;
  $('#tabLista').classList.toggle('on',v==='lista');
  $('#tabCal').classList.toggle('on',v==='dia');
  $('#main').classList.toggle('hidden',v!=='lista');
  $('#calView').classList.toggle('hidden',v!=='dia');
  if(v==='dia') irDiaConCitas();
  refreshUI();
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
  if(!cont)return;
  const map=citasPorDia();
  const citas=(map[calSel]||[]).slice().sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  $('#subCount').innerHTML=`<b>${citas.length}</b> cita${citas.length!==1?'s':''}`;

  const dObj=new Date(calSel+'T12:00:00');
  const esHoy=calSel===dayKey(new Date());
  const titulo=dObj.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});

  let html=`<div class="day-bar">
    <button class="day-arrow" onclick="calDia(-1)">‹</button>
    <div class="day-bar-center" style="position:relative; cursor:pointer;">
      <div class="day-bar-title ${esHoy?'is-today':''}">${esHoy?'Hoy':titulo} 📅</div>
      ${esHoy?`<div class="day-bar-sub">${titulo}</div>`:''}
      <input type="date" value="${calSel}" onchange="selDia(this.value)" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
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

  html+=`<div class="tl" id="tl" style="height:${(HORA_FIN-HORA_INI+1)*PX_HORA}px">`;
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
  html+=`<div class="tl-drop-hint" id="dropHint" data-hora=""></div>`;
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
    html+=`<div class="tl-ev ${t}" data-id="${ev.c.id}" style="top:${top}px;left:calc(54px + ${idx*wPct}%);width:calc(${wPct}% - ${idx===0&&totalCol===1?'12':'6'}px)" onpointerdown="dragStart(event,'${ev.c.id}')">
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
    <button class="dt-edit" onclick="editarCita('${d.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
    <button class="dt-close" onclick="cerrarDetalle()">Cerrar</button>`;
  $('#detalleInner').innerHTML=html;
  $('#detalleBg').classList.add('show');
}
function cerrarDetalle(){$('#detalleBg').classList.remove('show');}

/* -------- MODAL NUEVA CITA -------- */
const OBJETIVOS_FORM=['Reunion','Venta','Alquilar','Tasacion','Turno','Recibir llaves'];
let objSel='Reunion';
let editandoId=null;

function abrirModal(diaK){
  editandoId=null;
  toggleFormContacto(false); 
  const h3=document.querySelector('#modalBg .modal h3'); if(h3)h3.textContent='Nueva cita';
  $('#fFecha').value=diaK||dayKey(new Date());
  $('#fHora').value='10:00';
  $('#fEvento').value='';$('#fPersona').value='';$('#fContacto').value='';$('#fTelefono').value='';$('#fUbicacion').value='';
  if($('#fNotificar')) $('#fNotificar').checked=false;
  objSel='Reunion';
  $('#fObjetivo').innerHTML=OBJETIVOS_FORM.map(o=>`<span class="op ${o===objSel?'sel':''}" onclick="pickObj('${o}',this)">${o}</span>`).join('');
  const ft=new Date((diaK||dayKey(new Date()))+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  $('#modalFecha').textContent='Para el '+ft;
  $('#modalBg').classList.add('show');
}

function editarCita(id){
  const d=DATA.find(x=>String(x.id)===String(id));if(!d)return;
  cerrarDetalle();
  editandoId=id;
  toggleFormContacto(false); 
  const dt=new Date(d.fecha);
  $('#fFecha').value=dayKey(dt);
  $('#fHora').value=String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
  $('#fEvento').value=d.evento||'';
  $('#fPersona').value=d.persona||'';
  $('#fContacto').value=d.contacto||'';
  $('#fTelefono').value=d.telefono||'';
  $('#fUbicacion').value=d.ubicacion||'';
  if($('#fNotificar'))$('#fNotificar').checked=false;
  objSel=d.objetivo||'Reunion';
  $('#fObjetivo').innerHTML=OBJETIVOS_FORM.map(o=>`<span class="op ${o===objSel?'sel':''}" onclick="pickObj('${o}',this)">${o}</span>`).join('');
  const h3=document.querySelector('#modalBg .modal h3'); if(h3)h3.textContent='Editar cita';
  $('#modalFecha').textContent='Modificá los datos y guardá';
  $('#modalBg').classList.add('show');
}

function cerrarModal(){$('#modalBg').classList.remove('show');}
function pickObj(o,el){objSel=o;document.querySelectorAll('#fObjetivo .op').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');}

function actualizarDatalistContactos(){
  const dl = $('#listaContactos');
  if(!dl) return;
  dl.innerHTML = CONTACTOS.map(c => {
    if(c && c.name) {
       return `<option value="${esc(c.name)}"></option>`;
    }
    return '';
  }).join('');
}

/* ALTA RÁPIDA DE CONTACTOS */
function toggleFormContacto(show) {
  const form = $('#subFormContacto');
  if (!form) return;
  
  if (show === undefined) {
    form.style.display = (form.style.display === 'none' || form.style.display === '') ? 'block' : 'none';
  } else {
    form.style.display = show ? 'block' : 'none';
  }
  
  if (form.style.display === 'none') {
    if($('#ncNombre')) $('#ncNombre').value = ''; 
    if($('#ncApellido')) $('#ncApellido').value = ''; 
    if($('#ncTelefono')) $('#ncTelefono').value = '';
  }
}

function confirmarNuevoContacto() {
  const nom = $('#ncNombre') ? $('#ncNombre').value.trim() : '';
  const ape = $('#ncApellido') ? $('#ncApellido').value.trim() : '';
  const tel = $('#ncTelefono') ? $('#ncTelefono').value.trim() : '';

  if (!nom || !ape) {
    toast('Por favor, cargá Nombre y Apellido', true);
    return;
  }

  const nombreCompleto = nom + ' ' + ape;
  if($('#fContacto')) $('#fContacto').value = nombreCompleto;
  if($('#fTelefono')) $('#fTelefono').value = tel;

  CONTACTOS.push({
    id: 'nuevo-' + Date.now(),
    name: nombreCompleto,
    telefono: tel
  });

  actualizarDatalistContactos();
  toggleFormContacto(false);
  toast('Contacto cargado a la cita');
}

function autoLlenarTelefonoPorContacto(nombre) {
  const norm = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const match = CONTACTOS.find(c => c && c.name && norm(c.name) === norm(nombre));
  if (match && match.telefono) {
    const inputTel = $('#fTelefono');
    if (inputTel) inputTel.value = match.telefono;
  }
}

async function enviarCita(){
  const evento=$('#fEvento') ? $('#fEvento').value.trim() : '';
  const fecha=$('#fFecha') ? $('#fFecha').value : '';
  const hora=$('#fHora') ? $('#fHora').value||'00:00' : '00:00';
  const nombreContacto = $('#fContacto') ? $('#fContacto').value.trim() : '';

  if(!evento){toast('Poné un título para la cita',true);return;}
  if(!fecha){toast('Elegí una fecha',true);return;}

  const norm = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const matchContacto = CONTACTOS.find(c => c && c.name && norm(c.name) === norm(nombreContacto));
  const contactoId = matchContacto ? matchContacto.id : '';
  const notificar = $('#fNotificar') ? $('#fNotificar').checked : false;

  const payload={
    accion: editandoId ? 'editar' : 'crear',
    token:API_TOKEN,
    id: editandoId || '',
    evento:evento,
    fecha:fecha+'T'+hora+':00',
    objetivo:objSel,
    persona:$('#fPersona') ? $('#fPersona').value.trim() : '',
    contacto:nombreContacto,
    contacto_id:contactoId,
    telefono:$('#fTelefono') ? $('#fTelefono').value.trim() : '',
    ubicacion: $('#fUbicacion') ? $('#fUbicacion').value.trim() : '', // <--- CORREGIDO COMPLETAMENTE AQUÍ
    notificar:notificar,
    notificar_texto:notificar?'Si':'No'
  };

  const url = editandoId ? WEBHOOK_EDITAR : WEBHOOK_CREAR;

  if(!url){
    toast(editandoId ? 'Configurá el webhook de edición' : 'Configurá el webhook de creación',true);
    return;
  }

  const btn=$('#btnSave'); if(!btn) return;
  btn.classList.add('sending');btn.textContent='Guardando';

  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const textoResp=await res.text();

    let resp=null;
    try{ resp=JSON.parse(textoResp); }catch(e){ resp=null; }

    if(!res.ok){
      const msg=(resp && (resp.error||resp.message)) || textoResp || ('HTTP '+res.status);
      toast('Error: '+msg, true);
      return;
    }

    if(resp && resp.ok===false){
      toast('Error: '+(resp.error||resp.message||'No se pudo crear'), true);
      return;
    }

    let citaNueva = (resp && (resp.cita||resp.item||resp.data)) || null;

    if(!citaNueva){
      citaNueva={
        id: (resp && resp.id) ? String(resp.id) : ('local-'+Date.now()),
        evento:payload.evento, persona:payload.persona, fecha:payload.fecha,
        ubicacion:payload.ubicacion, lat:'', lng:'', objetivo:payload.objetivo,
        contacto:payload.contacto, telefono:payload.telefono, estado:'Vigente',
        creacion_iso:new Date().toISOString().slice(0,19), creado_por:''
      };
    }

    if(editandoId){
      const i=DATA.findIndex(x=>String(x.id)===String(editandoId));
      if(i>=0) DATA[i]={...DATA[i], ...citaNueva};
    }else{
      DATA.push(citaNueva);
    }

    cerrarModal();
    calSel=dayKey(new Date(citaNueva.fecha||payload.fecha));
    refreshUI();
    setVista('dia');
    toast(editandoId ? 'Cita actualizada' : 'Cita creada');
  }catch(e){
    toast('No se pudo conectar con el webhook: '+e.message, true);
  }finally{
    if($('#btnSave')) { $('#btnSave').classList.remove('sending'); $('#btnSave').textContent='Guardar cita'; }
  }
}

function render(){
  const main=$('#main'); if(!main) return;
  let items=ordenar(filtrar());
  $('#subCount').innerHTML=`<b>${items.length}</b> cita${items.length!==1?'s':''}`;
  if(!items.length){main.innerHTML='<div class="empty"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><p>No hay citas con estos filtros</p></div>';return;}

  const ordenCronologico=(F.orden==='fecha-asc'||F.orden==='fecha-desc');
  let html='',delay=0;
  if(ordenCronologico){
    const groups={};items.forEach(d=>{const k=dayKey(d.fecha);(groups[k]=groups[k]||[]).push(d);});
    const keys=Object.keys(groups).sort((a,b)=>new Date(groups[a][0].fecha)-new Date(groups[b][0].fecha));
    if(F.orden==='fecha-desc')keys.reverse();
    keys.forEach(k=>{const arr=groups[k];
      html+=`<div class="day-group"><div class="day-head"><span class="day-label ${isToday(arr[0].fecha)?'is-today':''}">${dayLabel(arr[0].fecha)}</span><span class="day-line"></span><span class="day-count">${arr.length}</span></div>`;
      arr.forEach(d=>{html+=cardHTML(d,delay);delay+=30;});html+='</div>';});
  }else{
    html+='<div class="day-group">';items.forEach(d=>{html+=cardHTML(d,delay);delay+=30;});html+='</div>';
  }
  main.innerHTML=html;
}

function cardHTML(d,delay){
  const cls=OBJ_MAP[d.objetivo]||'otro';
  const tel=(d.telefono||'').replace(/\D/g,'');
  const waLink=tel?`https://wa.me/${tel.length<=10?'54'+tel:tel}`:'';
  const mLink=mapURL(d);
  const pers=(d.persona||'').split(',').map(p=>p.trim()).filter(Boolean);
  const showFecha=(F.orden==='crea-desc'||F.orden==='crea-asc'||F.orden==='contacto');
  return`<div class="card t-${cls}" style="animation-delay:${delay}ms">
    <div class="c-top"><div class="c-time">${fmtTime(d.fecha)}${showFecha?` <span style="font-size:12px;color:var(--muted);font-weight:600">· ${new Date(d.fecha).toLocaleDateString('es-AR',{day:'numeric',month:'short'})}</span>`:''}</div>
      ${d.objetivo?`<span class="c-tag ${cls}">${esc(d.objetivo)}</span>`:''}</div>
    <div class="c-title">${esc(d.evento)||'(sin título)'}</div>
    <div class="c-meta">
      ${d.contacto?`<div class="c-row">${iconUser()}<b>${esc(d.contacto)}</b></div>`:''}
      ${d.telefono?`<div class="c-row">${iconWa()}<span>${esc(d.telefono)}</span></div>`:''}
      ${d.ubicacion?`<div class="c-row">${iconLoc()}<span>${esc(d.ubicacion)}</span></div>`:''}
      ${pers.length?`<div class="person-badges">${pers.map(p=>`<span class="pb">${esc(p)}</span>`).join('')}</div>`:''}
    </div>
    <div class="c-actions">
      <a class="act wa ${waLink?'':'disabled'}" ${waLink?`href="${waLink}" target="_blank" rel="noopener"`:''}>${iconWa()}WhatsApp</a>
      <a class="act map ${mLink?'':'disabled'}" ${mLink?`href="${mLink}" target="_blank" rel="noopener"`:''}>${iconMap()}Mapa</a>
    </div>
    ${d.creacion_iso?`<div class="c-foot">Creado ${d.creado_por?'por '+esc(d.creado_por)+' ':''}el ${fmtCrea(d.creacion_iso)}</div>`:''}
  </div>`;
}
function esc(s){return(s||'').replace(/[&<>"]/g,c=>({'&':'&','<':'<','>':'>','"':'"'}[c]));}

function desglosarRespuestaMalformada(textoCrudo) {
  let agendaData = [];
  let contactosData = [];
  let texto = textoCrudo.trim();

  if (texto.startsWith('[') && texto.endsWith(']')) {
    let interior = texto.slice(1, -1).trim();
    if (interior.includes('"agenda"')) {
      texto = interior;
    }
  }

  const agendaRegex = /"agenda"\s*:\s*([\s\S]+?),\s*"contactos"\s*:/i;
  const agendaMatch = texto.match(agendaRegex);
  if (agendaMatch) {
    let agendaStr = agendaMatch[1].trim();
    if (!agendaStr.startsWith('[')) agendaStr = '[' + agendaStr + ']';
    try {
      agendaStr = agendaStr.replace(/'/g, '"');
      agendaData = JSON.parse(agendaStr);
    } catch(e) { console.error("Fallo parseo secundario de agenda:", e); }
  }

  const contactosRegex = /"contactos"\s*:\s*([\s\S]+)/i;
  const contactosMatch = texto.match(contactosRegex);
  if (contactosMatch) {
    let contactosStr = contactosMatch[1].trim();
    if (contactosStr.endsWith('}')) contactosStr = contactosStr.slice(0, -1).trim();
    if (contactosStr.endsWith(',')) contactosStr = contactosStr.slice(0, -1).trim();
    if (!contactosStr.startsWith('[')) contactosStr = '[' + contactosStr + ']';
    try {
      contactosStr = contactosStr.replace(/'/g, '"');
      contactosData = JSON.parse(contactosStr);
    } catch(e) { console.error("Fallo parseo secundario de contactos:", e); }
  }

  if (!agendaMatch && !contactosMatch) {
    try {
      let json = JSON.parse(texto);
      if (json.agenda) agendaData = json.agenda;
      if (json.contactos) contactosData = json.contactos;
    } catch(e){}
  }

  return {
    agenda: Array.isArray(agendaData) ? agendaData : [agendaData].filter(Boolean),
    contactos: Array.isArray(contactosData) ? contactosData : [contactosData].filter(Boolean)
  };
}

async function cargar(){
  const btn=$('#refreshBtn'); if(btn) btn.classList.add('loading');
  if(!WEBHOOK_URL){
    DATA=DEMO; CONTACTOS=[]; if($('#statusPill')) $('#statusPill').className='status-pill demo'; if($('#statusTxt')) $('#statusTxt').textContent='Demo';
    refreshUI();actualizarDatalistContactos(); if(btn) btn.classList.remove('loading');return;
  }
  try{
    const res=await fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accion:'listar',token:API_TOKEN})});
    if(!res.ok)throw new Error('HTTP '+res.status);
    
    let textoRespuesta = await res.text();
    let datosCargados = desglosarRespuestaMalformada(textoRespuesta);
    
    DATA = datosCargados.agenda;
    CONTACTOS = datosCargados.contactos;
    
    if($('#statusPill')) $('#statusPill').className='status-pill live'; if($('#statusTxt')) $('#statusTxt').textContent='En vivo';
    refreshUI();
    actualizarDatalistContactos(); 
    toast('Agenda actualizada');
  }catch(e){
    console.error("Error crítico procesando la carga:", e);
    DATA=DEMO; CONTACTOS=[]; if($('#statusPill')) $('#statusPill').className='status-pill demo'; if($('#statusTxt')) $('#statusTxt').textContent='Demo';
    refreshUI();
    actualizarDatalistContactos();
    toast('Error al capturar datos de Make',true);
  }finally{ if(btn) btn.classList.remove('loading'); }
}

/* -------- DRAG & DROP de citas -------- */
let drag=null;

function dragStart(e,id){
  const el=e.currentTarget;
  const tl=$('#tl');
  drag={
    id, el, tl,
    startY:e.clientY,
    startTop:parseFloat(el.style.top)||0,
    moved:false
  };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove',dragMove);
  el.addEventListener('pointerup',dragEnd);
}

function dragMove(e){
  if(!drag)return;
  const dy=e.clientY-drag.startY;
  if(Math.abs(dy)>4)drag.moved=true;
  if(!drag.moved)return;
  drag.el.classList.add('dragging');
  let nuevoTop=drag.startTop+dy;
  const maxTop=(HORA_FIN-HORA_INI)*PX_HORA;
  nuevoTop=Math.max(0,Math.min(maxTop,nuevoTop));
  drag.el.style.top=nuevoTop+'px';
  const horaFloat=HORA_INI+(nuevoTop/PX_HORA);
  const horaSnap=Math.round(horaFloat);
  const hint=$('#dropHint');
  if(hint){
    hint.style.top=((horaSnap-HORA_INI)*PX_HORA)+'px';
    hint.dataset.hora=String(horaSnap).padStart(2,'0')+':00';
    hint.classList.add('show');
  }
  drag.horaSnap=horaSnap;
}

async function dragEnd(e){
  if(!drag)return;
  const {el,id,moved,horaSnap}=drag;
  el.removeEventListener('pointermove',dragMove);
  el.removeEventListener('pointerup',dragEnd);
  el.classList.remove('dragging');
  const hint=$('#dropHint');if(hint)hint.classList.remove('show');
  drag=null;

  if(!moved){ abrirDetalle(id); return; }

  const cita=DATA.find(x=>String(x.id)===String(id));
  if(!cita||horaSnap==null){renderDia();return;}
  const dt=new Date(cita.fecha);
  const original=dt.getHours();
  if(horaSnap===original){renderDia();return;}

  dt.setHours(horaSnap,0,0,0);
  const nuevaFechaISO=dayKey(dt)+'T'+String(horaSnap).padStart(2,'0')+':00:00';

  const fechaPrevia=cita.fecha;
  cita.fecha=nuevaFechaISO;
  renderDia();

  await guardarCambioHorario(id,nuevaFechaISO,fechaPrevia);
}

async function guardarCambioHorario(id,nuevaFecha,fechaPrevia){
  if(!WEBHOOK_EDITAR){
    toast('Horario cambiado (local — falta webhook de edición)');
    return;
  }
  try{
    const res=await fetch(WEBHOOK_EDITAR,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accion:'editar',token:API_TOKEN,id:id,fecha:nuevaFecha})});
    if(!res.ok)throw new Error('HTTP '+res.status);
    toast('Horario actualizado');
  }catch(err){
    const cita=DATA.find(x=>String(x.id)===String(id));
    if(cita)cita.fecha=fechaPrevia;
    renderDia();
    toast('No se pudo guardar el cambio',true);
  }
}

cargar();
