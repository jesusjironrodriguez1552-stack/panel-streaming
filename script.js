// USA EL LINK CDN, ¡NO EL DE ESM.SH!
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// --- 1. CONEXIÓN A SUPABASE ---
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4' // ¡Pon tu llave anon!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- 2. LÓGICA DE AUTENTICACIÓN (Login, Logout, Portero) ---

// El "Portero" que revisa si estás logueado
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    const estamosEnLogin = window.location.pathname.endsWith('/login.html')

    if (!session && !estamosEnLogin) {
        window.location.href = 'login.html' // No hay sesión, ¡al login!
    } else if (session && estamosEnLogin) {
        window.location.href = 'index.html' // Hay sesión, ¡al panel!
    } else if (session) {
        // Estás en el panel, muestra el email
        const userEmailElement = document.getElementById('user-email')
        if (userEmailElement) {
            userEmailElement.textContent = `Conectado: ${session.user.email}`
        }
        // Si estamos en el panel, carga los correos
        if (document.getElementById('email-list')) {
            cargarCorreosGuardados();
        }
    }
}
checkAuth() // Llama al portero en cuanto carga la página

// Lógica del formulario de Login
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

// Lógica del botón de Salir
const logoutButton = document.getElementById('logout-button')
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'login.html'
    })
}

// --- 3. LÓGICA DE LA APP (Guardar y Cargar Correos) ---

// Función para cargar los correos de la base de datos
async function cargarCorreosGuardados() {
    const listElement = document.getElementById('email-list');
    
    // RLS ESTÁ DESACTIVADO, así que esto funcionará
    const { data: correos, error } = await supabase
        .from('correos_guardados')
        .select('email'); // Solo traemos el email

    if (error) {
        console.error('Error cargando correos:', error);
        listElement.innerHTML = '<li>Error al cargar correos.</li>';
        return;
    }

    if (correos.length === 0) {
        listElement.innerHTML = '<li>No hay correos guardados.</li>';
        return;
    }

    // Muestra los correos en la lista
    listElement.innerHTML = ''; // Limpia el "Cargando..."
    correos.forEach(item => {
        listElement.innerHTML += `<li>${item.email}</li>`;
    });
}

// Lógica del formulario de guardar correos
const emailForm = document.getElementById('email-form');
if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('email-input');
        const messageEl = document.getElementById('form-message');
        const email = emailInput.value;

        // RLS ESTÁ DESACTIVADO, así que esto funcionará
        const { error } = await supabase
            .from('correos_guardados')
            .insert({ email: email }); // Inserta el email

        if (error) {
            console.error('Error guardando correo:', error);
            messageEl.textContent = 'Error: ' + error.message;
        } else {
            messageEl.textContent = '¡Correo guardado con éxito!';
            emailInput.value = ''; // Limpia el input
            cargarCorreosGuardados(); // Recarga la lista
        }
    });
}
