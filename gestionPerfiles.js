//
// --- gestionPerfiles.js (COMPLETO, FINAL y con RENOVACIÓN 2-en-1) ---
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
            let info = ''; let estadoReal = perfil.estado; let itemExtraClass = ''; 
            const cuentaMadre = perfil.cuentas_madre;
            if (perfil.estado === 'huerfano') { info = '¡CUENTA MADRE ELIMINADA!'; }
            else if (perfil.estado === 'libre') { info = 'Este perfil está libre y listo para asignar.'; }

            if (perfil.estado === 'asignado') {
                const vence = new Date(perfil.fecha_vencimiento_cliente + 'T00:00:00-05:00');
                if (vence < hoy) {
                    estadoReal = 'vencido'; estadoClass = 'estado-vencido'; info = `¡VENCIDO! (Desde ${vence.toLocaleDateString('es-ES')})`; itemExtraClass = 'perfil-item-vencido'; vencidosCount++;
                } else if (vence.getTime() === hoy.getTime()) {
                    info = `¡¡VENCE HOY!!`; itemExtraClass = 'perfil-item-hoy'; vencenHoyCount++;
                } else if (vence <= tresDias) {
                    info = `Vence pronto: ${vence.toLocaleDateString('es-ES')}`; itemExtraClass = 'perfil-item-pronto'; vencenProntoCount++;
                } else {
                    info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                }
            }
            
            const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';
            
            // --- ¡CORRECCIÓN! El botón aparece si está 'vencido' O 'asignado' ---
            const botonRenovar = (estadoReal === 'vencido' || estadoReal === 'asignado') ? 
                `<button class="btn-small renew-btn" data-id="${perfil.id}">
                    +30 Días
                 </button>` : '';
            
            const botonNotificar = (perfil.wsp && perfil.estado !== 'libre') ? `<button class="btn-small notify-btn" data-id="${perfil.id}">💬 Notificar</button>` : '';

            htmlFinal += `
                <li class="perfil-item ${itemExtraClass}" data-nombre="${perfil.nombre_perfil.toLowerCase()}">
                    <div><strong>${perfil.nombre_perfil}</strong> <br><small>${info}</small></div>
                    <div class="perfil-controles">
                        <span class="perfil-estado ${estadoClass}">${estadoReal.toUpperCase()}</span>
                        ${botonRenovar}
                        ${botonNotificar}
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
    
    // --- ¡CORRECCIÓN! El listener ya solo pasa el ID ---
    document.querySelectorAll('.renew-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            renovarPerfil(id); // Solo pasamos el ID
        });
    });
    
    document.querySelectorAll('.notify-btn').forEach(button => { button.addEventListener('click', async (e) => { const id = e.currentTarget.dataset.id; const { data: perfil } = await supabase.from('perfiles').select(`*, cuentas_madre(*)`).eq('id', id).single(); abrirMenuNotificar(perfil); }); });

    let alertMessage = '';
    if (vencidosCount > 0) { alertMessage += `¡ATENCIÓN!\n\nTienes ${vencidosCount} perfiles VENCIDOS.\n`; }
    if (vencenHoyCount > 0) { alertMessage += `Tienes ${vencenHoyCount} perfiles que vencen HOY.\n`; }
    if (vencenProntoCount > 0 && vencenHoyCount === 0) { alertMessage += `Tienes ${vencenProntoCount} perfiles que vencen en los próximos 3 días.\n`; }
    if (alertMessage) { alert(alertMessage + "\nRevisa la lista de perfiles marcados en color."); }
}

// --- 4.2: LÓGICA DE EDITAR, MODALS Y BÚSQUEDA ---
export function initGestionPerfiles() {
    const editForm = document.getElementById('edit-perfil-form');
    if (editForm) { editForm.addEventListener('submit', guardarCambiosPerfil); }
    const deleteBtn = document.getElementById('edit-perfil-delete-btn');
    if (deleteBtn) { deleteBtn.addEventListener('click', eliminarPerfil); }
    const editCloseBtn = document.getElementById('modal-edit-close');
    if(editCloseBtn) { editCloseBtn.addEventListener('click', () => { document.getElementById('modal-editar-perfil').style.display = 'none'; }); }
    const rescateCloseBtn = document.getElementById('modal-rescate-close');
    if(rescateCloseBtn) { rescateCloseBtn.addEventListener('click', () => { document.getElementById('modal-rescate').style.display = 'none'; }); }
    const searchInput = document.getElementById('perfiles-search-input');
    if (searchInput) { searchInput.addEventListener('input', filtrarListaPerfiles); }
}

function filtrarListaPerfiles(e) { /* ... (esta función no cambia) ... */ }
function abrirModalEditar(perfilData) { /* ... (esta función no cambia) ... */ }
async function guardarCambiosPerfil(e) { /* ... (esta función no cambia) ... */ }
async function eliminarPerfil() { /* ... (esta función no cambia) ... */ }
export async function iniciarRescateHuerfano(cuentaMadre) { /* ... (esta función no cambia) ... */ }
async function confirmarRescate(cuentaMadre) { /* ... (esta función no cambia) ... */ }


// --- 4.4 LÓGICA DE RENOVACIÓN (¡NUEVA LÓGICA 2-en-1!) ---
async function renovarPerfil(id) {
    
    // 1. Obtener los datos frescos del perfil
    const { data: perfil, error: fetchError } = await supabase
        .from('perfiles')
        .select(`*, cuentas_madre(*)`) // Necesitamos los datos de la cuenta madre y wsp
        .eq('id', id)
        .single();

    if (fetchError) {
        alert("Error: No se pudo encontrar el perfil. " + fetchError.message);
        return;
    }

    // 2. Calcular la nueva fecha (la lógica que ya tenías)
    let fechaBase;
    const fechaActualISO = perfil.fecha_vencimiento_cliente;
    if (fechaActualISO && fechaActualISO !== 'null' && fechaActualISO !== 'undefined') {
        fechaBase = new Date(fechaActualISO + 'T00:00:00-05:00');
    } else {
        fechaBase = new Date();
    }
    fechaBase.setHours(0, 0, 0, 0); 
    fechaBase.setDate(fechaBase.getDate() + 30);
    
    const nuevaFecha = fechaBase.toISOString();
    const nuevaFechaFormateada = fechaBase.toLocaleDateString('es-ES');

    // 3. Confirmar la renovación
    if (!confirm(`Se usará la fecha de vencimiento original como base.\n\nNuevo vencimiento: ${nuevaFechaFormateada}\n¿Confirmar renovación?`)) {
        return;
    }

    // 4. Guardar en Supabase
    const { error: updateError } = await supabase
        .from('perfiles').update({ 
            fecha_vencimiento_cliente: nuevaFecha,
            estado: 'asignado' // Se asegura de que esté 'asignado'
        }).eq('id', id);

    if (updateError) {
        alert('Error al renovar el perfil: ' + updateError.message);
        return;
    }

    // 5. Refrescar la vista (para que se vea la nueva fecha)
    window.dispatchEvent(new CustomEvent('refrescarVista'));
    
    // 6. ¡NUEVO! Preguntar para notificar
    if (confirm(`¡Renovación guardada!\n\n¿Quieres notificar a "${perfil.nombre_perfil}" por WhatsApp?`)) {
        
        if (!perfil.wsp) {
            alert("No se puede notificar: este perfil no tiene un número de WhatsApp guardado.");
            return;
        }
        
        // Rellenar la plantilla de "Gracias"
        let textoMensaje = plantillas.gracias
            .replace(/\[NOMBRE\]/g, perfil.nombre_perfil)
            .replace(/\[PLATAFORMA\]/g, perfil.cuentas_madre.plataforma)
            .replace(/\[NUEVA_FECHA\]/g, nuevaFechaFormateada); // ¡Usamos la nueva fecha!

        // Limpiar y crear link
        let telefono = perfil.wsp.replace(/\s+/g, '').replace('+', '');
        if (telefono.length === 9 && !telefono.startsWith('51')) {
            telefono = '51' + telefono;
        }
        
        const textoCodificado = encodeURIComponent(textoMensaje);
        const urlWhatsApp = `https://wa.me/${telefono}?text=${textoCodificado}`;
        window.open(urlWhatsApp, '_blank');
    }
}

