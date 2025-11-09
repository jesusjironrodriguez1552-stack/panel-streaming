// IMPORTANTE: Importamos la librería de Supabase directamente desde la web
// USA EL LINK CDN, ¡NO EL DE ESM.SH!
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// --- 1. CONEXIÓN A SUPABASE ---
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
// ¡¡ATENCIÓN!! Pon tu llave 'anon' nueva aquí
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4' 
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

// --- 3. LÓGICA DE LA APP (Guardar, Cargar y Borrar Correos) ---

// Función para cargar los correos de la base de datos (¡MEJORADA!)
async function cargarCorreosGuardados() {
    const listElement = document.getElementById('email-list');
    
    // ¡IMPORTANTE! Ahora pedimos 'id' y 'email'
    const { data: correos, error } = await supabase
        .from('correos_guardados')
        .select('id, email'); // Pedimos el ID para saber cuál borrar

    if (error) {
        console.error('Error cargando correos:', error);
        listElement.innerHTML = '<li>Error al cargar correos.</li>';
        return;
    }

    if (correos.length === 0) {
        listElement.innerHTML = '<li>No hay correos guardados.</li>';
        return;
    }

    // Muestra los correos en la lista (¡CON BOTÓN!)
    listElement.innerHTML = ''; // Limpia el "Cargando..."
    correos.forEach(item => {
        // Añadimos el botón con un data-id que guarda el ID del correo
        listElement.innerHTML += `
            <li>
                ${item.email}
                <button class="delete-btn" data-id="${item.id}">Borrar</button>
            </li>
        `;
    });

    // ¡NUEVO! Añadir "escuchas" a los botones que acabamos de crear
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const idParaBorrar = button.dataset.id; // Obtiene el ID del botón
            borrarCorreo(idParaBorrar); // Llama a la nueva función de borrar
        });
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

// --- NUEVA FUNCIÓN: Borrar un Correo ---
async function borrarCorreo(id) {
    // Pedimos confirmación
    if (!confirm('¿Estás seguro de que quieres borrar este correo?')) {
        return; // Si dice "Cancelar", no hace nada
    }

    const { error } = await supabase
        .from('correos_guardados')
        .delete() // ¡La magia de borrar!
        .eq('id', id); // Le dice cuál borrar (donde el 'id' sea igual al 'id' del botón)

    if (error) {
        console.error('Error borrando correo:', error);
        alert('Error al borrar: ' + error.message);
    } else {
        // ¡Éxito! Recargamos la lista para que desaparezca
        cargarCorreosGuardados();
    }
}
