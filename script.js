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
        
        // ¡CORRECCIÓN! Llama a initApp() solo si hay sesión y estamos en index.html
        initApp(); 
    }
}
// Llama al portero en cuanto el script se carga
checkAuth()

// --- Lógica de Login (en login.html) ---
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

// --- Lógica de Logout (en index.html) ---
const logoutButton = document.getElementById('logout-button')
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'login.html'
    })
}

// --- 3. LÓGICA DE LA APP (¡NUEVA ESTRUCTURA DE PESTAÑAS!) ---

// Función para inicializar la app (pestañas y carga de datos)
function initApp() {
    // Lógica de navegación de pestañas
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Quitar 'active' de todos
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // 2. Añadir 'active' al clickeado
            tab.classList.add('active');
            const targetContent = document.getElementById(tab.dataset.tab);
            targetContent.classList.add('active');

            // 3. Cargar el contenido de esa pestaña
            loadTabContent(tab.dataset.tab);
        });
    });

    // Cargar la primera pestaña por defecto
    loadTabContent('gestion');
}

// Función que decide qué cargar según la pestaña
function loadTabContent(tabName) {
    if (tabName === 'gestion') {
        cargarCuentasMadre();
    } else if (tabName === 'perfiles') {
        cargarTodosLosPerfiles();
    } else if (tabName === 'pagos') {
        cargarControlDePagos();
    }
}

// Función para mostrar mensajes
function showMessage(element, text, isSuccess = true) {
    const el = document.getElementById(element);
    if (!el) return;
    el.textContent = text;
    el.className = isSuccess ? 'success' : 'error';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// --- PESTAÑA 1: GESTIÓN DE CUENTAS ---

// Lógica del formulario de guardar (¡NUEVA LÓGICA!)
const stockForm = document.getElementById('stock-form');
if (stockForm) {
    stockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Guardando...';

        // 1. Datos del formulario
        const plataforma = document.getElementById('plataforma-input').value;
        const email = document.getElementById('email-input').value;
        const contrasena = document.getElementById('password-input').value;
        const cantidadPerfiles = parseInt(document.getElementById('perfiles-input').value);
        const fechaPago = document.getElementById('fecha-proveedor-input').value;

        // 2. Insertar la Cuenta Madre
        const { data: cuentaMadre, error: errorMadre } = await supabase
            .from('cuentas_madre')
            .insert({ 
                plataforma: plataforma,
                email: email, 
                contrasena: contrasena, 
                fecha_pago_proveedor: fechaPago,
                estado: 'activa' // ¡Estado inicial!
            })
            .select('id') // ¡Importante! Pedimos que nos devuelva el ID
            .single();

        if (errorMadre) {
            showMessage('form-message', 'Error: ' + errorMadre.message, false);
            button.disabled = false;
            button.textContent = 'Guardar Cuenta';
            return;
        }

        // 3. ¡Éxito! Ahora creamos los perfiles "libres"
        const nuevaCuentaMadreId = cuentaMadre.id;
        const perfilesParaInsertar = [];
        
        for (let i = 1; i <= cantidadPerfiles; i++) {
            perfilesParaInsertar.push({
                cuenta_madre_id: nuevaCuentaMadreId,
                nombre_perfil: `Perfil Libre ${i}`,
                estado: 'libre',
                cliente_id: null,
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
            stockForm.reset();
            cargarCuentasMadre(); // Recarga la lista
        }
        
        button.disabled = false;
        button.textContent = 'Guardar Cuenta';
    });
}

// Cargar la lista de Cuentas Madre (Pestaña 1)
async function cargarCuentasMadre() {
    const listElement = document.getElementById('cuentas-madre-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    const { data: cuentas, error } = await supabase
        .from('cuentas_madre')
        .select(`
            *,
            perfiles ( id, estado )
        `)
        .order('id', { ascending: false });

    if (error) {
        listElement.innerHTML = '<li>Error al cargar cuentas.</li>';
        return;
    }
    if (cuentas.length === 0) {
        listElement.innerHTML = '<li>No hay cuentas guardadas.</li>';
        return;
    }

    listElement.innerHTML = '';
    cuentas.forEach(cuenta => {
        const esArchivada = cuenta.estado === 'archivada';
        const itemClass = esArchivada ? 'stock-item-archivado' : 'stock-item';
        
        // Contamos los perfiles libres
        const perfilesLibres = cuenta.perfiles.filter(p => p.estado === 'libre').length;
        
        listElement.innerHTML += `
            <li class="${itemClass}">
                <strong>${cuenta.plataforma.toUpperCase()}</strong>
                ${esArchivada ? ' <span style="color:red; font-weight:bold;">(ARCHIVADA)</span>' : ''}
                <br>
                <span>${cuenta.email} | ${cuenta.contrasena}</span><br>
                <strong>Perfiles Libres:</strong> <span style="font-weight: bold; color: ${perfilesLibres > 0 ? 'green' : 'red'};">${perfilesLibres}</span>
                <br><br>
                
                ${!esArchivada ? `
                    <button class="btn-small assign-btn" data-id="${cuenta.id}" ${perfilesLibres === 0 ? 'disabled' : ''}>Asignar (Nuevo)</button>
                    <button class="btn-small reactiva-btn" data-id="${cuenta.id}" ${perfilesLibres === 0 ? 'disabled' : ''}>Asignar (Reactiva)</button>
                    <button class="btn-small delete-btn" data-id="${cuenta.id}">Borrar</button>
                ` : `
                    <button class="btn-small delete-btn" data-id="${cuenta.id}">Borrar (Definitivo)</button>
                `}
            </li>
        `;
    });

    // --- ¡CORRECCIÓN! Añadir listeners DESPUÉS de crear los botones ---
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.id;
            const cuenta = cuentas.find(c => c.id == id);
            borrarCuenta(cuenta);
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
            asignarPerfil(cuenta, 'reactiva');
        });
    });
}

