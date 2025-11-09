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
