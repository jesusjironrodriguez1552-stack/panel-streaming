//
// --- gestionPerfiles.js (COMPLETO, FINAL y con BOTÓN WHATSAPP) ---
//
import { supabase } from './supabaseClient.js'
// Importamos AMBAS funciones de utils.js
import { showMessage, mostrarMensajeCliente } from './utils.js'

// --- 1. PLANTILLAS MAESTRAS DE MENSAJES ---
// Aquí definimos tus 3 mensajes. El sistema los rellenará.
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

    if (error) {
        listElement.innerHTML = '<li>Error al cargar perfiles.</li>';
        console.error("Error cargando perfiles:", error);
        return;
    }
    if (perfiles.length === 0) {
        listElement.innerHTML = '<li>No hay perfiles en el sistema.</li>';
        return;
    }

    // --- Lógica de Agrupación ---
    const perfilesAgrupados = {};

    let vencidosCount = 0;
    let vencenHoyCount = 0;
    let vencenProntoCount = 0;
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const tresDias = new Date(hoy);
    tresDias.setDate(hoy.getDate() + 3);

    perfiles.forEach(perfil => {
        let grupo = 'Perfiles Huérfanos';
        if (perfil.cuentas_madre) {
            grupo = perfil.cuentas_madre.plataforma.toUpperCase();
        } else if (perfil.estado === 'libre' && perfil.cuentas_madre) {
             grupo = perfil.cuentas_madre.plataforma.toUpperCase() + " (Libres)";
        } else if (perfil.estado === 'libre') {
            grupo = 'Perfiles Libres (Sin Asignar)';
        }
        
        if (!perfilesAgrupados[grupo]) {
            perfilesAgrupados[grupo] = [];
        }
        perfilesAgrupados[grupo].push(perfil);
    });
    // --- Fin Lógica de Agrupación ---

    let htmlFinal = '';

    for (const grupo in perfilesAgrupados) {
        htmlFinal += `<h2 class="grupo-plataforma" data-grupo="${grupo}">${grupo}</h2>`;
        
        perfilesAgrupados[grupo].forEach(perfil => {
            let estadoClass = `estado-${perfil.estado}`;
            let info = '';
            let estadoReal = perfil.estado;
            let itemExtraClass = ''; 

            // Datos de la cuenta madre (si existen)
            const cuentaMadre = perfil.cuentas_madre;

            if (cuentaMadre) {
                info = `Email: ${cuentaMadre.email}`;
            } else if (perfil.estado === 'huerfano') {
                info = '¡CUENTA MADRE ELIMINADA!';
            } else if (perfil.estado === 'libre') {
                info = `Plataforma: ${cuentaMadre ? cuentaMadre.plataforma : '???'}`;
            }

            // --- Lógica de Vencimiento Mejorada ---
            if (perfil.estado === 'asignado') {
                const vence = new Date(perfil.fecha_vencimiento_cliente);
                
                if (vence < hoy) {
                    estadoReal = 'vencido';
                    estadoClass = 'estado-vencido';
                    info = `¡VENCIDO! (Desde ${vence.toLocaleDateString('es-ES')})`;
                    itemExtraClass = 'perfil-item-vencido';
                    vencidosCount++;
                
                } else if (vence.getTime() === hoy.getTime()) {
                    info = `¡¡VENCE HOY!!`;
                    itemExtraClass = 'perfil-item-hoy';
                    vencenHoyCount++;

                } else if (vence <= tresDias) {
                    info = `Vence pronto: ${vence.toLocaleDateString('es-ES')}`;
                    itemExtraClass = 'perfil-item-pronto';
                    vencenProntoCount++;

                } else {
                    info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                }
            }
            
            const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';

            // El botón de Renovar (+30 Días)
            const botonRenovar = (estadoReal === 'vencido') ?
                `<button class="btn-small renew-btn" data-id="${perfil.id}" data-fecha="${perfil.fecha_vencimiento_cliente}">
                    +30 Días
                 </button>` : '';
            
            // ¡NUEVO! Botón de Notificar (WhatsApp)
            // Aparece si el perfil tiene un número guardado
            const botonNotificar = (perfil.wsp && perfil.estado !== 'libre') ?
                `<button class="btn-small notify-btn" data-id="${perfil.id}">
                    💬 Notificar
                 </button>` : '';

            htmlFinal += `
                <li class="perfil-item ${itemExtraClass}" data-nombre="${perfil.nombre_perfil.toLowerCase()}">
                    <div>
                        <strong>${perfil.nombre_perfil}</strong> <br>
                        <small>${info}</small>
                    </div>
                    <div class="perfil-controles">
                        <span class="perfil-estado ${estadoClass}">${estadoReal.toUpperCase()}</span>
                        ${botonRenovar}
                        ${botonNotificar}
                        <button class="btn-small edit-perfil-btn" 
                            data-id="${perfil.id}"
                            data-nombre="${perfil.nombre_perfil}"
                            data-estado="${perfil.estado}"
                            data-fecha="${fechaParaInput}"
                            data-wsp="${perfil.wsp || ''}" 
                        >
                            ✏️ Editar
                        </button>
                    </div>
                </li>
            `;
        });
    }

    listElement.innerHTML = htmlFinal;

    // --- Actualizar el Resumen/Contador ---
    document.getElementById('perfiles-vencidos').textContent = vencidosCount;
    document.getElementById('perfiles-hoy').textContent = vencenHoyCount;
    document.getElementById('perfiles-pronto').textContent = vencenProntoCount;
    
    // --- Listeners para los botones ---
    document.querySelectorAll('.edit-perfil-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            abrirModalEditar(e.currentTarget.dataset);
        });
    });

    document.querySelectorAll('.renew-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const fechaActual = e.currentTarget.dataset.fecha;
            renovarPerfil(id, fechaActual);
        });
    });

    // ¡NUEVO! Listener para el botón de Notificar
    document.querySelectorAll('.notify-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            // Volvemos a pedir los datos para tener la info más fresca
            const { data: perfil } = await supabase
                .from('perfiles')
                .select(`*, cuentas_madre(*)`)
                .eq('id', id)
                .single();
                
            abrirMenuNotificar(perfil);
        });
    });


    // --- Pop-up de Advertencia Persistente ---
    let alertMessage = '';
    if (vencidosCount > 0) {
        alertMessage += `¡ATENCIÓN!\n\nTienes ${vencidosCount} perfiles VENCIDOS.\n`;
    }
    if (vencenHoyCount > 0) {
        alertMessage += `Tienes ${vencenHoyCount} perfiles que vencen HOY.\n`;
    }
    if (vencenProntoCount > 0 && vencenHoyCount === 0) {
         alertMessage += `Tienes ${vencenProntoCount} perfiles que vencen en los próximos 3 días.\n`;
    }

    if (alertMessage) {
        alert(alertMessage + "\nRevisa la lista de perfiles marcados en color.");
    }
}

