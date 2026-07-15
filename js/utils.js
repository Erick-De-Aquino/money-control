// ============================================
// UTILIDADES - Funciones de ayuda generales
// ============================================

function formatNumber(value, decimals = 2) {

    const number = Number(value) || 0;

    return number.toLocaleString('de-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });

}

// Formatear número como moneda
function formatCurrency(amount, currency = 'EUR') {

    const currencies = {

        EUR: { symbol: '€' },
        USD: { symbol: '$' },
        USDT:{ symbol: '₮' },
        BS:  { symbol: 'Bs.' },
        COP: { symbol: 'COL$' },
        VES: { symbol: 'Bs.' },
        MXN: { symbol: 'MX$' },
        ARS: { symbol: 'AR$' },
        CLP: { symbol: 'CLP$' },
        PEN: { symbol: 'S/' },
        BRL: { symbol: 'R$' }

    };

    const symbol = currencies[currency]?.symbol || currency;

    const value = Number(amount) || 0;

    return `${symbol} ${formatNumber(value)}`;

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
    
        return formatLocalDate(d);
}

function formatLocalDate(date) {

    const d = new Date(date);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;

}

// Obtener fecha actual en formato YYYY-MM-DD
function getTodayDate() {

    const hoy = new Date();

    const year = hoy.getFullYear();

    const month = String(hoy.getMonth() + 1).padStart(2, '0');

    const day = String(hoy.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;

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

/**
 * Exporta datos a PDF.
 *
 * @param {Array} data
 * @param {string} filename
 * @param {Array} headers
 * @param {Array} columns
 * @param {string} title
 * @param {Object|null} summary
 */
function exportToPDF(
    data,
    filename,
    headers,
    columns,
    title,
    summary = null
) {

    if (!data || data.length === 0) {
        showError('No hay datos para exportar');
        return;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text(title, 14, 18);

    // Fecha
    doc.setFontSize(10);
    doc.text(
        `Generado: ${new Date().toLocaleString()}`,
        14,
        26
    );

    // Tabla principal
    doc.autoTable({
        head: [headers],
        body: data.map(row => columns.map(col => row[col] ?? '')),
        startY: 34,
        styles: {
            fontSize: 9
        },
        headStyles: {
            fillColor: [88, 93, 174]
        }
    });

    // Resumen (opcional)
    if (summary) {

        let y = doc.lastAutoTable.finalY + 12;

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Resumen', 14, y);

        y += 6;

        doc.autoTable({
            startY: y,
            head: [[
                summary.groupTitle,
                'Transacciones',
                'Total',
                '%'
            ]],
            body: summary.items.map(item => [
                item.nombre,
                item.cantidad,
                formatNumber(item.total),
                item.porcentaje.toFixed(1) + ' %'
            ]),
            styles: {
                fontSize: 9
            },
            headStyles: {
                fillColor: [88, 93, 174]
            },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' }
            }
        });

        y = doc.lastAutoTable.finalY + 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');

        doc.text(
            `Total de transacciones: ${summary.totalTransacciones}`,
            14,
            y
        );

        y += 6;

        doc.text(
            `Monto total: ${formatNumber(summary.totalMonto)}`,
            14,
            y
        );

    }

    doc.save(`${filename}.pdf`);
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

// Exportar gastos mostrados en pantalla
function exportarGastosCSV() {
    exportGastosToCSV(gastosList || []);
}

// Exportar gastos mostrados en pantalla a PDF
function exportarGastosPDF() {

    if (!gastosList || gastosList.length === 0) {
        showError('No hay gastos para exportar');
        return;
    }

    const headers = [
        '#',
        'Fecha',
        'Categoría',
        'Monto',
        'Moneda',
        'Descripción'
    ];

    const columns = [
        'numero',
        'fecha',
        'categoria',
        'monto',
        'moneda',
        'descripcion'
    ];

    const data = gastosList.map((g, index) => ({
        numero: index + 1,
        fecha: formatDate(g.fecha, 'short'),
        categoria: g.categoria || 'Sin categoría',
        monto: g.monto,
        moneda: g.moneda,
        descripcion: g.descripcion || ''
    }));

    // Construir resumen
    const totalMonto = gastosList.reduce(
        (sum, g) => sum + Number(g.monto),
        0
    );

    const categorias = {};

    gastosList.forEach(g => {

        const categoria = g.categoria || 'Sin categoría';

        if (!categorias[categoria]) {
            categorias[categoria] = {
                nombre: categoria,
                cantidad: 0,
                total: 0
            };
        }

        categorias[categoria].cantidad++;
        categorias[categoria].total += Number(g.monto);

    });

    const summary = {
        groupTitle: 'Categoría',
        totalTransacciones: gastosList.length,
        totalMonto,
        items: Object.values(categorias)
            .map(item => ({
                ...item,
                porcentaje: totalMonto > 0
                    ? item.total * 100 / totalMonto
                    : 0
            }))
            .sort((a, b) => b.total - a.total)
    };

    exportToPDF(
        data,
        'gastos',
        headers,
        columns,
        'Listado de Gastos',
        summary
    );

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

// Exportar ingresos mostrados en pantalla
function exportarIngresosCSV() {
    exportIngresosToCSV(ingresosList || []);
}

// Exportar ingresos mostrados en pantalla a PDF
function exportarIngresosPDF() {

    if (!ingresosList || ingresosList.length === 0) {
        showError('No hay ingresos para exportar');
        return;
    }

    const headers = [
        '#',
        'Fecha',
        'Origen',
        'Monto',
        'Moneda',
        'Descripción'
    ];

    const columns = [
        'numero',
        'fecha',
        'origen',
        'monto',
        'moneda',
        'descripcion'
    ];

    const data = ingresosList.map((i, index) => ({
        numero: index + 1,
        fecha: formatDate(i.fecha, 'short'),
        origen: i.origen || 'Sin origen',
        monto: i.monto,
        moneda: i.moneda,
        descripcion: i.descripcion || ''
    }));

    // Construir resumen
    const totalMonto = ingresosList.reduce(
        (sum, i) => sum + Number(i.monto),
        0
    );

    const origenes = {};

    ingresosList.forEach(i => {

        const origen = i.origen || 'Sin origen';

        if (!origenes[origen]) {
            origenes[origen] = {
                nombre: origen,
                cantidad: 0,
                total: 0
            };
        }

        origenes[origen].cantidad++;
        origenes[origen].total += Number(i.monto);

    });

    const summary = {
        groupTitle: 'Origen',
        totalTransacciones: ingresosList.length,
        totalMonto,
        items: Object.values(origenes)
            .map(item => ({
                ...item,
                porcentaje: totalMonto > 0
                    ? item.total * 100 / totalMonto
                    : 0
            }))
            .sort((a, b) => b.total - a.total)
    };

    exportToPDF(
        data,
        'ingresos',
        headers,
        columns,
        'Listado de Ingresos',
        summary
    );

}

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

// Exportar categorías mostradas en pantalla
function exportarCategoriasCSV() {
    exportCategoriasToCSV(
        window.categoriasGastos || [],
        window.categoriasIngresos || []
    );
}

// Exportar categorías mostradas en pantalla a PDF
function exportarCategoriasPDF() {

    const categoriasGastos = window.categoriasGastos || [];
    const categoriasIngresos = window.categoriasIngresos || [];

    const todas = [
        ...categoriasGastos.map(c => ({
            nombre: c.nombre,
            tipo: 'Gasto'
        })),
        ...categoriasIngresos.map(c => ({
            nombre: c.nombre,
            tipo: 'Ingreso'
        }))
    ];

    if (todas.length === 0) {
        showError('No hay categorías para exportar');
        return;
    }

    const headers = [
        'Nombre',
        'Tipo'
    ];

    const columns = [
        'nombre',
        'tipo'
    ];

    exportToPDF(
        todas,
        'categorias',
        headers,
        columns,
        'Listado de Categorías'
    );

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
        themeToggle.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';
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

/**
 * Inicializa un menú desplegable para exportar datos.
 *
 * @param {string} buttonId - ID del botón que abrirá el menú.
 * @param {Object} options
 * @param {Function} options.onCSV - Función que se ejecutará al seleccionar CSV.
 * @param {Function} options.onPDF - Función que se ejecutará al seleccionar PDF.
 */
function initExportMenu(buttonId, { onCSV, onPDF }) {

    const button = document.getElementById(buttonId);

    if (!button) return;

    // Evita inicializar dos veces el mismo botón
    if (button.dataset.exportMenuInitialized === 'true') return;
    button.dataset.exportMenuInitialized = 'true';

    const css = getComputedStyle(document.documentElement);

    const bgCard = css.getPropertyValue('--bg-card').trim();
    const bgHover = css.getPropertyValue('--bg-hover').trim();
    const text = css.getPropertyValue('--text-primary').trim();
    const border = css.getPropertyValue('--border-light').trim();

    // Crear menú
    const menu = document.createElement('div');
    menu.className = 'export-menu-dropdown';

    menu.innerHTML = `
        <button type="button" class="export-menu-item export-csv">
            <i class="fas fa-file-csv"></i>
            CSV
        </button>

        <button type="button" class="export-menu-item export-pdf">
            <i class="fas fa-file-pdf"></i>
            PDF
        </button>
    `;

    Object.assign(menu.style, {
        position: 'absolute',
        display: 'none',
        minWidth: '170px',
        backgroundColor: bgCard,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,.15)',
        overflow: 'hidden',
        zIndex: '99999'
    });

    document.body.appendChild(menu);

    // Estilo de los botones
    menu.querySelectorAll('.export-menu-item').forEach(item => {

        Object.assign(item.style, {
            width: '100%',
            padding: '10px 14px',
            border: 'none',
            backgroundColor: bgCard,
            color: text,
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        });

        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = bgHover;
        });

        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = bgCard;
        });

    });

    // Abrir/Cerrar menú
    button.addEventListener('click', function (e) {

        e.stopPropagation();

        const rect = button.getBoundingClientRect();

        menu.style.left = `${rect.left + window.scrollX}px`;
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;

        menu.style.display =
            menu.style.display === 'block'
                ? 'none'
                : 'block';

    });

    // Exportar CSV
    menu.querySelector('.export-csv').addEventListener('click', function (e) {

        e.stopPropagation();

        menu.style.display = 'none';

        if (typeof onCSV === 'function') {
            onCSV();
        }

    });

    // Exportar PDF
    menu.querySelector('.export-pdf').addEventListener('click', function (e) {

        e.stopPropagation();

        menu.style.display = 'none';

        if (typeof onPDF === 'function') {
            onPDF();
        }

    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', function () {

        menu.style.display = 'none';

    });

}

console.log('✅ Utilidades cargadas correctamente');
