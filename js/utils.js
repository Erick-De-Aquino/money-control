// ============================================
// UTILIDADES - Funciones de ayuda generales
// ============================================

// Formatear número como moneda
function formatCurrency(amount, currency = 'EUR') {
    const symbols = {
        EUR: '€',
        USDT: '₿',
        BS: 'Bs.'
    };
    
    const symbol = symbols[currency] || currency;
    const formattedAmount = typeof amount === 'number' ? amount.toFixed(2) : '0.00';
    
    return `${symbol} ${formattedAmount}`;
}

// Formatear fecha
function formatDate(date, format = 'short') {
    const d = new Date(date);
    
    if (format === 'short') {
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } else if (format === 'long') {
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } else if (format === 'datetime') {
        return d.toLocaleString('es-ES');
    }
    
    return d.toISOString().split('T')[0];
}

// Obtener fecha actual en formato YYYY-MM-DD
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// Mostrar mensaje de error
function showError(message, containerId = 'loginMessage') {
    const container = document.getElementById(containerId);
    if (container) {
        container.textContent = message;
        container.className = 'message error show';
        
        // Ocultar después de 3 segundos
        setTimeout(() => {
            container.classList.remove('show');
        }, 3000);
    } else {
        console.error('Error:', message);
        alert(message);
    }
}

// Mostrar mensaje de éxito
function showSuccess(message, containerId = 'loginMessage') {
    const container = document.getElementById(containerId);
    if (container) {
        container.textContent = message;
        container.className = 'message success show';
        
        // Ocultar después de 3 segundos
        setTimeout(() => {
            container.classList.remove('show');
        }, 3000);
    }
}

// Mostrar mensaje de información
function showInfo(message, containerId) {
    const container = containerId ? document.getElementById(containerId) : document.querySelector('.message');
    if (container) {
        container.textContent = message;
        container.className = 'message info show';
        
        setTimeout(() => {
            container.classList.remove('show');
        }, 3000);
    }
}

// Validar email
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Validar monto
function isValidAmount(amount) {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
}

// Validar formulario por campos requeridos
function validateForm(formElement, requiredFields) {
    const errors = [];
    
    for (const field of requiredFields) {
        const input = formElement.querySelector(`[name="${field}"]`);
        if (!input || !input.value.trim()) {
            errors.push(`El campo ${field} es requerido`);
        }
    }
    
    return errors;
}

// Mostrar loading en un botón
function showButtonLoading(button, text = 'Cargando...') {
    const originalText = button.textContent;
    button.setAttribute('data-original-text', originalText);
    button.textContent = text;
    button.disabled = true;
    button.classList.add('btn-loading');
}

// Ocultar loading de un botón
function hideButtonLoading(button) {
    const originalText = button.getAttribute('data-original-text');
    if (originalText) {
        button.textContent = originalText;
    }
    button.disabled = false;
    button.classList.remove('btn-loading');
}

// Debounce para evitar ejecuciones múltiples
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Formatear número para input
function formatNumberInput(value) {
    let num = value.replace(/[^0-9.]/g, '');
    const parts = num.split('.');
    if (parts.length > 2) {
        num = parts[0] + '.' + parts.slice(1).join('');
    }
    return num;
}

// Calcular balance (ingresos - gastos)
function calculateBalance(ingresos, gastos) {
    const totalIngresos = ingresos.reduce((sum, item) => sum + (item.monto_eur || item.monto), 0);
    const totalGastos = gastos.reduce((sum, item) => sum + (item.monto_eur || item.monto), 0);
    return totalIngresos - totalGastos;
}

// Agrupar por mes
function groupByMonth(data, dateField = 'fecha') {
    const grouped = {};
    
    data.forEach(item => {
        const date = new Date(item[dateField]);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(item);
    });
    
    return grouped;
}

// Ordenar por fecha (más reciente primero)
function sortByDate(items, dateField = 'fecha', descending = true) {
    return [...items].sort((a, b) => {
        const dateA = new Date(a[dateField]);
        const dateB = new Date(b[dateField]);
        return descending ? dateB - dateA : dateA - dateB;
    });
}

