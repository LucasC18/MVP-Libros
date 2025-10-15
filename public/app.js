/* =========================================================
 * MVP Libros - Frontend SPA
 * ======================================================= */

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function toast(msg, ms = 1800) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

function show(idShow, ...idsHide) {
  const el = document.getElementById(idShow);
  if (el) el.classList.remove('hidden');
  idsHide.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw { status: res.status, data };
  return data;
}

/* ---------- helpers ---------- */
const debounce = (fn, ms=420) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const escapeHtml = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const genIsbn13 = ()=> String(Math.floor(1e12 + Math.random()*9e12)); // 13 dígitos

/* =========================================================
 * LOGIN
 * ======================================================= */
const loginForm = $('#loginForm');
const togglePass = $('#togglePass');

togglePass?.addEventListener('click', ()=>{
  const p = $('#password');
  p.type = p.type === 'password' ? 'text' : 'password';
  togglePass.textContent = p.type === 'password' ? '👁️' : '🙈';
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  try{
    await api('/api/login', {
      method:'POST',
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
    });
    toast('✅ Autenticado');
    await enterDashboard();
  }catch(err){
    toast(err?.data?.error || 'Credenciales inválidas', 2200);
  }
});

$('#logout')?.addEventListener('click', async ()=>{
  await api('/api/logout',{method:'POST'});
  toast('Sesión cerrada');
  show('login','app');
});

/* Check sesión al cargar */
(async function bootstrap(){
  try{
    const me = await api('/api/me');
    $('#adminName').textContent = `${me.username} (#${me.id})`;
    show('app','login');
    await loadBooks();
  }catch{ show('login','app'); }
})();

async function enterDashboard(){
  show('app','login');
  try{
    const me = await api('/api/me');
    $('#adminName').textContent = `${me.username} (#${me.id})`;
  }catch{}
  await loadBooks();
}

/* =========================================================
 * ALTA (Create)
 * ======================================================= */
const formLibro = $('#form-libro');

formLibro?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(formLibro);
  const body = Object.fromEntries(fd.entries());
  // numeric
  if (body.anio)   body.anio   = +body.anio;
  if (body.stock)  body.stock  = +body.stock;
  if (body.precio) body.precio = +body.precio;
  // backend exige isbn
  body.isbn = genIsbn13();

  try{
    const created = await api('/api/libros',{ method:'POST', body: JSON.stringify(body) });
    toast(`📗 Agregado #${created.id}`);
    formLibro.reset();
    await loadBooks(true);
  }catch(err){
    toast(err?.data?.error || 'No se pudo agregar', 2400);
  }
});

/* =========================================================
 * LISTADO + BUSCADOR + PAGINADO
 * ======================================================= */
const state = { page:1, limit:10, totalPages:1, search:'' };

$('#selLimit')?.addEventListener('change', async (e)=>{
  state.limit = +e.target.value || 10;
  state.page = 1;
  await loadBooks();
});

$('#txtSearch')?.addEventListener('input', debounce(async (e)=>{
  state.search = e.target.value.trim();
  state.page = 1;
  await loadBooks();
}, 380));

$('#prev')?.addEventListener('click', ()=>{ if(state.page>1){ state.page--; loadBooks(); } });
$('#next')?.addEventListener('click', ()=>{ if(state.page<state.totalPages){ state.page++; loadBooks(); } });

async function loadBooks(keepPage=false){
  if(!keepPage) state.page = Math.max(1, state.page);
  const q = new URLSearchParams({ page: state.page, limit: state.limit, search: state.search });
  const res = await api(`/api/libros?${q}`); // { data, page, limit, total, totalPages }
  state.page = res.page; state.totalPages = res.totalPages || 1;

  const tbody = $('#tabla-libros tbody');
  tbody.innerHTML = '';
  for (const b of res.data){
    const tr = row(b);
    tr.style.animation = 'pop .12s ease-out';
    tbody.appendChild(tr);
  }
  $('#pageInfo').textContent = `Página ${res.page} / ${state.totalPages}`;
  $('#prev').disabled = res.page<=1;
  $('#next').disabled = res.page>=state.totalPages;
}

/* ---------- render fila ---------- */
function row(b){
  const tr = document.createElement('tr'); tr.dataset.id = b.id;
  tr.innerHTML = `
    <td>${b.id}</td>
    <td>${escapeHtml(b.titulo||'')}</td>
    <td>${escapeHtml(b.autor||'')}</td>
    <td>${escapeHtml(b.editorial||'')}</td>
    <td>${b.anio||''}</td>
    <td>${escapeHtml(b.categoria||'')}</td>
    <td>${escapeHtml(b.ubicacion||'')}</td>
    <td>${b.stock??''}</td>
    <td>${Number(b.precio||0).toFixed(2)}</td>
    <td>${escapeHtml(b.estado||'')}</td>
    <td class="row-actions">
      <button class="btn ghost" data-act="edit">Editar</button>
      <button class="btn danger" data-act="del">Eliminar</button>
    </td>
  `;
  tr.querySelector('[data-act="edit"]').onclick = ()=> openEdit(b);
  tr.querySelector('[data-act="del"]').onclick  = ()=> delBook(b.id, b.titulo);
  return tr;
}