// --- 4.2: LÓGICA DE EDITAR, MODALS Y BÚSQUEDA ---
export function initGestionPerfiles() {
    // Listener para el modal de Editar
    const editForm = document.getElementById('edit-perfil-form');
    if (editForm) {
        editForm.addEventListener('submit', guardarCambiosPerfil);
    }
    
    // Listeners para cerrar los modals
    const editCloseBtn = document.getElementById('modal-edit-close');
    if(editCloseBtn) {
        editCloseBtn.addEventListener('click', () => {
            document.getElementById('modal-editar-perfil').style.display = 'none';
        });
    }
    const rescateCloseBtn = document.getElementById('modal-rescate-close');
    if(rescateCloseBtn) {
        rescateCloseBtn.addEventListener('click', () => {
            document.getElementById('modal-rescate').style.display = 'none';
        });
    }

    // Listener para la Barra de Búsqueda
    const searchInput = document.getElementById('perfiles-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarListaPerfiles);
    }
}

// Función de Búsqueda/Filtrado
function filtrarListaPerfiles(e) {
    const textoBusqueda = e.target.value.toLowerCase();
    const grupos = document.querySelectorAll('.grupo-plataforma');

    grupos.forEach(grupo => {
        let grupoVisible = false;
        let siguienteElemento = grupo.nextElementSibling;
        while(siguienteElemento && siguienteElemento.tagName === 'LI') {
            const nombrePerfil = siguienteElemento.dataset.nombre;
            if (nombrePerfil.includes(textoBusqueda)) {
                siguienteElemento.style.display = 'flex';
                grupoVisible = true;
            } else {
                siguienteElemento.style.display = 'none';
            }
            siguienteElemento = siguienteElemento.nextElementSibling;
        }

        if (grupoVisible) {
            grupo.style.display = 'block';
        } else {
            grupo.style.display = 'none';
        }
    });
}


