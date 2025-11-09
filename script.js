// USA EL LINK CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// --- 1. CONEXIÓN A SUPABASE ---
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
// ¡¡ATENCIÓN!! Pon tu llave 'anon' nueva aquí
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4' 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- 2. LÓGICA DE AUTENTICACIÓN (Login, Logout, Portero) ---

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    const estamosEnLogin = window.location.pathname.endsWith('/login.html')

    if (!session && !estamosEnLogin) {
        window.location.href = 'login.html'
    } else if (session && estamosEnLogin) {
        window.location.href = 'index.html'
    } else if (session) {
        const userEmailElement = document.getElementById('user-email')
        if (userEmailElement) userEmailElement.textContent = `Conectado: ${session.user.email}`
        
        // ¡ACTUALIZADO! Ahora carga ambas listas
        if (document.getElementById('stock-list')) { // Busca la nueva lista del sidebar
            cargarCuentasGuardadas(); // Carga las cuentas ACTIVAS
            cargarCuentasArchivadas(); // Carga las cuentas BORRADAS (en rojo)
        }
    }
}
checkAuth()

// ... (El código de loginForm y logoutButton se queda exactamente igual) ...
const loginForm = document.getElementById('login-form')
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            document.getElementById('error-message').textContent = 'Error: ' + error.message
        } else {
            window.location.href = 'index.html'
        }
    })
}
const logoutButton = document.getElementById('logout-button')
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'login.html'
    })
}


// --- 3. LÓGICA DE LA APP (¡Tu idea!) ---

// Función para mostrar mensajes
function showMessage(element, text, isSuccess = true) {
    const el = document.getElementById(element);
    el.textContent = text;
    el.className = isSuccess ? 'success' : 'error';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// --- ¡NUEVA FUNCIÓN! El contador de días ---
function calcularDiasRestantes(fechaPago) {
    if (!fechaPago) return { texto: 'No definida', color: 'grey' };
    
    // Sumamos 1 día al parsear porque Supabase a veces lo da un día antes
    const fecha = new Date(fechaPago + 'T00:00:00-05:00'); 
    
    // Calculamos la fecha de vencimiento (pago + 30 días)
    const fechaVencimiento = new Date(fecha.setDate(fecha.getDate() + 30));
    const hoy = new Date();
    
    // Reseteamos las horas para comparar solo días
    hoy.setHours(0,0,0,0);
    fechaVencimiento.setHours(0,0,0,0);

    const diffTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diffDias = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
        return { texto: `Vencido (hace ${Math.abs(diffDias)} días)`, color: 'red' };
    } else if (diffDias === 0) {
        return { texto: '¡Vence HOY!', color: 'red' };
    } else if (diffDias <= 5) {
        return { texto: `Vence en ${diffDias} días`, color: 'orange' };
    } else {
        return { texto: `Vence en ${diffDias} días`, color: 'green' };
    }
}

// Función para cargar las cuentas (VERSIÓN 5 - ¡Con contador y en el Sidebar!)
async function cargarCuentasGuardadas() {
    const listElement = document.getElementById('stock-list'); // ¡Cambiado!
    
    const { data: cuentas, error } = await supabase
        .from('correos_guardados')
        .select('id, email, contrasena, plataforma, perfiles_disponibles, fecha_pago_proveedor, perfiles_asignados')
        .is('estado', null)
        .order('id', { ascending: false });

    if (error) {
        console.error('Error cargando cuentas:', error);
        listElement.innerHTML = '<li>Error al cargar.</li>';
        return;
    }

    if (cuentas.length === 0) {
        listElement.innerHTML = '<li>No hay cuentas guardadas.</li>';
        return;
    }

    listElement.innerHTML = '';
    cuentas.forEach(item => {
        // ¡NUEVO! Usamos la función del contador
        const vencimiento = calcularDiasRestantes(item.fecha_pago_proveedor);

        listElement.innerHTML += `
            <li class="stock-item">
                <strong>${item.plataforma.toUpperCase()}</strong> <br>
                <span>${item.email}</span><br>
                <strong>Perfiles Libres:</strong> <span style="font-weight: bold; font-size: 1.2em; color: ${item.perfiles_disponibles > 0 ? 'green' : 'red'};">${item.perfiles_disponibles}</span> <br>
                
                <strong>Vencimiento:</strong> <span style="color: ${vencimiento.color}; font-weight: bold;">${vencimiento.texto}</span>
                <br><br>
                
                <button class="assign-btn" data-id="${item.id}" ${item.perfiles_disponibles === 0 ? 'disabled' : ''}>Asignar</button>
                <button class="delete-btn" data-id="${item.id}">Borrar</button>
                <div style="margin-top: 10px; padding: 5px; background-color: #fff; border-top: 1px solid #eee;">
                    <strong>Perfiles Asignados:</strong>
                    <pre>${item.perfiles_asignados || 'Ninguno'}</pre>
                </div>
            </li>
        `;
    });

    // ... (el resto de las funciones de botones se quedan igual) ...
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            borrarCuenta(button.dataset.id);
        });
    });

    document.querySelectorAll('.assign-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            const cuenta = cuentas.find(c => c.id == id);
            asignarPerfil(cuenta);
        });
    });
}