/* =========================================================
 * ELIMINAR (Delete) con modal
 * ======================================================= */
async function confirmDialog({ title='Confirmar', text='¿Seguro?', okText='Aceptar', okClass='danger' } = {}) {
  return new Promise(resolve => {
    const modal = $('#modal');
    const t = $('#modalTitle'), p = $('#modalText'), ok = $('#modalOk'), c = $('#modalCancel');
    t.textContent = title; p.textContent = text;
    ok.textContent = okText; ok.className = `btn ${okClass}`;
    const close = (val)=>{ modal.classList.add('hidden'); cleanup(); resolve(val); };
    const onOk = ()=>close(true), onCancel = ()=>close(false);
    const onKey = e => { if (e.key === 'Escape') onCancel(); };
    function cleanup(){ ok.removeEventListener('click', onOk); c.removeEventListener('click', onCancel); window.removeEventListener('keydown', onKey); }
    ok.addEventListener('click', onOk);
    c.addEventListener('click', onCancel);
    window.addEventListener('keydown', onKey);
    modal.classList.remove('hidden');
  });
}

async function delBook(id, titulo=''){
  const ok = await confirmDialog({
    title:'Eliminar libro',
    text: titulo ? `¿Eliminar (borrado lógico) “${titulo}”?` : '¿Eliminar este libro?',
    okText:'Eliminar',
    okClass:'danger'
  });
  if(!ok) return;
  await api(`/api/libros/${id}`, { method:'DELETE' });
  toast('🗑️ Marcado como baja');
  await loadBooks(true);
}

/* =========================================================
 * EDITAR inline (PATCH) con animación
 * ======================================================= */
function openEdit(b){
  const tr = document.querySelector(`tr[data-id="${b.id}"]`);
  if(!tr) return;
  tr.innerHTML = `
    <td>${b.id}</td>
    <td><input name="titulo" value="${escapeHtml(b.titulo||'')}"></td>
    <td><input name="autor" value="${escapeHtml(b.autor||'')}"></td>
    <td><input name="editorial" value="${escapeHtml(b.editorial||'')}"></td>
    <td><input name="anio" type="number" min="1800" max="2100" value="${b.anio||''}"></td>
    <td><input name="categoria" value="${escapeHtml(b.categoria||'')}"></td>
    <td><input name="ubicacion" value="${escapeHtml(b.ubicacion||'')}"></td>
    <td><input name="stock" type="number" min="0" value="${b.stock??''}"></td>
    <td><input name="precio" type="number" min="0" step="0.01" value="${Number(b.precio||0).toFixed(2)}"></td>
    <td>
      <select name="estado">
        ${['disponible','prestado','baja'].map(x=>`<option value="${x}" ${x===b.estado?'selected':''}>${x}</option>`).join('')}
      </select>
    </td>
    <td class="row-actions">
      <button class="btn" data-act="save">Guardar</button>
      <button class="btn ghost" data-act="cancel">Cancelar</button>
    </td>
  `;
  tr.style.animation = 'pop .12s ease-out';
  tr.querySelector('[data-act="save"]').onclick   = ()=> saveEdit(b.id);
  tr.querySelector('[data-act="cancel"]').onclick = ()=> cancelEdit(b.id);
}

function getEditPayload(tr){
  const val = (n)=> tr.querySelector(`[name="${n}"]`)?.value ?? '';
  const out = {
    titulo: val('titulo').trim(),
    autor: val('autor').trim(),
    editorial: val('editorial').trim(),
    anio: val('anio') ? +val('anio') : undefined,
    categoria: val('categoria').trim(),
    ubicacion: val('ubicacion').trim(),
    stock: val('stock') ? +val('stock') : undefined,
    precio: val('precio') ? +val('precio') : undefined,
    estado: val('estado')
  };
  // eliminamos undefined para PATCH limpio
  Object.keys(out).forEach(k => out[k] === '' || out[k] === undefined ? delete out[k] : 0);
  return out;
}

async function saveEdit(id){
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if(!tr) return;
  const body = getEditPayload(tr);
  try{
    const updated = await api(`/api/libros/${id}`, { method:'PATCH', body: JSON.stringify(body) });
    const fresh = row(updated);
    fresh.style.animation = 'pop .12s ease-out';
    tr.replaceWith(fresh);
    toast('✅ Actualizado');
  }catch(err){
    toast(err?.data?.error || 'Error al actualizar', 2400);
  }
}

async function cancelEdit(id){
  try{
    const b = await api(`/api/libros/${id}`);
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if(tr){
      const fresh = row(b);
      fresh.style.animation = 'pop .12s ease-out';
      tr.replaceWith(fresh);
    }
  }catch{
    await loadBooks(true);
  }
}