// ¡MODIFICADO! Ahora también rellena el teléfono
function abrirModalEditar(perfilData) {
    document.getElementById('edit-perfil-id').value = perfilData.id;
    document.getElementById('edit-perfil-nombre').value = perfilData.nombre;
    document.getElementById('edit-perfil-estado').value = perfilData.estado;
    document.getElementById('edit-perfil-fecha').value = perfilData.fecha;
    document.getElementById('edit-perfil-telefono').value = perfilData.wsp; // <-- ¡NUEVO!
    
    document.getElementById('modal-editar-perfil').style.display = 'flex';
}

// ¡MODIFICADO! Ahora también guarda el teléfono
async function guardarCambiosPerfil(e) {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true;
    button.textContent = 'Guardando...';

    const id = document.getElementById('edit-perfil-id').value;
    const nombre_perfil = document.getElementById('edit-perfil-nombre').value;
    const estado = document.getElementById('edit-perfil-estado').value;
    const wsp = document.getElementById('edit-perfil-telefono').value; // <-- ¡NUEVO!
    let fecha_vencimiento_cliente = document.getElementById('edit-perfil-fecha').value;

    if (estado === 'libre' || estado === 'huerfano') {
        fecha_vencimiento_cliente = null;
    }

    const { error } = await supabase
        .from('perfiles')
        .update({
            nombre_perfil: nombre_perfil,
            estado: estado,
            fecha_vencimiento_cliente: fecha_vencimiento_cliente,
            wsp: wsp // <-- ¡NUEVO!
        })
        .eq('id', id);

    if (error) {
        alert('Error al guardar cambios: ' + error.message);
    } else {
        document.getElementById('modal-editar-perfil').style.display = 'none';
        window.dispatchEvent(new CustomEvent('refrescarVista'));
    }

    button.disabled = false;
    button.textContent = 'Guardar Cambios';
}

