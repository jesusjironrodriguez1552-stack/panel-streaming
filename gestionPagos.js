// --- MÓDULO DE GESTIÓN DE PERFILES ---
import { supabase } from './supabaseClient.js'
// Importamos las funciones de utils
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
            cuentas_madre ( plataforma, email ) 
        `)
        .order('id', { ascending: false });

    if (error) {
        listElement.innerHTML = '<li>Error al cargar perfiles.</li>';
        console.error('Error cargando perfiles:', error);
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
        let estadoReal = perfil.estado; // Estado para mostrar

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
                estadoReal = 'vencido'; // Corregimos el estado visualmente
                estadoClass = 'estado-vencido';
                info = `¡Vencido! (Era de ${perfil.cuentas_madre ? perfil.cuentas_madre.plataforma : '???'})`;
            } else {
                 info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            }
        }
        
        // Convertimos la fecha a formato YYYY-MM-DD para el input[type=date]
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
                        Editar
                    </button>
                </div>
            </li>
        `;
    });

    // Añadir listeners para los nuevos botones de "Editar"
    document.querySelectorAll('.edit-perfil-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            abrirModalEditar(e.currentTarget.dataset);
        });
    });
}

// --- 4.2: LÓGICA DE EDITAR PERFIL (El Lápiz) ---

// Esta función se llamará desde main.js para activar el formulario del modal
export function initGestionPerfiles() {
    const editForm = document.getElementById('edit-perfil-form');
    if (editForm) {
        editForm.addEventListener('submit', guardarCambiosPerfil);
    }
    
    // Listener para el botón de cerrar modal
    document.querySelector('.modal-close').addEventListener('click', () => {
        document.getElementById('modal-editar-perfil').style.display = 'none';
    });
}

function abrirModalEditar(perfilData) {
    // Llenamos el formulario del modal con los datos del perfil
    document.getElementById('edit-perfil-id').value = perfilData.id;
    document.getElementById('edit-perfil-nombre').value = perfilData.nombre;
    document.getElementById('edit-perfil-estado').value = perfilData.estado;
    document.getElementById('edit-perfil-fecha').value = perfilData.fecha;
    
    // Mostramos el modal
    document.getElementById('modal-editar-perfil').style.display = 'flex';
}

async function guardarCambiosPerfil(e) {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true;
    button.textContent = 'Guardando...';

    // Leemos los datos actualizados del formulario
    const id = document.getElementById('edit-perfil-id').value;
    const nombre_perfil = document.getElementById('edit-perfil-nombre').value;
    const estado = document.getElementById('edit-perfil-estado').value;
    let fecha_vencimiento_cliente = document.getElementById('edit-perfil-fecha').value;

    // Si el estado es 'libre' o 'huerfano', la fecha no tiene sentido
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
        // Cerramos el modal
        document.getElementById('modal-editar-perfil').style.display = 'none';
        
        // ¡NUEVO! Disparamos un evento para que main.js refresque la vista
        window.dispatchEvent(new CustomEvent('refrescarVista'));
    }

    button.disabled = false;
    button.textContent = 'Guardar Cambios';
}


// --- 4.3: LÓGICA DE RESCATE DE HUÉRFANOS ---

// Esta es la función que llamará el botón "Asignar (Reactiva)"
export async function iniciarRescateHuerfano(cuentaMadre) {
    const { data: huerfanos, error } = await supabase
        .from('perfiles')
        .select('id, nombre_perfil')
        .eq('estado', 'huerfano');

    if (error) {
        alert('Error al buscar huérfanos: ' + error.message);
        return;
    }
    if (huerfanos.length === 0) {
        alert('¡Buenas noticias! No hay perfiles huérfanos para rescatar.');
        return;
    }

    // Construimos la lista de perfiles
    let listaHtml = '';
    huerfanos.forEach((huerfano, index) => {
        listaHtml += `
            <div>
                <input type="radio" name="huerfano_id" id="h_${huerfano.id}" value="${huerfano.id}" data-nombre="${huerfano.nombre_perfil}" ${index === 0 ? 'checked' : ''}>
                <label for="h_${huerfano.id}">${huerfano.nombre_perfil}</label>
            </div>
        `;
    });

    // Llenamos y mostramos el modal de rescate
    document.getElementById('modal-rescate-body').innerHTML = listaHtml;
    document.getElementById('modal-rescate').style.display = 'flex';

    // Preparamos el botón "Confirmar" para que sepa a qué cuenta asignar
    const confirmarBtn = document.getElementById('modal-rescate-confirmar');
    
    // Usamos .replaceWith(.cloneNode(true)) para limpiar listeners antiguos
    const nuevoBtn = confirmarBtn.cloneNode(true);
    confirmarBtn.parentNode.replaceChild(nuevoBtn, confirmarBtn);
    
    nuevoBtn.onclick = () => confirmarRescate(cuentaMadre);
    
    // Configuramos el botón de cerrar
    document.getElementById('modal-rescate-close').onclick = () => {
        document.getElementById('modal-rescate').style.display = 'none';
    };
}

async function confirmarRescate(cuentaMadre) {
    const seleccionado = document.querySelector('input[name="huerfano_id"]:checked');
    if (!seleccionado) {
        alert('Por favor, selecciona un perfil para rescatar.');
        return;
    }

    const perfilHuerfanoId = seleccionado.value;
    const perfilHuerfanoNombre = seleccionado.dataset.nombre;

    // Actualizamos el perfil huérfano
    const { error } = await supabase
        .from('perfiles')
        .update({
            cuenta_madre_id: cuentaMadre.id,
            estado: 'asignado'
            // IMPORTANTE: No tocamos su fecha de vencimiento original
        })
        .eq('id', perfilHuerfanoId);

    if (error) {
        alert('Error al rescatar el perfil: ' + error.message);
        return;
    }

    document.getElementById('modal-rescate').style.display = 'none';
    
    // Mostramos el mensaje para el cliente
    // (null en la fecha porque es reactivación)
    mostrarMensajeCliente(cuentaMadre, perfilHuerfanoNombre, null, 'reactiva');

    // ¡NUEVO! Disparamos un evento para que main.js refresque la vista
    window.dispatchEvent(new CustomEvent('refrescarVista'));
}