// Generar ID único temporal
function generateTempId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Copiar texto al portapapeles
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showSuccess('Copiado al portapapeles');
        return true;
    } catch (error) {
        console.error('Error al copiar:', error);
        return false;
    }
}

// Exportar datos a CSV
function exportToCSV(data, filename, columns) {
    const csvRows = [];
    csvRows.push(columns.join(','));
    
    for (const row of data) {
        const values = columns.map(col => {
            let value = row[col] || '';
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${getTodayDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showSuccess('Exportación completada');
}

// Modal de confirmación personalizado
function showConfirmModal(message, onConfirm, title = 'Confirmar') {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    
    if (!modal) return;
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Remover eventos anteriores
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newConfirmBtn.onclick = () => {
        modal.classList.remove('active');
        onConfirm();
    };
    
    newCancelBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    modal.classList.add('active');
}

// Exportar gastos a CSV
function exportGastosToCSV(gastos) {
    if (!gastos || gastos.length === 0) {
        showError('No hay gastos para exportar');
        return;
    }
    
    const columns = ['fecha', 'categoria', 'monto', 'moneda', 'monto_eur', 'descripcion'];
    const headers = ['Fecha', 'Categoría', 'Monto', 'Moneda', 'Monto (EUR)', 'Descripción'];
    
    const data = gastos.map(g => ({
        fecha: formatDate(g.fecha, 'short'),
        categoria: g.categoria || 'Sin categoría',
        monto: g.monto,
        moneda: g.moneda,
        monto_eur: g.monto_eur || g.monto,
        descripcion: g.descripcion || ''
    }));
    
    exportToCSV(data, 'gastos', headers, columns);
}

// Exportar ingresos a CSV
function exportIngresosToCSV(ingresos) {
    if (!ingresos || ingresos.length === 0) {
        showError('No hay ingresos para exportar');
        return;
    }
    
    const columns = ['fecha', 'origen', 'monto', 'moneda', 'monto_eur', 'descripcion'];
    const headers = ['Fecha', 'Origen', 'Monto', 'Moneda', 'Monto (EUR)', 'Descripción'];
    
    const data = ingresos.map(i => ({
        fecha: formatDate(i.fecha, 'short'),
        origen: i.origen || 'Sin origen',
        monto: i.monto,
        moneda: i.moneda,
        monto_eur: i.monto_eur || i.monto,
        descripcion: i.descripcion || ''
    }));
    
    exportToCSV(data, 'ingresos', headers, columns);
}

// Exportar ingresos a CSV
// Exportar datos a CSV
function exportToCSV(data, filename, headers, columns) {
    if (!data || data.length === 0) {
        showError('No hay datos para exportar');
        return;
    }
    
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of data) {
        const values = columns.map(col => {
            let value = row[col] !== undefined ? row[col] : '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${getTodayDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showSuccess(`Exportación completada: ${filename}_${getTodayDate()}.csv`);
}

// Exportar categorías a CSV
function exportCategoriasToCSV(categoriasGastos, categoriasIngresos) {
    const todas = [
        ...categoriasGastos.map(c => ({ nombre: c.nombre, tipo: 'Gasto' })),
        ...categoriasIngresos.map(c => ({ nombre: c.nombre, tipo: 'Ingreso' }))
    ];
    
    if (todas.length === 0) {
        showError('No hay categorías para exportar');
        return;
    }
    
    const columns = ['nombre', 'tipo'];
    const headers = ['Nombre', 'Tipo'];
    
    exportToCSV(todas, 'categorias', headers, columns);
}

// ===== MODO OSCURO =====
function initTheme() {
    // Verificar preferencia guardada
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

function updateThemeIcon(isDark) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

// Escuchar cambios en el sistema
function listenSystemTheme() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
            if (e.matches) {
                document.body.classList.add('dark-mode');
                updateThemeIcon(true);
            } else {
                document.body.classList.remove('dark-mode');
                updateThemeIcon(false);
            }
        }
    });
}

// Inicializar tema al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    listenSystemTheme();
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});

// Toggle para mostrar/ocultar contraseñas
function initPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                // Cambiar SVG
                if (type === 'password') {
                    this.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>`;
                } else {
                    this.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>`;
                }
            }
        });
    });
}

console.log('✅ Utilidades cargadas correctamente');