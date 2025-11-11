//
// --- gestionPerfiles.js (COMPLETO, FINAL Y CON BÚSQUEDA) ---
//
import { supabase } from './supabaseClient.js'
// Importamos AMBAS funciones de utils.js
import { showMessage, mostrarMensajeCliente } from './utils.js'

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

    // --- ¡NUEVO! Contadores para el Resumen ---
    let vencidosCount = 0;
    let vencenHoyCount = 0;
    let vencenProntoCount = 0;
    // ---
    
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
        // ¡NUEVO! Añadimos el 'data-grupo' para la búsqueda
        htmlFinal += `<h2 class="grupo-plataforma" data-grupo="${grupo}">${grupo}</h2>`;
        
        perfilesAgrupados[grupo].forEach(perfil => {
            let estadoClass = `estado-${perfil.estado}`;
            let info = '';
            let estadoReal = perfil.estado;
            let itemExtraClass = ''; 

            if (perfil.cuentas_madre) {
                info = `Email: ${perfil.cuentas_madre.email}`;
            } else if (perfil.estado === 'huerfano') {
                info = '¡CUENTA MADRE ELIMINADA!';
            } else if (perfil.estado === 'libre') {
                info = `Plataforma: ${perfil.cuentas_madre ? perfil.cuentas_madre.plataforma : '???'}`;
            }

            // --- Lógica de Vencimiento Mejorada ---
            if (perfil.estado === 'asignado') {
                const vence = new Date(perfil.fecha_vencimiento_cliente);
                
                if (vence < hoy) {
                    estadoReal = 'vencido';
                    estadoClass = 'estado-vencido';
                    info = `¡VENCIDO! (Desde ${vence.toLocaleDateString('es-ES')})`;
                    itemExtraClass = 'perfil-item-vencido';
                    vencidosCount++; // <-- Suma al contador
                
                } else if (vence.getTime() === hoy.getTime()) {
                    info = `¡¡VENCE HOY!!`;
                    itemExtraClass = 'perfil-item-hoy';
                    vencenHoyCount++; // <-- Suma al contador
                
                } else if (vence <= tresDias) {
                    info = `Vence pronto: ${vence.toLocaleDateString('es-ES')}`;
                    itemExtraClass = 'perfil-item-pronto';
                    vencenProntoCount++; // <-- Suma al contador
                
                } else {
                    info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                }
            }
            
            const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';

            // El botón de Renovar (+30 Días)
            // Solo aparece si el perfil está 'vencido'
            const botonRenovar = (estadoReal === 'vencido') ?
                `<button class="btn-small renew-btn" data-id="${perfil.id}" data-fecha="${perfil.fecha_vencimiento_cliente}">
                    +30 Días
                 </button>` : '';

            // ¡NUEVO! Añadimos 'data-nombre' para la búsqueda
            htmlFinal += `
                <li class="perfil-item ${itemExtraClass}" data-nombre="${perfil.nombre_perfil.toLowerCase()}">
                    <div>
                        <strong>${perfil.nombre_perfil}</strong> <br>
                        <small>${info}</small>
                    </div>
                    <div class="perfil-controles">
                        <span class="perfil-estado ${estadoClass}">${estadoReal.toUpperCase()}</span>
                        ${botonRenovar}
                        <button class="btn-small edit-perfil-btn" 
                            data-id="${perfil.id}"
                            data-nombre="${perfil.nombre_perfil}"
                            data-estado="${perfil.estado}"
                            data-fecha="${fechaParaInput}"
                        >
                            ✏️ Editar
                        </button>
                    </div>
                </li>
            `;
        });
    }

    listElement.innerHTML = htmlFinal;

    // --- ¡NUEVO! Actualizar el Resumen/Contador ---
    document.getElementById('perfiles-vencidos').textContent = vencidosCount;
    document.getElementById('perfiles-hoy').textContent = vencenHoyCount;
    document.getElementById('perfiles-pronto').textContent = vencenProntoCount;
    // --- Fin del Resumen ---

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

    // --- ¡NUEVO! Pop-up de Advertencia Persistente ---
    // (Ya no usa sessionStorage)
    let alertMessage = '';
    if (vencidosCount > 0) {
        alertMessage += `¡ATENCIÓN!\n\nTienes ${vencidosCount} perfiles VENCIDOS.\n`;
    }
    if (vencenHoyCount > 0) {
        alertMessage += `Tienes ${vencenHoyCount} perfiles que vencen HOY.\n`;
    }
    if (vencenProntoCount > 0 && vencenHoyCount === 0) { // No repetir si ya avisamos de hoy
         alertMessage += `Tienes ${vencenProntoCount} perfiles que vencen en los próximos 3 días.\n`;
    }

    if (alertMessage) {
        alert(alertMessage + "\nRevisa la lista de perfiles marcados en color.");
    }
    // --- Fin del Pop-up ---
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

    // --- ¡NUEVO! Listener para la Barra de Búsqueda ---
    const searchInput = document.getElementById('perfiles-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarListaPerfiles);
    }
}

