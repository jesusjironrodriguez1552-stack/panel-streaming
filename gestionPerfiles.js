//
// --- gestionPerfiles.js (CORREGIDO CON CONSUMO DE PERFIL) ---
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

    listElement.innerHTML = '';
    perfiles.forEach(perfil => {
        let estadoClass = `estado-${perfil.estado}`;
        let info = '';
        let estadoReal = perfil.estado; 

        if (perfil.cuentas_madre) {
            info = `Plataforma: ${perfil.cuentas_madre.plataforma}`;
        } else if (perfil.estado === 'huerfano') {
            info = '¡CUENTA MADRE ELIMINADA!';
        } else if (perfil.estado === 'libre') {
            info = `Plataforma: ${perfil.cuentas_madre ? perfil.cuentas_madre.plataforma : '???'}`;
        }

        if (perfil.estado === 'asignado') {
            const vence = new Date(perfil.fecha_vencimiento_cliente);
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            
            if (vence < hoy) {
                estadoReal = 'vencido'; 
                estadoClass = 'estado-vencido';
                info = `¡Vencido! (Era de ${perfil.cuentas_madre ? perfil.cuentas_madre.plataforma : '???'})`;
            } else {
                 info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            }
        }
        
        const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';

        listElement.innerHTML += `
            <li class="perfil-item">
                <div>
                    <strong>${perfil.nombre_perfil}</strong> <br>
                    <small>${info}</small>
                </div>
                <div class="perfil-controles">
                    <span class="perfil-estado ${estadoClass}">${estadoReal.toUpperCase()}</span>
                    
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

    document.querySelectorAll('.edit-perfil-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            abrirModalEditar(e.currentTarget.dataset);
        });
    });
}

// --- 4.2: LÓGICA DE EDITAR PERFIL (El Lápiz) ---
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


// --- 4.3: LÓGICA DE RESCATE DE HUÉRFANOS (¡CORREGIDA!) ---
export async function iniciarRescateHuerfano(cuentaMadre) {
    
    // 1. Buscar perfiles huérfanos
    // ¡CORRECCIÓN! También traemos la fecha de vencimiento
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

    // 2. Construir la lista de opciones para el modal
    let listaHtml = '';
    huerfanos.forEach((huerfano, index) => {
        // ¡CORRECCIÓN! Guardamos también la fecha en el 'data-fecha'
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

    // 3. Llenar y mostrar el modal
    document.getElementById('modal-rescate-body').innerHTML = listaHtml;
    document.getElementById('modal-rescate').style.display = 'flex';

    // 4. Preparar el botón "Confirmar"
    const confirmarBtn = document.getElementById('modal-rescate-confirmar');
    const nuevoBtn = confirmarBtn.cloneNode(true);
    confirmarBtn.parentNode.replaceChild(nuevoBtn, confirmarBtn);
    nuevoBtn.onclick = () => confirmarRescate(cuentaMadre);
}


// Se ejecuta al hacer clic en "Confirmar Rescate"
async function confirmarRescate(cuentaMadre) {
    const seleccionado = document.querySelector('input[name="huerfano_id"]:checked');
    if (!seleccionado) {
        alert('Por favor, selecciona un perfil para rescatar.');
        return;
    }

    // --- ¡NUEVA LÓGICA DE CONSUMO! ---

    // 1. Encontrar un perfil LIBRE en la cuenta "buena"
    const { data: perfilLibre, error: findError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('cuenta_madre_id', cuentaMadre.id)
        .eq('estado', 'libre')
        .limit(1)
        .single();

    if (findError || !perfilLibre) {
        alert('¡Error! Esta cuenta madre ("${cuentaMadre.plataforma} / ${cuentaMadre.email}") no tiene perfiles libres para realizar el rescate.');
        return;
    }

    // 2. Obtener los datos del huérfano que seleccionamos
    const perfilHuerfanoId = seleccionado.value;
    const perfilHuerfanoNombre = seleccionado.dataset.nombre;
    // ¡CORRECCIÓN! Obtenemos la fecha (puede ser null si no había)
    const perfilHuerfanoFecha = seleccionado.dataset.fecha ? new Date(seleccionado.dataset.fecha).toISOString() : null;

    // 3. ACTUALIZAR el perfil LIBRE con los datos del huérfano
    const { error: updateError } = await supabase
        .from('perfiles')
        .update({
            nombre_perfil: perfilHuerfanoNombre,
            estado: 'asignado',
            fecha_vencimiento_cliente: perfilHuerfanoFecha
        })
        .eq('id', perfilLibre.id); // ¡Actualizamos el perfil LIBRE!

    if (updateError) {
        alert('Error al actualizar el perfil libre: ' + updateError.message);
        return;
    }

    // 4. BORRAR el perfil huérfano (ya no lo necesitamos)
    await supabase
        .from('perfiles')
        .delete()
        .eq('id', perfilHuerfanoId);

    // 5. Cerrar modal, mostrar mensaje y refrescar
    document.getElementById('modal-rescate').style.display = 'none';
    mostrarMensajeCliente(cuentaMadre, perfilHuerfanoNombre, null, 'reactiva');
    window.dispatchEvent(new CustomEvent('refrescarVista'));
}
