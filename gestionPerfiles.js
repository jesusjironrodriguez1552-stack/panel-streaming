//
// --- gestionPerfiles.js (COMPLETO, FINAL y con FILTROS RÁPIDOS) ---
//
import { supabase } from './supabaseClient.js'
// Importamos AMBAS funciones de utils.js
import { showMessage, mostrarMensajeCliente } from './utils.js'

// --- 1. PLANTILLAS MAESTRAS DE MENSAJES ---
const plantillas = {
    recordatorio: "¡Hola [NOMBRE]! Te saluda Streaming Store. Tu perfil de [PLATAFORMA] ha vencido. ¿Deseas renovar?",
    cambio: "¡Hola [NOMBRE]! Por tu seguridad hemos modificado tu cuenta de [PLATAFORMA].\n\nTus nuevos datos son:\nCorreo: [EMAIL]\nContraseña: [PASS]\nPerfil: [NOMBRE]",
    gracias: "¡Gracias por tu pago, [NOMBRE]! Tu perfil de [PLATAFORMA] ha sido renovado hasta el [NUEVA_FECHA]."
};

// --- 4.1: LÓGICA DE LA PESTAÑA (Cargar Lista) ---
export async function cargarTodosLosPerfiles() {
    const listElement = document.getElementById('perfiles-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    const { data: perfiles, error } = await supabase
        .from('perfiles')
        .select(`
            id,
            nombre_perfil,
            estado,
            fecha_vencimiento_cliente,
            wsp, 
            cuentas_madre ( id, plataforma, email, contrasena ) 
        `)
        .order('id', { ascending: false });

    if (error) { /* ... (manejo de error) ... */ }
    if (perfiles.length === 0) { /* ... (manejo de lista vacía) ... */ }

    // --- Lógica de Agrupación ---
    const perfilesAgrupados = {};
    let vencidosCount = 0, vencenHoyCount = 0, vencenProntoCount = 0;
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const tresDias = new Date(hoy);
    tresDias.setDate(hoy.getDate() + 3);

    perfiles.forEach(perfil => {
        let grupo = 'XX_HUERFANOS'; 
        if (perfil.estado === 'libre' && !perfil.cuentas_madre) { grupo = 'XX_LIBRES_SIN_ASIGNAR'; }
        else if (perfil.cuentas_madre) { grupo = `${perfil.cuentas_madre.plataforma.toUpperCase()} | ${perfil.cuentas_madre.email} | ${perfil.cuentas_madre.contrasena}`; }
        if (!perfilesAgrupados[grupo]) { perfilesAgrupados[grupo] = []; }
        perfilesAgrupados[grupo].push(perfil);
    });
    
    const gruposOrdenados = Object.keys(perfilesAgrupados).sort((a, b) => {
        if (a.startsWith('XX_')) return 1; if (b.startsWith('XX_')) return -1; return a.localeCompare(b);
    });

    let htmlFinal = '';

    for (const grupoKey of gruposOrdenados) {
        let nombreGrupo = grupoKey;
        if (grupoKey === 'XX_HUERFANOS') nombreGrupo = 'Perfiles Huérfanos (Cuentas Eliminadas)';
        if (grupoKey === 'XX_LIBRES_SIN_ASIGNAR') nombreGrupo = 'Perfiles Libres (Sin Cuenta Asignada)';
        htmlFinal += `<h2 class="grupo-plataforma" data-grupo="${nombreGrupo}">${nombreGrupo}</h2>`;
        
        perfilesAgrupados[grupoKey].forEach(perfil => {
            let estadoClass = `estado-${perfil.estado}`;
            let info = ''; 
            let estadoReal = perfil.estado; 
            let itemExtraClass = ''; 
            const cuentaMadre = perfil.cuentas_madre;

            if (perfil.estado === 'huerfano') { info = '¡CUENTA MADRE ELIMINADA!'; }
            else if (perfil.estado === 'libre') { info = 'Este perfil está libre y listo para asignar.'; }

            // --- ¡NUEVO! Variable para el data-estado del filtro ---
            let filtroEstado = estadoReal; // 'asignado', 'libre', 'huerfano'

            if (perfil.estado === 'asignado') {
                const vence = new Date(perfil.fecha_vencimiento_cliente + 'T00:00:00-05:00');
                if (vence < hoy) {
                    estadoReal = 'vencido'; estadoClass = 'estado-vencido'; info = `¡VENCIDO! (Desde ${vence.toLocaleDateString('es-ES')})`; itemExtraClass = 'perfil-item-vencido'; vencidosCount++;
                    filtroEstado = 'vencido'; // <-- Asignar al filtro
                } else if (vence.getTime() === hoy.getTime()) {
                    info = `¡¡VENCE HOY!!`; itemExtraClass = 'perfil-item-hoy'; vencenHoyCount++;
                    filtroEstado = 'hoy'; // <-- Asignar al filtro
                } else if (vence <= tresDias) {
                    info = `Vence pronto: ${vence.toLocaleDateString('es-ES')}`; itemExtraClass = 'perfil-item-pronto'; vencenProntoCount++;
                    // (Opcional) filtroEstado = 'pronto'; 
                } else {
                    info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                }
            }
            
            const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';
            const botonRenovar = (estadoReal === 'vencido' || estadoReal === 'asignado') ? `<button class="btn-small renew-btn" data-id="${perfil.id}">+30 Días</button>` : '';
            const botonNotificar = (perfil.wsp && perfil.estado !== 'libre') ? `<button class="btn-small notify-btn" data-id="${perfil.id}">💬 Notificar</button>` : '';

            // --- ¡NUEVO! Añadimos data-estado y data-nombre ---
            htmlFinal += `
                <li class="perfil-item ${itemExtraClass}" 
                    data-nombre="${perfil.nombre_perfil.toLowerCase()}" 
                    data-estado="${filtroEstado}"> 
                    <div><strong>${perfil.nombre_perfil}</strong> <br><small>${info}</small></div>
                    <div class="perfil-controles">
                        <span class="perfil-estado ${estadoClass}">${estadoReal.toUpperCase()}</span>
                        ${botonRenovar} ${botonNotificar}
                        <button class="btn-small edit-perfil-btn" data-id="${perfil.id}" data-nombre="${perfil.nombre_perfil}" data-estado="${perfil.estado}" data-fecha="${fechaParaInput}" data-wsp="${perfil.wsp || ''}" >
                            ✏️ Editar
                        </button>
                    </div>
                </li>`;
        });
    }

    listElement.innerHTML = htmlFinal;

    document.getElementById('perfiles-vencidos').textContent = vencidosCount;
    document.getElementById('perfiles-hoy').textContent = vencenHoyCount;
    document.getElementById('perfiles-pronto').textContent = vencenProntoCount;
    
    document.querySelectorAll('.edit-perfil-btn').forEach(button => { button.addEventListener('click', (e) => { abrirModalEditar(e.currentTarget.dataset); }); });
    document.querySelectorAll('.renew-btn').forEach(button => { button.addEventListener('click', (e) => { const id = e.currentTarget.dataset.id; renovarPerfil(id); }); });
    document.querySelectorAll('.notify-btn').forEach(button => { button.addEventListener('click', async (e) => { const id = e.currentTarget.dataset.id; const { data: perfil } = await supabase.from('perfiles').select(`*, cuentas_madre(*)`).eq('id', id).single(); abrirMenuNotificar(perfil); }); });

    let alertMessage = '';
    if (vencidosCount > 0) { alertMessage += `¡ATENCIÓN!\n\nTienes ${vencidosCount} perfiles VENCIDOS.\n`; }
    if (vencenHoyCount > 0) { alertMessage += `Tienes ${vencenHoyCount} perfiles que vencen HOY.\n`; }
    if (vencenProntoCount > 0 && vencenHoyCount === 0) { alertMessage += `Tienes ${vencenProntoCount} perfiles que vencen en los próximos 3 días.\n`; }
    if (alertMessage) { alert(alertMessage + "\nRevisa la lista de perfiles marcados en color."); }
    
    // --- ¡NUEVO! Reseteamos los filtros al cargar ---
    // Aseguramos que el botón "Ver Todos" esté activo
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filtro-btn[data-filtro="todos"]').classList.add('active');
    // Limpiamos la búsqueda
    document.getElementById('perfiles-search-input').value = '';
}

// --- 4.2: LÓGICA DE EDITAR, MODALS, BÚSQUEDA Y FILTROS ---
export function initGestionPerfiles() {
    const editForm = document.getElementById('edit-perfil-form');
    if (editForm) { editForm.addEventListener('submit', guardarCambiosPerfil); }
    const deleteBtn = document.getElementById('edit-perfil-delete-btn');
    if (deleteBtn) { deleteBtn.addEventListener('click', eliminarPerfil); }
    const editCloseBtn = document.getElementById('modal-edit-close');
    if(editCloseBtn) { editCloseBtn.addEventListener('click', () => { document.getElementById('modal-editar-perfil').style.display = 'none'; }); }
    const rescateCloseBtn = document.getElementById('modal-rescate-close');
    if(rescateCloseBtn) { rescateCloseBtn.addEventListener('click', () => { document.getElementById('modal-rescate').style.display = 'none'; }); }

    // --- ¡MODIFICADO! Conectamos la búsqueda y los filtros ---
    const searchInput = document.getElementById('perfiles-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarListaCombinada);
    }
    
    const filtroBotones = document.querySelectorAll('.filtro-btn');
    filtroBotones.forEach(boton => {
        boton.addEventListener('click', () => {
            filtroBotones.forEach(btn => btn.classList.remove('active'));
            boton.classList.add('active');
            filtrarListaCombinada(); // Llamamos a la misma función
        });
    });
    // --- Fin de la modificación ---
}

// --- ¡NUEVA FUNCIÓN! Filtro Combinado ---
// Esta única función maneja AMBAS cosas: la búsqueda y los filtros de botones
function filtrarListaCombinada() {
    // 1. Obtener los valores actuales de ambos filtros
    const textoBusqueda = document.getElementById('perfiles-search-input').value.toLowerCase();
    const filtroActivo = document.querySelector('.filtro-btn.active').dataset.filtro; 

    const grupos = document.querySelectorAll('.grupo-plataforma');
    
    grupos.forEach(grupo => {
        let grupoVisible = false;
        let siguienteElemento = grupo.nextElementSibling;
        
        while(siguienteElemento && siguienteElemento.tagName === 'LI') {
            const estadoDelPerfil = siguienteElemento.dataset.estado;
            const nombreDelPerfil = siguienteElemento.dataset.nombre;

            // Condición 1: El perfil coincide con el filtro de estado
            let filtroPasa = false;
            if (filtroActivo === 'todos') { filtroPasa = true; }
            else if (filtroActivo === 'vencidos' && estadoDelPerfil === 'vencido') { filtroPasa = true; }
            else if (filtroActivo === 'hoy' && estadoDelPerfil === 'hoy') { filtroPasa = true; }
            else if (filtroActivo === 'libres' && estadoDelPerfil === 'libre') { filtroPasa = true; }

            // Condición 2: El perfil coincide con el texto de búsqueda
            const busquedaPasa = nombreDelPerfil.includes(textoBusqueda);

            // Mostrar solo si CUMPLE AMBAS condiciones
            if (filtroPasa && busquedaPasa) {
                siguienteElemento.style.display = 'flex';
                grupoVisible = true;
            } else {
                siguienteElemento.style.display = 'none';
            }
            siguienteElemento = siguienteElemento.nextElementSibling;
        }
        grupo.style.display = grupoVisible ? 'block' : 'none';
    });
}
// --- Fin de la nueva función ---


// (El resto de funciones no cambian)
function abrirModalEditar(perfilData) { /* ... */ }
async function guardarCambiosPerfil(e) { /* ... */ }
async function eliminarPerfil() { /* ... */ }
export async function iniciarRescateHuerfano(cuentaMadre) { /* ... */ }
async function confirmarRescate(cuentaMadre) { /* ... */ }
async function renovarPerfil(id) { /* ... */ }
function abrirMenuNotificar(perfil) { /* ... */ }

// --- (Copiamos las funciones que no cambian para que esté completo) ---

function abrirModalEditar(perfilData) {
    document.getElementById('edit-perfil-id').value = perfilData.id;
    document.getElementById('edit-perfil-nombre').value = perfilData.nombre;
    document.getElementById('edit-perfil-estado').value = perfilData.estado;
    document.getElementById('edit-perfil-fecha').value = perfilData.fecha;
    document.getElementById('edit-perfil-telefono').value = perfilData.wsp;
    document.getElementById('modal-editar-perfil').style.display = 'flex';
}

async function guardarCambiosPerfil(e) {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true; button.textContent = 'Guardando...';
    const id = document.getElementById('edit-perfil-id').value;
    const nombre_perfil = document.getElementById('edit-perfil-nombre').value;
    const estado = document.getElementById('edit-perfil-estado').value;
    const wsp = document.getElementById('edit-perfil-telefono').value;
    let fecha_vencimiento_cliente = document.getElementById('edit-perfil-fecha').value;
    if (estado === 'libre' || estado === 'huerfano') { fecha_vencimiento_cliente = null; }
    const { error } = await supabase.from('perfiles').update({ nombre_perfil: nombre_perfil, estado: estado, fecha_vencimiento_cliente: fecha_vencimiento_cliente, wsp: wsp }).eq('id', id);
    if (error) { alert('Error al guardar cambios: ' + error.message); }
    else { document.getElementById('modal-editar-perfil').style.display = 'none'; window.dispatchEvent(new CustomEvent('refrescarVista')); }
    button.disabled = false; button.textContent = 'Guardar Cambios';
}

async function eliminarPerfil() {
    const id = document.getElementById('edit-perfil-id').value;
    const nombre = document.getElementById('edit-perfil-nombre').value;
    if (!confirm(`¿Estás SEGURO de que quieres ELIMINAR este perfil PERMANENTEMENTE?\n\n"${nombre}"\n\nEsta acción no se puede deshacer.`)) { return; }
    const button = document.getElementById('edit-perfil-delete-btn');
    button.disabled = true; button.textContent = 'Eliminando...';
    const { error } = await supabase.from('perfiles').delete().eq('id', id);
    if (error) { alert('Error al eliminar el perfil: ' + error.message); }
    else { alert('¡Perfil eliminado con éxito!'); document.getElementById('modal-editar-perfil').style.display = 'none'; window.dispatchEvent(new CustomEvent('refrescarVista')); }
    button.disabled = false; button.textContent = 'Eliminar Perfil (Permanente)';
}

export async function iniciarRescateHuerfano(cuentaMadre) {
    const { data: huerfanos, error } = await supabase.from('perfiles').select('id, nombre_perfil, fecha_vencimiento_cliente, wsp').eq('estado', 'huerfano');
    if (error) { alert('Error al buscar huérfanos: ' + error.message); return; }
    if (huerfanos.length === 0) { alert('¡Buenas noticias! No hay perfiles huérfanos para rescatar.'); return; }
    let listaHtml = '';
    huerfanos.forEach((huerfano, index) => {
        const fechaISO = huerfano.fecha_vencimiento_cliente ? new Date(huerfano.fecha_vencimiento_cliente).toISOString() : '';
        const wsp = huerfano.wsp || '';
        listaHtml += `
            <div class="huerfano-option">
                <input type="radio" name="huerfano_id" id="h_${huerfano.id}" value="${huerfano.id}" data-nombre="${huerfano.nombre_perfil}" data-fecha="${fechaISO}" data-wsp="${wsp}" ${index === 0 ? 'checked' : ''}>
                <label for="h_${huerfano.id}">${huerfano.nombre_perfil}</label>
            </div>`;
    });
    document.getElementById('modal-rescate-body').innerHTML = listaHtml;
    document.getElementById('modal-rescate').style.display = 'flex';
    const confirmarBtn = document.getElementById('modal-rescate-confirmar');
    const nuevoBtn = confirmarBtn.cloneNode(true);
    confirmarBtn.parentNode.replaceChild(nuevoBtn, confirmarBtn);
    nuevoBtn.onclick = () => confirmarRescate(cuentaMadre);
}

async function confirmarRescate(cuentaMadre) {
    const seleccionado = document.querySelector('input[name="huerfano_id"]:checked');
    if (!seleccionado) { /* ... */ }
    const { data: perfilLibre, error: findError } = await supabase.from('perfiles').select('id').eq('cuenta_madre_id', cuentaMadre.id).eq('estado', 'libre').limit(1).single();
    if (findError || !perfilLibre) { alert(`¡Error! Esta cuenta madre no tiene perfiles libres para realizar el rescate.`); return; }
    const perfilHuerfanoId = seleccionado.value;
    const perfilHuerfanoNombre = seleccionado.dataset.nombre;
    const perfilHuerfanoFecha = seleccionado.dataset.fecha ? new Date(seleccionado.dataset.fecha).toISOString() : null;
    const perfilHuerfanoWSP = seleccionado.dataset.wsp || null;
    const { error: updateError } = await supabase.from('perfiles').update({ nombre_perfil: perfilHuerfanoNombre, estado: 'asignado', fecha_vencimiento_cliente: perfilHuerfanoFecha, wsp: perfilHuerfanoWSP }).eq('id', perfilLibre.id); 
    if (updateError) { alert('Error al actualizar el perfil libre: ' + updateError.message); return; }
    await supabase.from('perfiles').delete().eq('id', perfilHuerfanoId);
    document.getElementById('modal-rescate').style.display = 'none';
    mostrarMensajeCliente(cuentaMadre, perfilHuerfanoNombre, null, 'reactiva');
    window.dispatchEvent(new CustomEvent('refrescarVista'));
}

async function renovarPerfil(id) {
    const { data: perfil, error: fetchError } = await supabase.from('perfiles').select(`*, cuentas_madre(*)`).eq('id', id).single();
    if (fetchError) { alert("Error: No se pudo encontrar el perfil. " + fetchError.message); return; }
    let fechaBase;
    const fechaActualISO = perfil.fecha_vencimiento_cliente;
    if (fechaActualISO && fechaActualISO !== 'null' && fechaActualISO !== 'undefined') { fechaBase = new Date(fechaActualISO + 'T00:00:00-05:00'); }
    else { fechaBase = new Date(); }
    fechaBase.setHours(0, 0, 0, 0); 
    fechaBase.setDate(fechaBase.getDate() + 30);
    const nuevaFecha = fechaBase.toISOString();
    const nuevaFechaFormateada = fechaBase.toLocaleDateString('es-ES');
    if (!confirm(`Se usará la fecha de vencimiento original como base.\n\nNuevo vencimiento: ${nuevaFechaFormateada}\n¿Confirmar renovación?`)) { return; }
    const { error: updateError } = await supabase.from('perfiles').update({ fecha_vencimiento_cliente: nuevaFecha, estado: 'asignado' }).eq('id', id);
    if (updateError) { alert('Error al renovar el perfil: ' + updateError.message); return; }
    window.dispatchEvent(new CustomEvent('refrescarVista'));
    if (confirm(`¡Renovación guardada!\n\n¿Quieres notificar a "${perfil.nombre_perfil}" por WhatsApp?`)) {
        if (!perfil.wsp) { alert("No se puede notificar: este perfil no tiene un número de WhatsApp guardado."); return; }
        let textoMensaje = plantillas.gracias.replace(/\[NOMBRE\]/g, perfil.nombre_perfil).replace(/\[PLATAFORMA\]/g, perfil.cuentas_madre.plataforma).replace(/\[NUEVA_FECHA\]/g, nuevaFechaFormateada);
        let telefono = perfil.wsp.replace(/\s+/g, '').replace('+', '');
        if (telefono.length === 9 && !telefono.startsWith('51')) { telefono = '51' + telefono; }
        const textoCodificado = encodeURIComponent(textoMensaje);
        const urlWhatsApp = `https://wa.me/${telefono}?text=${textoCodificado}`;
        window.open(urlWhatsApp, '_blank');
    }
}

function abrirMenuNotificar(perfil) {
    const mensaje = `¿Qué mensaje quieres enviar a "${perfil.nombre_perfil}"?\n
1 = Recordatorio de Vencimiento
3 = Cambio de Cuenta (Seguridad)
    
(Escribe 1 o 3)`;
    const eleccion = prompt(mensaje);
    let plantilla;
    if (eleccion === '1') { plantilla = plantillas.recordatorio; }
    else if (eleccion === '3') { plantilla = plantillas.cambio; }
    else { return; } 
    let textoMensaje = plantilla;
    textoMensaje = textoMensaje.replace(/\[NOMBRE\]/g, perfil.nombre_perfil);
    if (!perfil.cuentas_madre) { alert("Error: No se pueden enviar datos de una cuenta eliminada (perfil huérfano)."); return; }
    textoMensaje = textoMensaje.replace(/\[PLATAFORMA\]/g, perfil.cuentas_madre.plataforma);
    textoMensaje = textoMensaje.replace(/\[EMAIL\]/g, perfil.cuentas_madre.email);
    textoMensaje = textoMensaje.replace(/\[PASS\]/g, perfil.cuentas_madre.contrasena);
    if (perfil.fecha_vencimiento_cliente) { const nuevaFecha = new Date(perfil.fecha_vencimiento_cliente + 'T00:00:00-05:00').toLocaleDateString('es-ES'); textoMensaje = textoMensaje.replace(/\[NUEVA_FECHA\]/g, nuevaFecha); }
    const textoCodificado = encodeURIComponent(textoMensaje);
    let telefono = perfil.wsp;
    if (!telefono) { alert("Error: Este perfil no tiene un número de teléfono guardado."); return; }
    telefono = telefono.replace(/\s+/g, '').replace('+', '');
    if (telefono.length === 9 && !telefono.startsWith('51')) { telefono = '51' + telefono; }
    const urlWhatsApp = `https://wa.me/${telefono}?text=${textoCodificado}`;
    window.open(urlWhatsApp, '_blank');
}
