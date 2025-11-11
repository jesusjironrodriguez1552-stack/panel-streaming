//
// --- gestionCuentas.js (VERSIÓN FINAL CORREGIDA) ---
//
import { supabase } from './supabaseClient.js'
// Importamos las funciones de 'utils.js' que este módulo necesita
import { showMessage, mostrarMensajeCliente } from './utils.js'

// Importamos la función de perfiles para poder refrescarla
import { cargarTodosLosPerfiles } from './gestionPerfiles.js'

// Esta variable guardará la función de "rescate" que 'main.js' nos pasa.
let _onReactivaClick = null;

// --- 3.1: INICIALIZACIÓN Y RESUMEN DE STOCK ---

export function initGestionCuentas() {
    const stockForm = document.getElementById('stock-form');
    if (stockForm) {
        stockForm.addEventListener('submit', guardarNuevaCuenta);
    }
}

async function actualizarResumenStock() {
    const { data: perfiles, error } = await supabase
        .from('perfiles')
        .select('estado');

    if (error) return;

    const libres = perfiles.filter(p => p.estado === 'libre').length;
    const ocupados = perfiles.filter(p => p.estado === 'asignado' || p.estado === 'huerfano' || p.estado === 'vencido').length;

    const libresEl = document.getElementById('stock-libres');
    const ocupadosEl = document.getElementById('stock-ocupados');
    
    if (libresEl) libresEl.textContent = libres;
    if (ocupadosEl) ocupadosEl.textContent = ocupados;
}

// --- 3.2: LÓGICA DEL FORMULARIO (Guardar) ---

async function guardarNuevaCuenta(e) {
    e.preventDefault(); 
    const button = e.target.querySelector('button');
    button.disabled = true;
    button.textContent = 'Guardando...';

    const plataforma = document.getElementById('plataforma-input').value;
    const email = document.getElementById('email-input').value;
    const contrasena = document.getElementById('password-input').value;
    const cantidadPerfiles = parseInt(document.getElementById('perfiles-input').value);
    const fechaPago = document.getElementById('fecha-proveedor-input').value;

    const { data: cuentaMadre, error: errorMadre } = await supabase
        .from('cuentas_madre')
        .insert({ 
            plataforma: plataforma,
            email: email, 
            contrasena: contrasena, 
            fecha_pago_proveedor: fechaPago,
            estado: 'activa' // Siempre se crea como 'activa'
        })
        .select('id')
        .single();

    if (errorMadre) {
        showMessage('form-message', 'Error: ' + errorMadre.message, false);
        button.disabled = false;
        button.textContent = 'Guardar Cuenta';
        return;
    }

    const nuevaCuentaMadreId = cuentaMadre.id;
    const perfilesParaInsertar = [];
    
    for (let i = 1; i <= cantidadPerfiles; i++) {
        perfilesParaInsertar.push({
            cuenta_madre_id: nuevaCuentaMadreId,
            nombre_perfil: `Perfil Libre ${i}`,
            estado: 'libre',
            fecha_vencimiento_cliente: null
        });
    }

    const { error: errorPerfiles } = await supabase
        .from('perfiles')
        .insert(perfilesParaInsertar);

    if (errorPerfiles) {
        showMessage('form-message', 'Error creando perfiles: ' + errorPerfiles.message, false);
    } else {
        showMessage('form-message', '¡Cuenta y perfiles guardados con éxito!', true);
        document.getElementById('stock-form').reset();
        cargarCuentasMadre(); // Recargamos la lista
    }
    
    button.disabled = false;
    button.textContent = 'Guardar Cuenta';
}

// --- 3.3: LÓGICA DE LA LISTA (Cargar, Asignar, Borrar) ---

export async function cargarCuentasMadre(onReactivaClick) {
    
    // Si recibimos la función de reactivación, la guardamos
    if (onReactivaClick) {
        _onReactivaClick = onReactivaClick;
    }
    
    const listElement = document.getElementById('cuentas-madre-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    actualizarResumenStock(); 
    
    const { data: cuentas, error } = await supabase
        .from('cuentas_madre')
        .select(`
            *,
            perfiles ( id, estado )
        `)
        .eq('estado', 'activa') // <-- ¡LA CORRECCIÓN CLAVE ESTÁ AQUÍ!
        .order('id', { ascending: false });

    if (error) {
        listElement.innerHTML = '<li>Error al cargar cuentas.</li>';
        console.error('Error cargando cuentas madre:', error); 
        return;
    }
    if (cuentas.length === 0) {
        listElement.innerHTML = '<li>No hay cuentas activas guardadas.</li>';
        return;
    }
    
    listElement.innerHTML = '';
    cuentas.forEach(cuenta => {
        // Como solo mostramos activas, ya no necesitamos la lógica de 'esArchivada'
        const perfilesLibres = cuenta.perfiles ? cuenta.perfiles.filter(p => p.estado === 'libre').length : 0;
        
        listElement.innerHTML += `
            <li class="stock-item">
                <strong>${cuenta.plataforma.toUpperCase()}</strong>
                <br>
                <span>${cuenta.email} | ${cuenta.contrasena}</span><br>
                <strong>Perfiles Libres:</strong> <span style="font-weight: bold; color: ${perfilesLibres > 0 ? 'green' : 'red'};">${perfilesLibres}</span>
                <br><br>
                
                <button type="button" class="btn-small assign-btn" data-id="${cuenta.id}">Asignar (Nuevo)</button>
                <button type="button" class="btn-small reactiva-btn" data-id="${cuenta.id}">Asignar (Reactiva)</button>
                
                <button type="button" class="btn-small delete-btn btn-danger" data-id="${cuenta.id}">Eliminar</button>
            </li>
        `;
    });

    // --- Añadir listeners DESPUÉS de crear los botones ---
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            const cuenta = cuentas.find(c => c.id == id);
            borrarCuenta(cuenta); // Llama a la nueva función de borrado
        });
    });

    document.querySelectorAll('.assign-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            const cuenta = cuentas.find(c => c.id == id);
            asignarPerfil(cuenta, 'nuevo');
        });
    });
    
    document.querySelectorAll('.reactiva-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            const cuenta = cuentas.find(c => c.id == id);
            if (_onReactivaClick) {
                // Llama a la función 'iniciarRescateHuerfano' de gestionPerfiles.js
                _onReactivaClick(cuenta); 
            } else {
                console.error("Error: La función de reactivación no está cargada.");
            }
        });
    });
}