// Lógica del formulario de guardar (VERSIÓN 4 - igual)
const emailForm = document.getElementById('email-form');
if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        
        const { error } = await supabase
            .from('correos_guardados')
            .insert({ 
                plataforma: document.getElementById('plataforma-input').value,
                email: document.getElementById('email-input').value, 
                contrasena: document.getElementById('password-input').value, 
                perfiles_disponibles: document.getElementById('perfiles-input').value,
                fecha_pago_proveedor: document.getElementById('fecha-proveedor-input').value
            });

        if (error) {
            showMessage('form-message', 'Error: ' + error.message, false);
        } else {
            showMessage('form-message', '¡Cuenta guardada con éxito!', true);
            emailForm.reset();
            cargarCuentasGuardadas();
        }
        button.disabled = false;
    });
}

// Función para Borrar Cuenta (VERSIÓN 2 - Archiva)
async function borrarCuenta(id) {
    if (!confirm('¿Seguro que quieres BORRAR (archivar) esta cuenta madre?')) return;
    const { error } = await supabase
        .from('correos_guardados')
        .update({ estado: 'archivado' })
        .eq('id', id);

    if (error) { alert('Error al archivar: ' + error.message); } 
    else {
        cargarCuentasGuardadas();
        cargarCuentasArchivadas();
    }
}

// --- ¡FUNCIÓN MÁGICA MEJORADA (VERSIÓN 4 - Con Scroll)! ---
async function asignarPerfil(cuenta) {
    const nombrePerfil = prompt('Escribe el nombre del perfil para el cliente:');
    if (!nombrePerfil) return; 

    const nuevoStock = cuenta.perfiles_disponibles - 1;
    const hoy = new Date();
    const vence = new Date(hoy.setDate(hoy.getDate() + 30));
    const venceFormateado = vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const textoCliente = `
CUENTA ${cuenta.plataforma.toUpperCase()}
CORREO: ${cuenta.email}
CONTRASEÑA: ${cuenta.contrasena}
PERFIL: ${nombrePerfil}
VENCE: ${vencimiento.texto} (Pago el ${cuenta.fecha_pago_proveedor})
    `.trim();
    
    const stringParaLista = `${nombrePerfil} (Vence: ${venceFormateado})`;
    const listaPerfilesAntigua = cuenta.perfiles_asignados || '';
    const nuevaListaPerfiles = (listaPerfilesAntigua + '\n' + stringParaLista).trim();

    const { error } = await supabase
        .from('correos_guardados')
        .update({ 
            perfiles_disponibles: nuevoStock,
            perfiles_asignados: nuevaListaPerfiles
        })
        .eq('id', cuenta.id);

    if (error) {
        alert('Error al actualizar el stock: ' + error.message);
        return;
    }

    const outputArea = document.getElementById('output-area');
    const outputText = document.getElementById('output-text');
    
    outputText.value = textoCliente; 
    outputArea.style.display = 'block';
    outputArea.scrollIntoView({ behavior: 'smooth' });
    
    cargarCuentasGuardadas();
}

// --- ¡NUEVA FUNCIÓN PARA TU IDEA (VERSIÓN 1)!! ---
async function cargarCuentasArchivadas() {
    const listEl = document.getElementById('priority-list');
    const containerEl = document.getElementById('priority-list-container');
    
    const { data, error } = await supabase
        .from('correos_guardados')
        .select('plataforma, perfiles_asignados')
        .eq('estado', 'archivado');

    if (error) {
        console.error('Error cargando archivadas:', error);
        containerEl.style.display = 'none';
        return;
    }
    if (!data || data.length === 0) {
        containerEl.style.display = 'none';
        return;
    }

    containerEl.style.display = 'block';
    listEl.innerHTML = '';
    data.forEach(item => {
        listEl.innerHTML += `
            <li style="color: #D8000C; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 5px;">
                <strong>${item.plataforma.toUpperCase()} (CUENTA BORRADA)</strong>
                <pre>${item.perfiles_asignados || 'Ninguno'}</pre>
            </li>
        `;
    });
}
