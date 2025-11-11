//
// --- gestionCuentas.js (VERSIÓN FINAL DEFINITIVA) ---
//
import { supabase } from './supabaseClient.js'
import { showMessage, mostrarMensajeCliente } from './utils.js'
import { cargarTodosLosPerfiles } from './gestionPerfiles.js'

let _onReactivaClick = null;
const plantilla_nuevo_cliente = "¡Hola [NOMBRE]! Por tu seguridad hemos modificado tu cuenta de [PLATAFORMA].\n\nTus nuevos datos son:\nCorreo: [EMAIL]\nContraseña: [PASS]\nPerfil: [NOMBRE]";

// --- 3.1: INICIALIZACIÓN ---
export function initGestionCuentas() {
    // Listener para el formulario de Añadir
    const stockForm = document.getElementById('stock-form');
    if (stockForm) { stockForm.addEventListener('submit', guardarNuevaCuenta); }

    // Listeners para el nuevo modal de Editar Contraseña
    const editCuentaForm = document.getElementById('edit-cuenta-form');
    if (editCuentaForm) {
        editCuentaForm.addEventListener('submit', guardarCambiosCuenta);
    }
    const editCuentaClose = document.getElementById('modal-cuenta-close');
    if (editCuentaClose) {
        editCuentaClose.addEventListener('click', () => {
            document.getElementById('modal-editar-cuenta').style.display = 'none';
        });
    }
}

async function actualizarResumenStock() {
    const { data: perfiles, error } = await supabase.from('perfiles').select('estado');
    if (error) return;
    const libres = perfiles.filter(p => p.estado === 'libre').length;
    const ocupados = perfiles.filter(p => p.estado === 'asignado' || p.estado === 'huerfano' || p.estado === 'vencido').length;
    const libresEl = document.getElementById('stock-libres');
    if (libresEl) libresEl.textContent = libres;
    const ocupadosEl = document.getElementById('stock-ocupados');
    if (ocupadosEl) ocupadosEl.textContent = ocupados;
}

async function guardarNuevaCuenta(e) {
    e.preventDefault(); 
    const button = e.target.querySelector('button');
    button.disabled = true; button.textContent = 'Guardando...';
    const plataforma = document.getElementById('plataforma-input').value;
    const email = document.getElementById('email-input').value;
    const contrasena = document.getElementById('password-input').value;
    const cantidadPerfiles = parseInt(document.getElementById('perfiles-input').value);
    const fechaPago = document.getElementById('fecha-proveedor-input').value;
    const { data: cuentaMadre, error: errorMadre } = await supabase.from('cuentas_madre').insert({ plataforma: plataforma, email: email, contrasena: contrasena, fecha_pago_proveedor: fechaPago, estado: 'activa' }).select('id').single();
    if (errorMadre) { showMessage('form-message', 'Error: ' + errorMadre.message, false); button.disabled = false; button.textContent = 'Guardar Cuenta'; return; }
    const nuevaCuentaMadreId = cuentaMadre.id;
    const perfilesParaInsertar = [];
    for (let i = 1; i <= cantidadPerfiles; i++) { perfilesParaInsertar.push({ cuenta_madre_id: nuevaCuentaMadreId, nombre_perfil: `Perfil Libre ${i}`, estado: 'libre', fecha_vencimiento_cliente: null }); }
    const { error: errorPerfiles } = await supabase.from('perfiles').insert(perfilesParaInsertar);
    if (errorPerfiles) { showMessage('form-message', 'Error creando perfiles: ' + errorPerfiles.message, false); }
    else { showMessage('form-message', '¡Cuenta y perfiles guardados con éxito!', true); document.getElementById('stock-form').reset(); cargarCuentasMadre(); }
    button.disabled = false; button.textContent = 'Guardar Cuenta';
}

