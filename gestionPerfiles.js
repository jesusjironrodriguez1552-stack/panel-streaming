//
// --- gestionPerfiles.js ---
//

// (Otras funciones como initGestionPerfiles, etc. quedan igual)
// ...

// ¡REEMPLAZA ESTA FUNCIÓN ENTERA!
export async function cargarTodosLosPerfiles() {
    const listElement = document.getElementById('perfiles-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    const { data: perfiles, error } = await supabase
        .from('perfiles')
        .select(`
            id,
            nombre_perfil,
            estado,
            fecha_vencimiento_cliente,
            cuentas_madre ( id, plataforma, email, contrasena ) 
        `)
        .order('id', { ascending: false });

    if (error) {
        listElement.innerHTML = '<li>Error al cargar perfiles.</li>';
        console.error("Error cargando perfiles:", error);
        return;
    }
    if (perfiles.length === 0) {
        listElement.innerHTML = '<li>No hay perfiles en el sistema.</li>';
        return;
    }

    listElement.innerHTML = '';

    // --- ¡NUEVO! Sistema de Alertas ---
    let vencidosCount = 0;
    let vencenProntoCount = 0;
    let alertMostrada = false; // Para que el alert() solo salga una vez

    // Definimos las fechas UNA SOLA VEZ
    const hoy = new Date();
    hoy.setHours(0,0,0,0); // Clave para comparar solo fechas

    const tresDias = new Date(hoy);
    tresDias.setDate(hoy.getDate() + 3);
    // --- Fin del Sistema de Alertas ---

    perfiles.forEach(perfil => {
        let estadoClass = `estado-${perfil.estado}`;
        let info = '';
        let estadoReal = perfil.estado;
        let itemExtraClass = ''; // <-- ¡NUEVO! Clase para colorear la fila

        // Lógica para mostrar la información correcta
        if (perfil.cuentas_madre) {
            info = `Plataforma: ${perfil.cuentas_madre.plataforma}`;
        } else if (perfil.estado === 'huerfano') {
            info = '¡CUENTA MADRE ELIMINADA!';
        } else if (perfil.estado === 'libre') {
            info = `Plataforma: ${perfil.cuentas_madre ? perfil.cuentas_madre.plataforma : '???'}`;
        }

        // --- ¡NUEVO! Lógica de Vencimiento Mejorada ---
        if (perfil.estado === 'asignado') {
            const vence = new Date(perfil.fecha_vencimiento_cliente);
            // No reseteamos 'vence', usamos la fecha exacta
            
            if (vence < hoy) {
                // --- VENCIDO ---
                estadoReal = 'vencido';
                estadoClass = 'estado-vencido';
                info = `¡VENCIDO! (Desde ${vence.toLocaleDateString('es-ES')})`;
                itemExtraClass = 'perfil-item-vencido'; // Clase para fila ROJA
                vencidosCount++;
            
            } else if (vence.getTime() === hoy.getTime()) {
                // --- VENCE HOY ---
                info = `¡¡VENCE HOY!!`;
                itemExtraClass = 'perfil-item-hoy'; // Clase para fila NARANJA
                vencenProntoCount++;

            } else if (vence <= tresDias) {
                // --- VENCE PRONTO (en 1, 2 o 3 días) ---
                info = `Vence pronto: ${vence.toLocaleDateString('es-ES')}`;
                itemExtraClass = 'perfil-item-pronto'; // Clase para fila AMARILLA
                vencenProntoCount++;

            } else {
                // --- Normal ---
                info = `Vence: ${vence.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            }
        }
        
        // Formatear fecha para el input 'date' del modal
        const fechaParaInput = perfil.fecha_vencimiento_cliente ? new Date(perfil.fecha_vencimiento_cliente).toISOString().split('T')[0] : '';

        // ¡NUEVO! Añadimos la 'itemExtraClass' al <li>
        listElement.innerHTML += `
            <li class="perfil-item ${itemExtraClass}">
                <div>
                    <strong>${perfil.nombre_perfil}</strong> <br>
                    <small>${info}</small>
                </div>
                <div class="perfil-controles">
                    <span class="perfil-estado ${estadoClass}">${estadoReal.toUpperCase()}</span>
                    
                    <button class="btn-small edit-perfil-btn" 
                        data-id="${perfil.id}"
                        data-nombre="${perfil.nombre_perfil}"
                        data-estado="${perfil.estado}"
                        data-fecha="${fechaParaInput}"
                    >
                        ✏️ Editar
                    </button>
                </div>
            </li>
        `;
    });

    // Añadir listeners para los botones de "Editar"
    document.querySelectorAll('.edit-perfil-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            abrirModalEditar(e.currentTarget.dataset);
        });
    });

    // --- ¡NUEVO! Lanzar el Pop-up de Advertencia ---
    // (Usamos un truco con sessionStorage para que solo salga 1 vez por sesión)
    if (!sessionStorage.getItem('alertaVencimientoMostrada')) {
        let alertMessage = '';
        if (vencidosCount > 0) {
            alertMessage += `¡ATENCIÓN!\n\nTienes ${vencidosCount} perfiles VENCIDOS.\n`;
        }
        if (vencenProntoCount > 0) {
            alertMessage += `Tienes ${vencenProntoCount} perfiles que vencen HOY o en los próximos 3 días.\n`;
        }

        if (alertMessage) {
            alert(alertMessage + "\nRevisa la lista de perfiles marcados en color.");
            sessionStorage.setItem('alertaVencimientoMostrada', 'true'); // Marcamos que ya la vimos
        }
    }
}
