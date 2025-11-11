//
// --- gestionPagos.js ---
//
import { supabase } from './supabaseClient.js'

// --- 5.1: LÓGICA DE LA PESTAÑA 3 (Control de Pagos) ---

export async function cargarControlDePagos() {
    const listElement = document.getElementById('pagos-list');
    listElement.innerHTML = '<li>Cargando...</li>';
    
    const hoy = new Date();
    const proximaSemana = new Date(new Date().setDate(hoy.getDate() + 7));

    const { data: cuentas, error } = await supabase
        .from('cuentas_madre')
        .select('plataforma, email, fecha_pago_proveedor')
        .eq('estado', 'activa') // Solo cuentas activas
        .not('fecha_pago_proveedor', 'is', null) // Que tengan una fecha
        .lte('fecha_pago_proveedor', proximaSemana.toISOString()) // Que venzan en los próximos 7 días
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
        // Aseguramos que la fecha se interprete correctamente como local
        const fechaPago = new Date(cuenta.fecha_pago_proveedor + 'T00:00:00-05:00'); 
        const fechaFormateada = fechaPago.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        listElement.innerHTML += `
            <li class="stock-item-archivado">
                <strong>${cuenta.plataforma.toUpperCase()}</strong><br>
                <span>Email: ${cuenta.email}</span><br>
                <strong style="color: red;">¡PAGAR ANTES DE: ${fechaFormateada}!</strong>
            </li>
        `;
    });
}
