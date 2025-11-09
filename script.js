// IMPORTANTE: Importamos la librería de Supabase directamente desde la web
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- 1. CONEXIÓN A SUPABASE ---
// ¡¡USA TU NUEVA LLAVE ANON AQUÍ!!
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- 2. EL "PORTERO" (Control de Sesión) ---
// Esta función revisa quién está logueado y en qué página está
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    const estamosEnLogin = window.location.pathname.endsWith('/login.html')

    if (!session && !estamosEnLogin) {
        // No hay sesión y NO está en el login... ¡pa' fuera!
        window.location.href = 'login.html'
    } else if (session && estamosEnLogin) {
        // Hay sesión y SÍ está en el login... ¡pa' dentro!
        window.location.href = 'index.html'
    } else if (session) {
        // Hay sesión y está en el panel, muestra su email
        const userEmailElement = document.getElementById('user-email')
        if (userEmailElement) {
            userEmailElement.textContent = `Conectado: ${session.user.email}`
        }
    }
}
// Ejecuta el portero tan pronto carga la página
checkAuth()

// --- 3. LÓGICA DE LA PÁGINA DE LOGIN ---
const loginForm = document.getElementById('login-form')
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault() // Evita que la página se recargue

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
            // ¡Éxito! El portero (checkAuth) se encargará de redirigir
            window.location.href = 'index.html'
        }
    })
}

// --- 4. LÓGICA DEL PANEL (BOTÓN DE SALIR) ---
const logoutButton = document.getElementById('logout-button')
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut()
        // El portero se encargará de redirigir a login.html
        window.location.href = 'login.html'
    })
}

// --- 5. LÓGICA DEL PANEL (FORMULARIO DE STOCK) ---

// Solo ejecuta esto si estamos en index.html
if (window.location.pathname.endsWith('/index.html') || window.location.pathname === '/') {
    
    // Función para cargar las plataformas en el <select>
    async function cargarPlataformas() {
        const select = document.getElementById('plataforma-select');
        const { data, error } = await supabase
            .from('plataformas')
            .select('id, nombre');

        if (error) {
            console.error('Error cargando plataformas:', error);
            select.innerHTML = '<option value="">Error al cargar</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Selecciona una plataforma --</option>';
        data.forEach(plataforma => {
            const option = document.createElement('option');
            option.value = plataforma.id;
            option.textContent = plataforma.nombre;
            select.appendChild(option);
        });
    }
    
    // Llama a la función en cuanto cargue la página
    cargarPlataformas();

    // Ahora, la lógica del formulario
    const stockForm = document.getElementById('stock-form');
    const messageEl = document.getElementById('form-message');
    const saveButton = document.getElementById('save-stock-button');

    stockForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Evita que la página se recargue

        // 1. Deshabilitar el botón
        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';
        messageEl.textContent = '';

        // 2. Obtener los valores del formulario
        const plataformaId = document.getElementById('plataforma-select').value;
        const datosAcceso = document.getElementById('datos-acceso').value;
        const fechaExpiracion = document.getElementById('fecha-expiracion').value;
        const cantidadPerfiles = parseInt(document.getElementById('cantidad-perfiles').value);

        // --- 3. LA MAGIA: Guardar en Supabase ---

        // Paso A: Insertar la Cuenta Madre y pedir que nos devuelva el ID
        const { data: cuentaMadre, error: errorMadre } = await supabase
            .from('cuentas_madre')
            .insert({
                plataforma_id: plataformaId,
                datos_acceso: datosAcceso,
                fecha_expiracion: fechaExpiracion
            })
            .select('id') // ¡Importante! Pedimos que nos devuelva el ID
            .single(); // .single() nos da el objeto directo y no un array

        if (errorMadre) {
            console.error('Error guardando cuenta madre:', errorMadre);
            messageEl.textContent = 'Error: No se pudo guardar la cuenta madre.';
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar Cuenta';
            return; // Detiene la ejecución si falla
        }

        // ¡Éxito! Tenemos el ID de la nueva cuenta madre
        const nuevaCuentaMadreId = cuentaMadre.id;

        // Paso B: Preparar todos los perfiles que vamos a crear
        const perfilesParaInsertar = [];
        for (let i = 1; i <= cantidadPerfiles; i++) {
            perfilesParaInsertar.push({
                cuenta_madre_id: nuevaCuentaMadreId,
                datos_perfil: `Perfil ${i}`, // Ej: "Perfil 1", "Perfil 2", etc.
                estado: 'disponible', // ¡"Verde de libre" como dijiste!
                cliente_id: null // Aún no tiene cliente
            });
        }

        // Paso C: Insertar TODOS los perfiles de golpe
        const { error: errorPerfiles } = await supabase
            .from('perfiles_en_venta')
            .insert(perfilesParaInsertar);

        if (errorPerfiles) {
            console.error('Error guardando perfiles:', errorPerfiles);
            // Esto es un problema, porque la cuenta madre se creó pero los perfiles no.
            // (Manejo de error avanzado se podría agregar después)
            messageEl.textContent = 'Error: Cuenta madre creada, pero fallaron los perfiles.';
            return;
        }

        // --- 4. TODO SALIÓ BIEN ---
        messageEl.textContent = `¡Éxito! Cuenta madre y ${cantidadPerfiles} perfiles creados.`;
        messageEl.className = 'success'; // (Agregaremos este estilo)
        stockForm.reset(); // Limpia el formulario
        
        setTimeout(() => { // Limpia el mensaje después de 3 seg
            messageEl.textContent = '';
            messageEl.className = 'error';
        }, 3000);

        saveButton.disabled = false;
        saveButton.textContent = 'Guardar Cuenta';
    });
}
