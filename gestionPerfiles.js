//
// --- gestionPerfiles.js (NUEVA VERSIÓN CON GRUPOS Y RENOVACIÓN) ---
//
import { supabase } from './supabaseClient.js'
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

    // --- ¡NUEVO! Lógica de Agrupación ---
    const perfilesAgrupados = {};

    let vencidosCount = 0;
    let vencenProntoCount = 0;
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const tresDias = new Date(hoy);
    tresDias.setDate(hoy.getDate() + 3);

    perfiles.forEach(perfil => {
        // 1. Determinar el grupo
        let grupo = 'Perfiles Huérfanos'; // Default
        if (perfil.cuentas_madre) {
            grupo = perfil.cuentas_madre.plataforma.toUpperCase();
        } else if (perfil.estado === 'libre' && perfil.cuentas_madre) {
             grupo = perfil.cuentas_madre.plataforma.toUpperCase() + " (Libres)";
        } else if (perfil.estado === 'libre') {
            grupo = 'Perfiles Libres (Sin Asignar)';
        }
        
        // 2. Crear el array del grupo si no existe
        if (!perfilesAgrupados[grupo]) {
            perfilesAgrupados[grupo] = [];
        }

        // 3. Añadir el perfil al grupo
        perfilesAgrupados[grupo].push(perfil);
    });

    // --- Fin Lógica de Agrupación ---

    let htmlFinal = ''; // Aquí construiremos todo el HTML

    // Recorremos el objeto de grupos
    for (const grupo in perfilesAgrupados) {
        // Añadimos el título del grupo
        htmlFinal += `<h2 class="grupo-plataforma">${grupo}</h2>`;
        
        // Recorremos los perfiles de ese grupo
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
                    vencidosCount++;
                
                } else if (vence.getTime() === hoy.getTime()) {
                    info = `¡¡VENCE HOY!!`;
                    itemExtraClass = 'perfil-item-hoy';
                    vencenProntoCount++;

                } else if (vence <= tresDias) {
                    info = `Vence pronto: ${vence.toLocaleDateString('es-ES')}`;
                    itemExtraClass = 'perfil-item-pronto';
                    vencenProntoCount++;

                } else {
                    info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                }
            }
            
            const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';

            // ¡NUEVO! Botón de Renovar (+30 Días)
            // Solo aparece si el perfil está 'asignado' o 'vencido'
            const botonRenovar = (perfil.estado === 'asignado' || estadoReal === 'vencido') ?
                `<button class="btn-small renew-btn" data-id="${perfil.id}" data-fecha="${perfil.fecha_vencimiento_cliente}">
                    +30 Días
                 </button>` : '';

            htmlFinal += `
                <li class="perfil-item ${itemExtraClass}">
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

    // Finalmente, inyectamos todo el HTML
    listElement.innerHTML = htmlFinal;

    // --- Añadir Listeners para los botones ---
    document.querySelectorAll('.edit-perfil-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            abrirModalEditar(e.currentTarget.dataset);
        });
    });

    // ¡NUEVO! Listener para el botón de Renovar
    document.querySelectorAll('.renew-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const fechaActual = e.currentTarget.dataset.fecha;
            renovarPerfil(id, fechaActual); // Llamamos a la nueva función
        });
    });

    // --- Pop-up de Advertencia ---
    if (!sessionStorage.getItem('alertaVencimientoMostrada')) {
        let alertMessage = '';
        if (vencidosCount > 0) {
            alertMessage += `¡ATENCIÓN!\n\nTienes ${vencidosCount} perfiles VENCIDOS.\n`;
        }
        if (vencenProntoCount > 0) {
            alertMessage += `Tienes ${vencenProntoCount} perfiles que vencen HOY o en los próximos 3 días.\n`;
        }

        if (alertMessage) {
            alert(alertMessage + "\nRevisa la lista de perfiles marcados en color.");
            sessionStorage.setItem('alertaVencimientoMostrada', 'true');
        }
    }
}

// --- 4.2: LÓGICA DE EDITAR PERFIL (El Lápiz) ---
// (Esta sección no cambia)
export function initGestionPerfiles() {
    const editForm = document.getElementById('edit-perfil-form');
    if (editForm) {
        editForm.addEventListener('submit', guardarCambiosPerfil);
    }
    
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
}

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


// --- 4.3: LÓGICA DE RESCATE DE HUÉRFANOS ---
// (Esta sección no cambia, pero la incluimos por si acaso)
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

    // 1. Encontrar un perfil LIBRE en la cuenta "buena"
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

    // 2. Obtener los datos del huérfano
    const perfilHuerfanoId = seleccionado.value;
    const perfilHuerfanoNombre = seleccionado.dataset.nombre;
    const perfilHuerfanoFecha = seleccionado.dataset.fecha ? new Date(seleccionado.dataset.fecha).toISOString() : null;

    // 3. ACTUALIZAR el perfil LIBRE con los datos del huérfano
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

    // 4. BORRAR el perfil huérfano
    await supabase
        .from('perfiles')
        .delete()
        .eq('id', perfilHuerfanoId);

    // 5. Refrescar
    document.getElementById('modal-rescate').style.display = 'none';
    mostrarMensajeCliente(cuentaMadre, perfilHuerfanoNombre, null, 'reactiva');
    window.dispatchEvent(new CustomEvent('refrescarVista'));
}


// --- 4.4 ¡NUEVA FUNCIÓN DE RENOVACIÓN! ---
async function renovarPerfil(id, fechaActualISO) {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    let fechaBase;

    if (fechaActualISO) {
        const fechaActual = new Date(fechaActualISO);
        // Si la fecha actual es *anterior* a hoy (o sea, está vencido)
        // la nueva base es HOY.
        if (fechaActual < hoy) {
            fechaBase = hoy;
        } else {
            // Si no, la base es la fecha actual (renovación anticipada)
            fechaBase = fechaActual;
        }
    } else {
        // Si no tiene fecha (ej. un perfil vencido de alguna forma rara), usa hoy
        fechaBase = hoy;
    }

    // Sumamos 30 días a la fecha base
    fechaBase.setDate(fechaBase.getDate() + 30);
    const nuevaFecha = fechaBase.toISOString();

    if (!confirm(`¿Renovar este perfil hasta el ${fechaBase.toLocaleDateString('es-ES')}?`)) {
        return;
    }

    // Actualizamos la fecha y nos aseguramos que el estado sea 'asignado'
    const { error } = await supabase
        .from('perfiles')
        .update({ 
            fecha_vencimiento_cliente: nuevaFecha,
            estado: 'asignado' // Importante por si estaba 'vencido'
        })
        .eq('id', id);

    if (error) {
        alert('Error al renovar el perfil: ' + error.message);
    } else {
        // Refrescamos la vista para que se actualice la lista
        window.dispatchEvent(new CustomEvent('refrescarVista'));
    }
}