// --- 4.3: LÓGICA DE RESCATE DE HUÉRFANOS (Sin cambios) ---
export async function iniciarRescateHuerfano(cuentaMadre) {
    const { data: huerfanos, error } = await supabase
        .from('perfiles')
        .select('id, nombre_perfil, fecha_vencimiento_cliente')
        .eq('estado', 'huerfano');
    if (error) { /* ... */ }
    if (huerfanos.length === 0) { /* ... */ }

    let listaHtml = '';
    huerfanos.forEach((huerfano, index) => {
        const fechaISO = huerfano.fecha_vencimiento_cliente ? new Date(huerfano.fecha_vencimiento_cliente).toISOString() : '';
        listaHtml += `
            <div class="huerfano-option">
                <input type="radio" name="huerfano_id" id="h_${huerfano.id}" 
                       value="${huerfano.id}" data-nombre="${huerfano.nombre_perfil}" data-fecha="${fechaISO}"
                       ${index === 0 ? 'checked' : ''}>
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

    const { data: perfilLibre, error: findError } = await supabase
        .from('perfiles').select('id').eq('cuenta_madre_id', cuentaMadre.id).eq('estado', 'libre').limit(1).single();
    if (findError || !perfilLibre) {
        alert(`¡Error! Esta cuenta madre no tiene perfiles libres para realizar el rescate.`);
        return;
    }

    const perfilHuerfanoId = seleccionado.value;
    const perfilHuerfanoNombre = seleccionado.dataset.nombre;
    const perfilHuerfanoFecha = seleccionado.dataset.fecha ? new Date(seleccionado.dataset.fecha).toISOString() : null;

    const { error: updateError } = await supabase
        .from('perfiles').update({
            nombre_perfil: perfilHuerfanoNombre,
            estado: 'asignado',
            fecha_vencimiento_cliente: perfilHuerfanoFecha
        }).eq('id', perfilLibre.id); 
    if (updateError) { /* ... */ }

    await supabase.from('perfiles').delete().eq('id', perfilHuerfanoId);

    document.getElementById('modal-rescate').style.display = 'none';
    mostrarMensajeCliente(cuentaMadre, perfilHuerfanoNombre, null, 'reactiva');
    window.dispatchEvent(new CustomEvent('refrescarVista'));
}


// --- 4.4 LÓGICA DE RENOVACIÓN (Sin cambios) ---
async function renovarPerfil(id, fechaActualISO) {
    let fechaBase;
    if (fechaActualISO && fechaActualISO !== 'null' && fechaActualISO !== 'undefined') {
        fechaBase = new Date(fechaActualISO);
    } else {
        fechaBase = new Date();
    }
    fechaBase.setHours(0, 0, 0, 0);
    fechaBase.setDate(fechaBase.getDate() + 30);
    
    const nuevaFecha = fechaBase.toISOString();
    const nuevaFechaFormateada = fechaBase.toLocaleDateString('es-ES');

    if (!confirm(`Se usará la fecha de vencimiento original como base.\n\nNuevo vencimiento: ${nuevaFechaFormateada}\n¿Confirmar renovación?`)) {
        return;
    }

    const { error } = await supabase
        .from('perfiles').update({ 
            fecha_vencimiento_cliente: nuevaFecha,
            estado: 'asignado'
        }).eq('id', id);

    if (error) {
        alert('Error al renovar el perfil: ' + error.message);
    } else {
        window.dispatchEvent(new CustomEvent('refrescarVista'));
    }
}

// --- 4.5 ¡NUEVA SECCIÓN! LÓGICA DE NOTIFICACIÓN WHATSAPP ---

function abrirMenuNotificar(perfil) {
    // 1. Preguntamos al usuario qué quiere hacer
    const mensaje = `¿Qué mensaje quieres enviar a "${perfil.nombre_perfil}"?\n
1 = Recordatorio de Vencimiento
2 = Agradecimiento por Renovación
3 = Cambio de Cuenta (Seguridad)
    
(Escribe 1, 2 o 3)`;

    const eleccion = prompt(mensaje);

    // 2. Elegimos la plantilla
    let plantilla;
    if (eleccion === '1') {
        plantilla = plantillas.recordatorio;
    } else if (eleccion === '2') {
        plantilla = plantillas.gracias;
    } else if (eleccion === '3') {
        plantilla = plantillas.cambio;
    } else {
        return; // El usuario canceló o puso algo inválido
    }

    // 3. Rellenamos la plantilla con los datos del perfil
    let textoMensaje = plantilla;
    
    // Datos básicos
    textoMensaje = textoMensaje.replace(/\[NOMBRE\]/g, perfil.nombre_perfil);
    textoMensaje = textoMensaje.replace(/\[PLATAFORMA\]/g, perfil.cuentas_madre.plataforma);
    
    // Datos de cuenta (para plantilla de cambio)
    textoMensaje = textoMensaje.replace(/\[EMAIL\]/g, perfil.cuentas_madre.email);
    textoMensaje = textoMensaje.replace(/\[PASS\]/g, perfil.cuentas_madre.contrasena);
    
    // Datos de fecha (para plantilla de gracias)
    if (perfil.fecha_vencimiento_cliente) {
        const nuevaFecha = new Date(perfil.fecha_vencimiento_cliente).toLocaleDateString('es-ES');
        textoMensaje = textoMensaje.replace(/\[NUEVA_FECHA\]/g, nuevaFecha);
    }
    
    // 4. Generamos y abrimos el link de WhatsApp
    // Usamos encodeURIComponent para que los espacios y saltos de línea funcionen
    const textoCodificado = encodeURIComponent(textoMensaje);
    const telefono = perfil.wsp; // El número ya debe incluir el código de país (ej: 51...)

    if (!telefono) {
        alert("Error: Este perfil no tiene un número de teléfono guardado.");
        return;
    }

    const urlWhatsApp = `https://wa.me/${telefono}?text=${textoCodificado}`;
    
    // Abrimos el link en una pestaña nueva
    window.open(urlWhatsApp, '_blank');
}