// --- ¡NUEVA! Función de Búsqueda/Filtrado ---
function filtrarListaPerfiles(e) {
    const textoBusqueda = e.target.value.toLowerCase();
    const grupos = document.querySelectorAll('.grupo-plataforma');

    grupos.forEach(grupo => {
        let grupoVisible = false;
        // Obtenemos los 'li' que están entre este 'h2' y el siguiente 'h2'
        let siguienteElemento = grupo.nextElementSibling;
        while(siguienteElemento && siguienteElemento.tagName === 'LI') {
            const nombrePerfil = siguienteElemento.dataset.nombre;
            if (nombrePerfil.includes(textoBusqueda)) {
                siguienteElemento.style.display = 'flex';
                grupoVisible = true; // Si al menos un hijo es visible, el grupo es visible
            } else {
                siguienteElemento.style.display = 'none';
            }
            siguienteElemento = siguienteElemento.nextElementSibling;
        }

        // Si ningún perfil del grupo coincide, ocultamos el título del grupo
        if (grupoVisible) {
            grupo.style.display = 'block';
        } else {
            grupo.style.display = 'none';
        }
    });
}


// --- (El resto de funciones no cambian) ---

function abrirModalEditar(perfilData) {
    document.getElementById('edit-perfil-id').value = perfilData.id;
    document.getElementById('edit-perfil-nombre').value = perfilData.nombre;
    document.getElementById('edit-perfil-estado').value = perfilData.estado;
    document.getElementById('edit-perfil-fecha').value = perfilData.fecha;
    
    document.getElementById('modal-editar-perfil').style.display = 'flex';
}

async function guardarCambiosPerfil(e) {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true;
    button.textContent = 'Guardando...';

    const id = document.getElementById('edit-perfil-id').value;
    const nombre_perfil = document.getElementById('edit-perfil-nombre').value;
    const estado = document.getElementById('edit-perfil-estado').value;
    let fecha_vencimiento_cliente = document.getElementById('edit-perfil-fecha').value;

    if (estado === 'libre' || estado === 'huerfano') {
        fecha_vencimiento_cliente = null;
    }

    const { error } = await supabase
        .from('perfiles')
        .update({
            nombre_perfil: nombre_perfil,
            estado: estado,
            fecha_vencimiento_cliente: fecha_vencimiento_cliente
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

export async function iniciarRescateHuerfano(cuentaMadre) {
    
    const { data: huerfanos, error } = await supabase
        .from('perfiles')
        .select('id, nombre_perfil, fecha_vencimiento_cliente')
        .eq('estado', 'huerfano');

    if (error) {
        alert('Error al buscar huérfanos: ' + error.message);
        return;
    }
    if (huerfanos.length === 0) {
        alert('¡Buenas noticias! No hay perfiles huérfanos para rescatar.');
        return;
    }

    let listaHtml = '';
    huerfanos.forEach((huerfano, index) => {
        const fechaISO = huerfano.fecha_vencimiento_cliente ? new Date(huerfano.fecha_vencimiento_cliente).toISOString() : '';
        listaHtml += `
            <div class="huerfano-option">
                <input type="radio" name="huerfano_id" id="h_${huerfano.id}" 
                       value="${huerfano.id}" 
                       data-nombre="${huerfano.nombre_perfil}"
                       data-fecha="${fechaISO}"
                       ${index === 0 ? 'checked' : ''}>
                <label for="h_${huerfano.id}">${huerfano.nombre_perfil}</label>
            </div>
        `;
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
    if (!seleccionado) {
        alert('Por favor, selecciona un perfil para rescatar.');
        return;
    }

    const { data: perfilLibre, error: findError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('cuenta_madre_id', cuentaMadre.id)
        .eq('estado', 'libre')
        .limit(1)
        .single();

    if (findError || !perfilLibre) {
        alert(`¡Error! Esta cuenta madre ("${cuentaMadre.plataforma} / ${cuentaMadre.email}") no tiene perfiles libres para realizar el rescate.`);
        return;
    }

    const perfilHuerfanoId = seleccionado.value;
    const perfilHuerfanoNombre = seleccionado.dataset.nombre;
    const perfilHuerfanoFecha = seleccionado.dataset.fecha ? new Date(seleccionado.dataset.fecha).toISOString() : null;

    const { error: updateError } = await supabase
        .from('perfiles')
        .update({
            nombre_perfil: perfilHuerfanoNombre,
            estado: 'asignado',
            fecha_vencimiento_cliente: perfilHuerfanoFecha
        })
        .eq('id', perfilLibre.id); 

    if (updateError) {
        alert('Error al actualizar el perfil libre: ' + updateError.message);
        return;
    }

    await supabase
        .from('perfiles')
        .delete()
        .eq('id', perfilHuerfanoId);

    document.getElementById('modal-rescate').style.display = 'none';
    mostrarMensajeCliente(cuentaMadre, perfilHuerfanoNombre, null, 'reactiva');
    window.dispatchEvent(new CustomEvent('refrescarVista'));
}

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
        .from('perfiles')
        .update({ 
            fecha_vencimiento_cliente: nuevaFecha,
            estado: 'asignado'
        })
        .eq('id', id);

    if (error) {
        alert('Error al renovar el perfil: ' + error.message);
    } else {
        window.dispatchEvent(new CustomEvent('refrescarVista'));
    }
}