// Función para Asignar Perfil (¡NUEVA LÓGICA!)
async function asignarPerfil(cuenta, tipo) {
    const nombrePerfil = prompt('Escribe el nombre del perfil para el cliente:');
    if (!nombrePerfil) return;
    
    // (Opcional: aquí podríamos mostrar una lista de clientes para elegir)
    // Por ahora, asumimos que el cliente se maneja manualmente

    // 1. Buscar el primer perfil "libre" de esta cuenta
    const { data: perfilLibre, error: findError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('cuenta_madre_id', cuenta.id)
        .eq('estado', 'libre')
        .limit(1)
        .single();
    
    if (findError || !perfilLibre) {
        alert('Error: No se encontró un perfil libre para esta cuenta.');
        return;
    }

    // 2. Calcular fecha de vencimiento (hoy + 30 días)
    const hoy = new Date();
    const vence = new Date(hoy.setDate(hoy.getDate() + 30));
    const venceFormateado = vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // 3. Actualizar el perfil
    const { error: updateError } = await supabase
        .from('perfiles')
        .update({
            nombre_perfil: nombrePerfil,
            estado: 'asignado',
            fecha_vencimiento_cliente: vence.toISOString()
            // cliente_id: ... (aquí iría el ID del cliente)
        })
        .eq('id', perfilLibre.id);

    if (updateError) {
        // ¡¡¡AQUÍ ESTABA EL ERROR!!! Se borró la 'M'
        alert('Error al asignar el perfil: ' + updateError.message); 
        return;
    }

    // 4. Generar el texto para el cliente
    let textoCliente = '';
    if (tipo === 'nuevo') {
        textoCliente = `
CUENTA ${cuenta.plataforma.toUpperCase()}
CORREO: ${cuenta.email}
CONTRASEÑA: ${cuenta.contrasena}
PERFIL: ${nombrePerfil}
VENCE: ${venceFormateado}
        `.trim();
    } else {
        textoCliente = `
POR SU SEGURIDAD SE A MODIFICADO EL CORREO DE SU CUENTA:
CORREO: ${cuenta.email}
CONTRASEÑA: ${cuenta.contrasena}
PERFIL: ${nombrePerfil}
        `.trim();
    }

    // 5. Mostrar resultado y recargar
    const outputArea = document.getElementById('output-area');
    const outputText = document.getElementById('output-text');
    outputText.value = textoCliente; 
    outputArea.style.display = 'block';
    outputArea.scrollIntoView({ behavior: 'smooth' });
    
    cargarCuentasMadre(); // Recarga la lista de cuentas
}

// Función para Borrar/Archivar Cuenta (¡NUEVA LÓGICA!)
async function borrarCuenta(cuenta) {
    if (cuenta.estado === 'archivada') {
        // --- BORRADO PERMANENTE ---
        if (!confirm('Esta cuenta ya está archivada. ¿Quieres BORRARLA PERMANENTEMENTE? (Se borrarán todos sus perfiles)')) return;
        
        // 1. Borrar perfiles
        await supabase.from('perfiles').delete().eq('cuenta_madre_id', cuenta.id);
        // 2. Borrar cuenta madre
        await supabase.from('cuentas_madre').delete().eq('id', cuenta.id);
        
        cargarCuentasMadre();

    } else {
        // --- ARCHIVADO (Pone perfiles "huérfanos") ---
        if (!confirm('¿Seguro que quieres BORRAR (archivar) esta cuenta madre? Sus perfiles se marcarán como "huérfanos".')) return;

        // 1. Archivar la cuenta madre
        await supabase.from('cuentas_madre').update({ estado: 'archivado' }).eq('id', cuenta.id);
        
        // 2. Poner todos sus perfiles "libres" o "asignados" como "huerfano"
        await supabase
            .from('perfiles')
            .update({ estado: 'huerfano' })
            .eq('cuenta_madre_id', cuenta.id)
            .in('estado', ['libre', 'asignado']);
            
        cargarCuentasMadre(); // Recarga la lista actual
    }
}


// --- PESTAÑA 2: CONTROL DE PERFILES ---

async function cargarTodosLosPerfiles() {
    const listElement = document.getElementById('perfiles-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    const { data: perfiles, error } = await supabase
        .from('perfiles')
        .select(`
            id,
            nombre_perfil,
            estado,
            fecha_vencimiento_cliente,
            cuentas_madre ( plataforma, email )
        `)
        .order('id', { ascending: false });

    if (error) {
        listElement.innerHTML = '<li>Error al cargar perfiles.</li>';
        return;
    }
    if (perfiles.length === 0) {
        listElement.innerHTML = '<li>No hay perfiles en el sistema.</li>';
        return;
    }

    listElement.innerHTML = '';
    perfiles.forEach(perfil => {
        let estadoClass = `estado-${perfil.estado}`; // estado-libre, estado-asignado, etc.
        let info = `Plataforma: ${perfil.cuentas_madre ? perfil.cuentas_madre.plataforma : '???'}`;
        
        if (perfil.estado === 'asignado') {
            const vence = new Date(perfil.fecha_vencimiento_cliente);
            info = `Vence: ${vence.toLocaleDateString('es-ES')}`;
            
            // Revisar si está vencido
            if (vence < new Date()) {
                perfil.estado = 'vencido'; // Corregimos el estado
                estadoClass = 'estado-vencido';
            }
        }
        
        listElement.innerHTML += `
            <li class="perfil-item">
                <div>
                    <strong>${perfil.nombre_perfil}</strong> <br>
                    <small>${info}</small>
                </div>
                <span class="perfil-estado ${estadoClass}">${perfil.estado.toUpperCase()}</span>
            </li>
        `;
    });
}


// --- PESTAÑA 3: CONTROL DE PAGOS ---

async function cargarControlDePagos() {
    const listElement = document.getElementById('pagos-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    // Calculamos la fecha de "próximos 7 días"
    const hoy = new Date();
    const proximaSemana = new Date(new Date().setDate(hoy.getDate() + 7));

    const { data: cuentas, error } = await supabase
        .from('cuentas_madre')
        .select('plataforma, email, fecha_pago_proveedor')
        .eq('estado', 'activa')
        // Filtramos fechas que no son nulas y son menores o iguales a la próxima semana
        .not('fecha_pago_proveedor', 'is', null)
        .lte('fecha_pago_proveedor', proximaSemana.toISOString()) 
        .order('fecha_pago_proveedor', { ascending: true });
        
    if (error) {
        console.error("Error cargando pagos:", error)
        listElement.innerHTML = '<li>Error al cargar pagos.</li>';
        return;
    }
    if (cuentas.length === 0) {
        listElement.innerHTML = '<li>No hay pagos por vencer en los próximos 7 días.</li>';
        return;
    }
    
    listElement.innerHTML = '';
    cuentas.forEach(cuenta => {
        const fechaPago = new Date(cuenta.fecha_pago_proveedor + 'T00:00:00-05:00');
        const fechaFormateada = fechaPago.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        listElement.innerHTML += `
            <li class="stock-item-archivado"> <strong>${cuenta.plataforma.toUpperCase()}</strong><br>
                <span>Email: ${cuenta.email}</span><br>
                <strong style="color: red;">¡PAGAR ANTES DE: ${fechaFormateada}!</strong>
            </li>
        `;
    });
}
