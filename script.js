// IMPORTANTE: Importamos la librería de Supabase directamente desde la web
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- 1. CONEXIÓN A SUPABASE ---
// ¡¡USA TU NUEVA LLAVE ANON AQUÍ!!
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4' // ¡¡PON TU LLAVE ANON AQUÍ!!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- 2. EL "PORTERO" (Control de Sesión) ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    const estamosEnLogin = window.location.pathname.endsWith('/login.html')

    if (!session && !estamosEnLogin) {
        window.location.href = 'login.html'
    } else if (session && estamosEnLogin) {
        window.location.href = 'index.html'
    } else if (session) {
        const userEmailElement = document.getElementById('user-email')
        if (userEmailElement) {
            userEmailElement.textContent = `Conectado: ${session.user.email}`
        }
    }
}
checkAuth()

// --- 3. LÓGICA DE LA PÁGINA DE LOGIN ---
const loginForm = document.getElementById('login-form')
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const loginButton = document.getElementById('login-button')
        const errorMessage = document.getElementById('error-message')

        loginButton.disabled = true
        loginButton.textContent = 'Entrando...'
        errorMessage.textContent = ''

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            errorMessage.textContent = 'Error: Email o contraseña incorrectos.'
            loginButton.disabled = false
            loginButton.textContent = 'Entrar'
        } else {
            window.location.href = 'index.html'
        }
    })
}

// --- 4. LÓGICA DEL PANEL (BOTÓN DE SALIR) ---
const logoutButton = document.getElementById('logout-button')
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'login.html'
    })
}

// --- 5. LÓGICA NUEVA (PANEL FLEXIBLE) ---

// Solo ejecuta esto si estamos en index.html
if (window.location.pathname.endsWith('/index.html') || window.location.pathname === '/') {

    // ----- Selectores de los nuevos formularios -----
    const cuentaForm = document.getElementById('cuenta-madre-form');
    const perfilForm = document.getElementById('perfil-form');
    
    const cuentaMessage = document.getElementById('cuenta-message');
    const perfilMessage = document.getElementById('perfil-message');

    const cuentaSelect = document.getElementById('cuenta-madre-select');
    const plataformaSelect = document.getElementById('plataforma-select');

    // ----- Función para mostrar mensajes (la usaremos mucho) -----
    function showMessage(element, text, isSuccess = true) {
        element.textContent = text;
        element.className = isSuccess ? 'success' : 'error';
        setTimeout(() => { element.textContent = ''; }, 3000);
    }

    // ----- Función 1: Cargar Plataformas (Productos) -----
    async function cargarPlataformas() {
        // El problema de RLS está aquí. ¡Necesitas una política!
        const { data, error } = await supabase.from('plataformas').select('id, nombre');
        if (error) {
            console.error('Error cargando plataformas:', error);
            plataformaSelect.innerHTML = '<option value="">Error al cargar</option>';
            return;
        }
        plataformaSelect.innerHTML = '<option value="">-- Selecciona un producto --</option>';
        data.forEach(p => {
            plataformaSelect.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
    }

    // ----- Función 2: Cargar Cuentas Madre (Llaveros) -----
    async function cargarCuentasMadre() {
        // El problema de RLS está aquí. ¡Necesitas una política!
        // Esta es la línea que fallaba.
        const { data, error } = await supabase.from('cuentas_madre').select('id, nombre_descriptivo');
        
        if (error) {
            console.error('Error cargando cuentas madre:', error);
            cuentaSelect.innerHTML = '<option value="">Error al cargar</option>';
            return;
        }
        cuentaSelect.innerHTML = '<option value="">-- Selecciona una cuenta madre --</option>';
        data.forEach(c => {
            cuentaSelect.innerHTML += `<option value="${c.id}">${c.nombre_descriptivo}</option>`;
        });
    }

    // ----- Cargar los menús desplegables al iniciar -----
    cargarPlataformas();
    cargarCuentasMadre();

    // ----- Lógica del Formulario 1: Guardar Cuenta Madre -----
    cuentaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = document.getElementById('save-cuenta-button');
        button.disabled = true;

        const { error } = await supabase.from('cuentas_madre').insert({
            nombre_descriptivo: document.getElementById('nombre-descriptivo').value,
            datos_acceso: document.getElementById('datos-acceso').value,
            fecha_expiracion: document.getElementById('fecha-expiracion').value
        });

        if (error) {
            // Este error podría ser por RLS si no tienes política de INSERT
            showMessage(cuentaMessage, `Error: ${error.message}`, false);
        } else {
            showMessage(cuentaMessage, '¡Cuenta Madre guardada!', true);
            cuentaForm.reset();
            cargarCuentasMadre(); // ¡Recarga el menú desplegable!
        }
        button.disabled = false;
    });

    // ----- Lógica del Formulario 2: Guardar Perfil -----
    perfilForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = document.getElementById('save-perfil-button');
        button.disabled = true;

        const { error } = await supabase.from('perfiles_en_venta').insert({
            cuenta_madre_id: document.getElementById('cuenta-madre-select').value,
            plataforma_id: document.getElementById('plataforma-select').value,
            datos_perfil: document.getElementById('datos-perfil').value,
            estado: 'disponible',
            cliente_id: null
        });

        if (error) {
            // Este error podría ser por RLS si no tienes política de INSERT
            showMessage(perfilMessage, `Error: ${error.message}`, false);
        } else {
            showMessage(perfilMessage, '¡Perfil guardado y disponible!', true);
            perfilForm.reset();
        }
        button.disabled = false;
    });
}
