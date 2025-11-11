//
// --- main.js (El "Cerebro" de la App) ---
//
import { supabase } from './supabaseClient.js';
import { initGestionCuentas, cargarCuentasMadre } from './gestionCuentas.js';
import { initGestionPerfiles, cargarTodosLosPerfiles, iniciarRescateHuerfano } from './gestionPerfiles.js';
import { cargarControlDePagos } from './gestionPagos.js';

// --- 1. LÓGICA DE AUTENTICACIÓN (Login, Logout, Portero) ---

// Revisa el estado de autenticación al cargar la página
checkAuth();

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const estamosEnLogin = window.location.pathname.endsWith('/login.html');

    if (!session && !estamosEnLogin) {
        // NO está logueado Y NO está en login -> Llévalo a login
        window.location.href = 'login.html';
    } else if (session && estamosEnLogin) {
        // SÍ está logueado PERO está en login -> Llévalo al index
        window.location.href = 'index.html';
    } else if (session) {
        // SÍ está logueado y está en index -> Muestra email y arranca la app
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement) userEmailElement.textContent = `Conectado: ${session.user.email}`;
        
        initApp(); // <-- ¡Aquí empieza la magia!
    }
}

// --- Lógica de Login (para login.html) ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('error-message').textContent = 'Error: ' + error.message;
        } else {
            window.location.href = 'index.html';
        }
    });
}

// --- Lógica de Logout (para index.html) ---
const logoutButton = document.getElementById('logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// --- 2. LÓGICA DE LA APP (Navegación y Pestañas) ---

function initApp() {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    // Listener para los botones de las pestañas
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Quitar 'active' de todos
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // 2. Poner 'active' al que se hizo clic
            tab.classList.add('active');
            const targetContent = document.getElementById(tab.dataset.tab);
            targetContent.classList.add('active');

            // 3. Cargar el contenido de esa pestaña
            loadTabContent(tab.dataset.tab);
        });
    });

    // Inicializa los formularios que están en otros módulos
    initGestionCuentas();  // Activa el formulario de "Añadir Cuenta"
    initGestionPerfiles(); // Activa el formulario del modal "Editar Perfil"

    // Creamos un "oyente" global. 
    // Cuando 'gestionPerfiles' dispara "refrescarVista", este código se ejecuta.
    window.addEventListener('refrescarVista', () => {
        console.log("Refrescando la vista...");
        const activeTab = document.querySelector('.tab-button.active').dataset.tab;
        loadTabContent(activeTab); // Vuelve a cargar la pestaña activa
    });

    // Carga la pestaña por defecto (Gestión) al arrancar
    loadTabContent('gestion');
}

// --- 3. CARGADOR DE CONTENIDO (El "Orquestador") ---

// Esta función decide qué módulo llamar según la pestaña
function loadTabContent(tabName) {
    if (tabName === 'gestion') {
        // ¡ESTE ES EL PUENTE!
        // Le pasamos la función 'iniciarRescateHuerfano' al módulo 'gestionCuentas'.
        cargarCuentasMadre(iniciarRescateHuerfano);
        
    } else if (tabName === 'perfiles') {
        cargarTodosLosPerfiles();
        
    } else if (tabName === 'pagos') {
        cargarControlDePagos();
    }
}