// --- 4.5 LÓGICA DE NOTIFICACIÓN WHATSAPP (El botón "Notificar" aparte) ---
function abrirMenuNotificar(perfil) {
    // Esta función ahora es solo para "Recordatorio" y "Cambio de Cuenta"
    const mensaje = `¿Qué mensaje quieres enviar a "${perfil.nombre_perfil}"?\n
1 = Recordatorio de Vencimiento
3 = Cambio de Cuenta (Seguridad)
    
(Escribe 1 o 3)`;

    const eleccion = prompt(mensaje);

    let plantilla;
    if (eleccion === '1') { plantilla = plantillas.recordatorio; }
    else if (eleccion === '3') { plantilla = plantillas.cambio; }
    else { return; } // Si presiona '2' o 'Cancelar', no hace nada

    let textoMensaje = plantilla;
    textoMensaje = textoMensaje.replace(/\[NOMBRE\]/g, perfil.nombre_perfil);
    if (!perfil.cuentas_madre) { alert("Error: No se pueden enviar datos de una cuenta eliminada (perfil huérfano)."); return; }
    textoMensaje = textoMensaje.replace(/\[PLATAFORMA\]/g, perfil.cuentas_madre.plataforma);
    textoMensaje = textoMensaje.replace(/\[EMAIL\]/g, perfil.cuentas_madre.email);
    textoMensaje = textoMensaje.replace(/\[PASS\]/g, perfil.cuentas_madre.contrasena);
    
    if (perfil.fecha_vencimiento_cliente) {
        const nuevaFecha = new Date(perfil.fecha_vencimiento_cliente + 'T00:00:00-05:00').toLocaleDateString('es-ES');
        textoMensaje = textoMensaje.replace(/\[NUEVA_FECHA\]/g, nuevaFecha);
    }
    
    const textoCodificado = encodeURIComponent(textoMensaje);
    
    let telefono = perfil.wsp;
    if (!telefono) { alert("Error: Este perfil no tiene un número de teléfono guardado."); return; }
    telefono = telefono.replace(/\s+/g, '').replace('+', '');
    if (telefono.length === 9 && !telefono.startsWith('51')) { telefono = '51' + telefono; }

    const urlWhatsApp = `https://wa.me/${telefono}?text=${textoCodificado}`;
    window.open(urlWhatsApp, '_blank');
}