// --- 3.4: LÓGICA DE ASIGNACIÓN (¡CON SOBREGIRO!) ---

async function asignarPerfil(cuenta, tipo) {
    
    // 1. Buscar un perfil libre
    const { data: perfilLibre, error: findError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('cuenta_madre_id', cuenta.id)
        .eq('estado', 'libre')
        .limit(1)
        .single();
    
    if (findError || !perfilLibre) {
        // --- LÓGICA DE SOBREGIRO ---
        if (tipo === 'nuevo') {
            if (!confirm(`¡SOBREGIRO! Esta cuenta no tiene perfiles libres. ¿Deseas forzar un perfil extra (sobreventa)?`)) {
                return;
            }
            
            const nombreCliente = prompt('Escribe el nombre del perfil para el cliente (SOBREVENTA):');
            if (!nombreCliente) return;

            const vence = new Date(new Date().setDate(new Date().getDate() + 30));

            const { data: nuevoPerfil, error: createError } = await supabase
                .from('perfiles')
                .insert({
                    cuenta_madre_id: cuenta.id,
                    nombre_perfil: nombreCliente,
                    estado: 'asignado',
                    fecha_vencimiento_cliente: vence.toISOString()
                })
                .select('id')
                .single();

            if (createError) {
                alert('Error al forzar el perfil: ' + createError.message);
                return;
            }
            
            mostrarMensajeCliente(cuenta, nombreCliente, vence, 'nuevo');
            cargarCuentasMadre(); // Recargamos
            return; 
        
        } else {
             // Es una reactivación y no hay perfiles libres
             alert('Error: No hay perfiles libres. Usa el botón "Asignar (Reactiva)" para rescatar un perfil huérfano.');
             return;
        }
    }

    // --- Flujo Normal (Si se encontró perfil libre) ---
    const perfilParaActualizarId = perfilLibre.id;

    const nombrePerfil = prompt('Escribe el nombre del perfil para el cliente:');
    if (!nombreCliente) return;
    
    const hoy = new Date();
    const vence = new Date(hoy.setDate(hoy.getDate() + 30));
    
    const { error: updateError } = await supabase
        .from('perfiles')
        .update({
            nombre_perfil: nombrePerfil,
            estado: 'asignado',
            fecha_vencimiento_cliente: vence.toISOString()
        })
        .eq('id', perfilParaActualizarId);

    if (updateError) {
        alert('Error al asignar el perfil: ' + updateError.message); 
        return;
    }
    
    mostrarMensajeCliente(cuenta, nombrePerfil, vence, tipo);
    cargarCuentasMadre(); // Recargamos
}


// --- 3.5: LÓGICA DE BORRADO (¡NUEVA VERSIÓN DE 1 SOLO PASO!) ---

async function borrarCuenta(cuenta) {
    
    // (Ya no necesitamos comprobar el estado, 'cuenta' siempre será 'activa' aquí)
    
    const confirmMessage = '¿Seguro que quieres ELIMINAR esta cuenta?\n\n¡Esta acción es permanente!\n1. Los perfiles ASIGNADOS se marcarán como "huérfanos".\n2. Los perfiles LIBRES se borrarán.\n3. La cuenta madre será reemplazada y ocultada.';
    if (!confirm(confirmMessage)) return;

    // --- INICIO DE LA ACCIÓN ---

    // 1a. Poner ASIGNADOS como "huerfano"
    await supabase
        .from('perfiles')
        .update({ estado: 'huerfano' })
        .eq('cuenta_madre_id', cuenta.id)
        .eq('estado', 'asignado');

    // 1b. Borrar los "libres"
    await supabase
        .from('perfiles')
        .delete()
        .eq('cuenta_madre_id', cuenta.id)
        .eq('estado', 'libre');

    // 2. "ELIMINAR SUTIL" (Reemplazo) y ocultar
    // Cambiamos el estado a 'eliminado' para que la función de cargar la ignore
    const { error: errorReemplazo } = await supabase
        .from('cuentas_madre')
        .update({
            email: `eliminada_${cuenta.id}@anulada.com`,
            contrasena: 'xxx-eliminada-xxx',
            estado: 'eliminado' // El estado final es 'eliminado'
        })
        .eq('id', cuenta.id);

    if (errorReemplazo) {
        alert('Error al eliminar sutilmente: ' + errorReemplazo.message);
        return;
    }
    
    alert('¡Cuenta eliminada con éxito! Ya no aparecerá en esta lista.');
    
    // 3. Recargar vistas
    cargarCuentasMadre(); // La cuenta ya no aparecerá porque su estado no es 'activa'
    
    // Recargamos la pestaña de perfiles si está activa
    if (document.getElementById('perfiles').classList.contains('active')) {
         cargarTodosLosPerfiles();
    }
}
