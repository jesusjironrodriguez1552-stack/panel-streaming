// --- FUNCIONES DE UTILIDAD ---

export function showMessage(element, text, isSuccess = true) {
    const el = document.getElementById(element);
    if (!el) return;
    el.textContent = text;
    el.className = isSuccess ? 'success' : 'error';
    setTimeout(() => { el.textContent = ''; }, 3000);
}
