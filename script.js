// USA EL LINK CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// --- 1. CONEXIÓN A SUPABASE ---
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4' // ¡Pon tu llave anon!
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
        
        if (document.getElementById('email-list')) {
            cargarCuentasGuardadas(); // ¡Cambiamos el nombre de la función!
        }
    }
}
checkAuth()

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

// Función para cargar las cuentas
async function cargarCuentasGuardadas() {
    const listElement = document.getElementById('email-list');
    
    // Pedimos las nuevas columnas
    const { data: cuentas, error } = await supabase
        .from('correos_guardados')
        .select('id, email, contrasena, plataforma, perfiles_disponibles')
        .order('id', { ascending: false }); // Muestra las más nuevas primero

    if (error) {
        console.error('Error cargando cuentas:', error);
        listElement.innerHTML = '<li>Error al cargar.</li>';
        return;
    }

    if (cuentas.length === 0) {
        listElement.innerHTML = '<li>No hay cuentas guardadas.</li>';
        return;
    }

    // Muestra las cuentas en la lista
    listElement.innerHTML = '';
    cuentas.forEach(item => {
        listElement.innerHTML += `
            <li style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                <strong>Plataforma:</strong> ${item.plataforma.toUpperCase()} <br>
                <strong>Email:</strong> ${item.email} | <strong>Contra:</strong> ${item.contrasena} <br>
                <strong>Perfiles Libres:</strong> <span style="font-weight: bold; font-size: 1.2em; color: ${item.perfiles_disponibles > 0 ? 'green' : 'red'};">${item.perfiles_disponibles}</span>
                <br>
                <button class="assign-btn" data-id="${item.id}" ${item.perfiles_disponibles === 0 ? 'disabled' : ''}>Asignar Perfil</button>
                <button class="delete-btn" data-id="${item.id}">Borrar Cuenta</button>
            </li>
        `;
    });

    // Añadir "escuchas" a los botones de BORRAR
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            borrarCuenta(button.dataset.id);
        });
    });

    // Añadir "escuchas" a los botones de ASIGNAR
    document.querySelectorAll('.assign-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            // Buscamos los datos de la cuenta que queremos asignar
            const cuenta = cuentas.find(c => c.id == id);
            asignarPerfil(cuenta); // Llamamos a la nueva función de asignar
        });
    });
}

// Lógica del formulario de guardar
const emailForm = document.getElementById('email-form');
if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const { error } = await supabase
            .from('correos_guardados')
            .insert({ 
                plataforma: document.getElementById('plataforma-input').value,
                email: document.getElementById('email-input').value, 
                contrasena: document.getElementById('password-input').value, 
                perfiles_disponibles: document.getElementById('perfiles-input').value
            });

        if (error) {
            showMessage('form-message', 'Error: ' + error.message, false);
        } else {
            showMessage('form-message', '¡Cuenta guardada con éxito!', true);
            emailForm.reset();
            cargarCuentasGuardadas(); // Recarga la lista
        }
    });
}

// Función para Borrar Cuenta
async function borrarCuenta(id) {
    if (!confirm('¿Seguro que quieres BORRAR esta cuenta madre?')) return;

    const { error } = await supabase.from('correos_guardados').delete().eq('id', id);

    if (error) {
        alert('Error al borrar: ' + error.message);
    } else {
        cargarCuentasGuardadas(); // Recarga la lista
    }
}

// --- ¡NUEVA FUNCIÓN MÁGICA (Tu idea)! ---
async function asignarPerfil(cuenta) {
    // 1. Pedir el nombre del perfil
    const nombrePerfil = prompt('Escribe el nombre del perfil para el cliente:');
    if (!nombrePerfil) return; // Si cancela, no hace nada

    // 2. Restar 1 al stock
    const nuevoStock = cuenta.perfiles_disponibles - 1;
    const { error } = await supabase
        .from('correos_guardados')
        .update({ perfiles_disponibles: nuevoStock }) // Actualiza el stock
        .eq('id', cuenta.id);

    if (error) {
        alert('Error al actualizar el stock: ' + error.message);
        return;
    }

    // 3. Generar el texto para el cliente (¡con fecha de 30 días!)
    const hoy = new Date();
    const vence = new Date(hoy.setDate(hoy.getDate() + 30));
    const venceFormateado = vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const textoGenerado = `
CUENTA ${cuenta.plataforma.toUpperCase()}
CORREO: ${cuenta.email}
CONTRASEÑA: ${cuenta.contrasena}
PERFIL: ${nombrePerfil}
VENCE: ${venceFormateado}
    `;

    // 4. Mostrar el resultado
    const outputArea = document.getElementById('output-area');
    const outputText = document.getElementById('output-text');
    
    outputText.value = textoGenerado.trim(); // .trim() quita espacios extra
    outputArea.style.display = 'block'; // Muestra el área
    
    cargarCuentasGuardadas(); // Recarga la lista para que muestre el nuevo stock
}