// --- 3.3: LÓGICA DE LA LISTA (Con Botón "Editar Pass") ---
export async function cargarCuentasMadre(onReactivaClick) {
    
    if (onReactivaClick) { _onReactivaClick = onReactivaClick; }
    
    const listElement = document.getElementById('cuentas-madre-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    actualizarResumenStock(); 
    
    const { data: cuentas, error } = await supabase
        .from('cuentas_madre')
        .select(`*, perfiles ( id, estado )`)
        .eq('estado', 'activa')
        .order('id', { ascending: false });

    if (error) { listElement.innerHTML = '<li>Error al cargar cuentas.</li>'; return; }
    if (cuentas.length === 0) { listElement.innerHTML = '<li>No hay cuentas activas guardadas.</li>'; return; }
    
    listElement.innerHTML = '';
    cuentas.forEach(cuenta => {
        const perfilesLibres = cuenta.perfiles ? cuenta.perfiles.filter(p => p.estado === 'libre').length : 0;
        
        listElement.innerHTML += `
            <li class="stock-item">
                <strong>${cuenta.plataforma.toUpperCase()}</strong><br>
                <span>${cuenta.email} | ${cuenta.contrasena}</span><br>
                <strong>Perfiles Libres:</strong> <span style="font-weight: bold; color: ${perfilesLibres > 0 ? 'green' : 'red'};">${perfilesLibres}</span>
                <br><br>
                <button type="button" class="btn-small assign-btn" data-id="${cuenta.id}">Asignar (Nuevo)</button>
                <button type="button" class="btn-small reactiva-btn" data-id="${cuenta.id}">Asignar (Reactiva)</button>
                <button type="button" class="btn-small edit-pass-btn" data-id="${cuenta.id}">✏️ Editar Pass</button>
                <button type="button" class="btn-small delete-btn btn-danger" data-id="${cuenta.id}">Eliminar</button>
            </li>`;
    });

    // --- Listeners de botones ---
    document.querySelectorAll('.delete-btn').forEach(button => { button.addEventListener('click', () => { const id = button.dataset.id; const cuenta = cuentas.find(c => c.id == id); borrarCuenta(cuenta); }); });
    document.querySelectorAll('.assign-btn').forEach(button => { button.addEventListener('click', () => { const id = button.dataset.id; const cuenta = cuentas.find(c => c.id == id); asignarPerfil(cuenta, 'nuevo'); }); });
    document.querySelectorAll('.reactiva-btn').forEach(button => { button.addEventListener('click', () => { const id = button.dataset.id; const cuenta = cuentas.find(c => c.id == id); if (_onReactivaClick) { _onReactivaClick(cuenta); } else { console.error("Error: La función de reactivación no está cargada."); } }); });
    
    document.querySelectorAll('.edit-pass-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            const cuenta = cuentas.find(c => c.id == id);
            abrirModalEditarCuenta(cuenta);
        });
    });
}

// --- 3.4: LÓGICA DE ASIGNACIÓN (Con Link Clickeable) ---
async function asignarPerfil(cuenta, tipo) {
    
    const { data: perfilLibre, error: findError } = await supabase.from('perfiles').select('id').eq('cuenta_madre_id', cuenta.id).eq('estado', 'libre').limit(1).single();
    
    let perfilParaActualizarId = null;

    if (findError || !perfilLibre) {
        if (tipo === 'nuevo') { if (!confirm(`¡SOBREGIRO! Esta cuenta no tiene perfiles libres. ¿Deseas forzar un perfil extra (sobreventa)?`)) { return; } }
        else { alert('Error: No hay perfiles libres. Usa el botón "Asignar (Reactiva)" para rescatar un perfil huérfano.'); return; }
    } else {
        perfilParaActualizarId = perfilLibre.id;
    }

    const nombrePerfil = prompt('Paso 1/2: Escribe el nombre del perfil para el cliente:');
    if (!nombrePerfil) return; 
    const wsp = prompt('Paso 2/2: Escribe el teléfono (WSP) del cliente (ej: 519...):');
    if (!wsp) return; 
    
    const hoy = new Date();
    const vence = new Date(hoy.setDate(hoy.getDate() + 30));
    
    let perfilActualizado;
    
    if (perfilParaActualizarId) {
        const { data, error } = await supabase.from('perfiles').update({ nombre_perfil: nombrePerfil, estado: 'asignado', fecha_vencimiento_cliente: vence.toISOString(), wsp: wsp }).eq('id', perfilParaActualizarId).select().single();
        if (error) { alert('Error al asignar el perfil: ' + error.message); return; }
        perfilActualizado = data;
    } else {
        const { data, error } = await supabase.from('perfiles').insert({ cuenta_madre_id: cuenta.id, nombre_perfil: nombrePerfil, estado: 'asignado', fecha_vencimiento_cliente: vence.toISOString(), wsp: wsp }).select().single();
        if (error) { alert('Error al forzar el perfil: ' + error.message); return; }
        perfilActualizado = data;
    }
    
    // --- Lógica de Notificación con Link Clickeable ---
    alert(`¡Perfil guardado!\nNombre: ${nombrePerfil}\nWSP: ${wsp}\n\nAhora, haz clic en el link de WhatsApp que aparecerá en la caja de abajo.`);
    
    let textoMensaje = plantilla_nuevo_cliente
        .replace(/\[NOMBRE\]/g, perfilActualizado.nombre_perfil)
        .replace(/\[PLATAFORMA\]/g, cuenta.plataforma)
        .replace(/\[EMAIL\]/g, cuenta.email)
        .replace(/\[PASS\]/g, cuenta.contrasena);
    
    const textoCodificado = encodeURIComponent(textoMensaje);
    const urlWhatsApp = `https://wa.me/${perfilActualizado.wsp}?text=${textoCodificado}`;
    
    const outputArea = document.getElementById('output-area');
    const outputText = document.getElementById('output-text');
    
    // Ponemos el link clickeable en la caja
    outputText.innerHTML = `<a href="${urlWhatsApp}" target="_blank">¡CLIC AQUÍ para notificar a "${nombrePerfil}" por WhatsApp!</a>`;
    
    outputArea.style.display = 'block';
    outputArea.scrollIntoView({ behavior: 'smooth' });

    cargarCuentasMadre();
}

