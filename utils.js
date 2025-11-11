//
// --- utils.js (VERSIÓN FINAL Y CORRECTA) ---
//

// Función de mensajes simples (éxito/error)
export function showMessage(element, text, isSuccess = true) {
    const el = document.getElementById(element);
    if (!el) return;
    el.textContent = text;
    el.className = isSuccess ? 'success' : 'error';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// Función que genera el texto para copiar
export function mostrarMensajeCliente(cuenta, nombrePerfil, fechaVence, tipo) {
    let textoCliente = '';
    
    if (tipo === 'nuevo') {
        const venceFormateado = fechaVence.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        textoCliente = `CUENTA ${cuenta.plataforma.toUpperCase()}
CORREO: ${cuenta.email}
CONTRASEÑA: ${cuenta.contrasena}
PERFIL: ${nombrePerfil}
VENCE: ${venceFormateado}`;
    } else { // 'reactiva'
        textoCliente = `POR SU SEGURIDAD SE HA MODIFICADO EL CORREO DE SU CUENTA:
CORREO: ${cuenta.email}
CONTRASEÑA: ${cuenta.contrasena}
PERFIL: ${nombrePerfil}`;
    }
    
    const outputArea = document.getElementById('output-area');
    const outputText = document.getElementById('output-text');
    
    if (outputText) {
        outputText.value = textoCliente; 
    }
    
    if (outputArea) {
        outputArea.style.display = 'block';
        outputArea.scrollIntoView({ behavior: 'smooth' });
    }
}