// --- 3.5: LÓGICA DE BORRADO (1 SOLO PASO) ---
async function borrarCuenta(cuenta) {
    const confirmMessage = '¿Seguro que quieres ELIMINAR esta cuenta?\n\n¡Esta acción es permanente!\n1. Los perfiles ASIGNADOS se marcarán como "huérfanos".\n2. Los perfiles LIBRES se borrarán.\n3. La cuenta madre será reemplazada y ocultada.';
    if (!confirm(confirmMessage)) return;
    await supabase.from('perfiles').update({ estado: 'huerfano' }).eq('cuenta_madre_id', cuenta.id).eq('estado', 'asignado');
    await supabase.from('perfiles').delete().eq('cuenta_madre_id', cuenta.id).eq('estado', 'libre');
    const { error: errorReemplazo } = await supabase.from('cuentas_madre').update({ email: `eliminada_${cuenta.id}@anulada.com`, contrasena: 'xxx-eliminada-xxx', estado: 'eliminado' }).eq('id', cuenta.id);
    if (errorReemplazo) { alert('Error al eliminar sutilmente: ' + errorReemplazo.message); return; }
    alert('¡Cuenta eliminada con éxito! Ya no aparecerá en esta lista.');
    cargarCuentasMadre();
    if (document.getElementById('perfiles').classList.contains('active')) { cargarTodosLosPerfiles(); }
}

// --- 3.6: Lógica de Editar Contraseña ---
function abrirModalEditarCuenta(cuenta) {
    document.getElementById('edit-cuenta-id').value = cuenta.id;
    document.getElementById('edit-cuenta-email').textContent = cuenta.email;
    document.getElementById('edit-cuenta-pass').value = cuenta.contrasena;
    document.getElementById('modal-editar-cuenta').style.display = 'flex';
}

async function guardarCambiosCuenta(e) {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true;
    button.textContent = 'Guardando...';

    const id = document.getElementById('edit-cuenta-id').value;
    const nuevaContrasena = document.getElementById('edit-cuenta-pass').value;

    const { error } = await supabase
        .from('cuentas_madre')
        .update({ contrasena: nuevaContrasena }) // Solo actualizamos la contraseña
        .eq('id', id);

    if (error) {
        alert('Error al guardar la contraseña: ' + error.message);
    } else {
        alert('¡Contraseña actualizada con éxito!');
        document.getElementById('modal-editar-cuenta').style.display = 'none';
        
        cargarCuentasMadre(); 
        
        if (document.getElementById('perfiles').classList.contains('active')) {
             cargarTodosLosPerfiles();
        }
    }

    button.disabled = false;
    button.textContent = 'Guardar Nueva Contraseña';
}
