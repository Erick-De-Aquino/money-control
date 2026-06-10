<<<<<<< HEAD
// ============================================
// DASHBOARD - Estadísticas y gráficos
// ============================================

// Variables globales para gráficos
let monthlyChart = null;
let categoryChart = null;
// Variables de filtros del dashboard
let filtroDashboard = {
    desde: '',
    hasta: '',
    categoria: ''
};

// Cargar datos para el dashboard
async function loadDashboardData() {
    try {
        const supabase = getSupabase();
        
        // Consulta de gastos con filtros
        let gastosQuery = supabase.from(TABLES.gastos).select('*');
        if (filtroDashboard.desde) {
            gastosQuery = gastosQuery.gte('fecha', filtroDashboard.desde);
        }
        if (filtroDashboard.hasta) {
            gastosQuery = gastosQuery.lte('fecha', filtroDashboard.hasta);
        }
        if (filtroDashboard.categoria) {
            gastosQuery = gastosQuery.eq('categoria', filtroDashboard.categoria);
        }
        
        const { data: gastos, error: errorGastos } = await gastosQuery;
        if (errorGastos) console.error('Error cargando gastos:', errorGastos);
        
        // Consulta de ingresos (sin filtro de categoría porque es de gastos)
        let ingresosQuery = supabase.from(TABLES.ingresos).select('*');
        if (filtroDashboard.desde) {
            ingresosQuery = ingresosQuery.gte('fecha', filtroDashboard.desde);
        }
        if (filtroDashboard.hasta) {
            ingresosQuery = ingresosQuery.lte('fecha', filtroDashboard.hasta);
        }
        
        const { data: ingresos, error: errorIngresos } = await ingresosQuery;
        if (errorIngresos) console.error('Error cargando ingresos:', errorIngresos);
        
        const operaciones = await loadOperaciones();
        
        const totalGastos = (gastos || []).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
        const totalIngresos = (ingresos || []).reduce((sum, i) => sum + (i.monto_eur || i.monto), 0);
        const balance = totalIngresos - totalGastos;
        const gananciaOperaciones = operaciones.reduce((sum, o) => sum + (o.ganancia_perdida || 0), 0);
        
        updateStatsDisplay(totalGastos, totalIngresos, balance, gananciaOperaciones);
        updateMonthlyChart(gastos || [], ingresos || []);
        updateCategoryChart(gastos || []);
        updateIncomeCategoryChart(ingresos || []);
        
        // Verificar alertas de presupuesto (nuevas con 75/90/100)
        if (typeof verificarTodasAlertas === 'function') {
            verificarTodasAlertas();
        }
        
        return { totalGastos, totalIngresos, balance, gananciaOperaciones };
        
    } catch (error) {
        console.error('Error en loadDashboardData:', error);
        return null;
    }
}

// Actualizar estadísticas en UI
function updateStatsDisplay(totalGastos, totalIngresos, balance, gananciaOperaciones) {
    const totalGastosEl = document.getElementById('totalGastos');
    const totalIngresosEl = document.getElementById('totalIngresos');
    const balanceEl = document.getElementById('balance');
    
    if (totalGastosEl) {
        totalGastosEl.textContent = formatCurrency(totalGastos, 'EUR');
    }
    
    if (totalIngresosEl) {
        totalIngresosEl.textContent = formatCurrency(totalIngresos, 'EUR');
    }
    
    if (balanceEl) {
        balanceEl.textContent = formatCurrency(balance, 'EUR');
        // Cambiar color según balance
        if (balance >= 0) {
            balanceEl.style.color = 'var(--success, #4CAF50)';
        } else {
            balanceEl.style.color = 'var(--error, #f44336)';
        }
    }
    
    // Mostrar ganancia de operaciones si existe el elemento
    const gananciaOperacionesEl = document.getElementById('gananciaOperaciones');
    if (gananciaOperacionesEl) {
        gananciaOperacionesEl.textContent = formatCurrency(gananciaOperaciones, 'EUR');
        if (gananciaOperaciones >= 0) {
            gananciaOperacionesEl.style.color = 'var(--success, #4CAF50)';
        } else {
            gananciaOperacionesEl.style.color = 'var(--error, #f44336)';
        }
    }
}

// Actualizar gráfico mensual (línea)
function updateMonthlyChart(gastos, ingresos) {
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    
    // Agrupar por mes
    const gastosPorMes = {};
    const ingresosPorMes = {};
    
    gastos.forEach(g => {
        const mes = g.fecha.substring(0, 7); // YYYY-MM
        gastosPorMes[mes] = (gastosPorMes[mes] || 0) + (g.monto_eur || g.monto);
    });
    
    ingresos.forEach(i => {
        const mes = i.fecha.substring(0, 7);
        ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + (i.monto_eur || i.monto);
    });
    
    // Obtener últimos 6 meses
    const meses = [];
    const gastosData = [];
    const ingresosData = [];
    
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        
        meses.push(nombreMes);
        gastosData.push(gastosPorMes[mesKey] || 0);
        ingresosData.push(ingresosPorMes[mesKey] || 0);
    }
    
    // Destruir gráfico anterior si existe
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    // Crear nuevo gráfico
    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Gastos',
                    data: gastosData,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Ingresos',
                    data: ingresosData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw, 'EUR')}`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de categorías de gastos (dona)
function updateCategoryChart(gastos) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    // Agrupar por categoría
    const categorias = {};
    gastos.forEach(g => {
        const cat = g.categoria || 'Otros';
        categorias[cat] = (categorias[cat] || 0) + (g.monto_eur || g.monto);
    });
    
    const labels = Object.keys(categorias);
    const data = Object.values(categorias);
    
    // Colores para las categorías
        const colores = [
        '#E1D5E7', '#BCAAA4', '#4CAF50', '#FF9800', '#2196F3', 
        '#f44336', '#9C27B0', '#00BCD4', '#FFEB3B', '#795548',
        '#607D8B', '#FF5722', '#009688', '#673AB7', '#3F51B5',
        '#CDDC39', '#FFC107', '#8BC34A', '#E91E63', '#F44336'
    ];
    
    // Destruir gráfico anterior si existe
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    // Crear nuevo gráfico
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw, 'EUR')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de categorías de ingresos (dona)
function updateIncomeCategoryChart(ingresos) {
    const ctx = document.getElementById('incomeCategoryChart')?.getContext('2d');
    if (!ctx) return;
    
    // Agrupar por origen
    const origenes = {};
    ingresos.forEach(i => {
        const orig = i.origen || 'Otros';
        origenes[orig] = (origenes[orig] || 0) + (i.monto_eur || i.monto);
    });
    
    const labels = Object.keys(origenes);
    const data = Object.values(origenes);
    
    // Colores para los orígenes
        const colores = [
        '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', 
        '#FF9800', '#E1D5E7', '#BCAAA4', '#2196F3', '#9C27B0',
        '#607D8B', '#FF5722', '#009688', '#673AB7', '#3F51B5',
        '#795548', '#E91E63', '#F44336', '#00BCD4', '#9E9E9E'
    ];
    
        // Destruir gráfico anterior si existe
    if (window.incomeCategoryChart && typeof window.incomeCategoryChart.destroy === 'function') {
        window.incomeCategoryChart.destroy();
    }
    
    // Crear nuevo gráfico
    window.incomeCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw, 'EUR')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar dashboard completo
async function refreshDashboard() {
    await loadDashboardData();
    await loadTasas();
}

// Inicializar dashboard
function initDashboard() {
    // Eventos de navegación
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            showPage(page);
            
            // Actualizar clase activa en menú
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showConfirmModal(
                '¿Cerrar sesión?',
                () => {
                    logoutUser();
                },
                'Cerrar Sesión'
            );
        });
    }
    
    // Menú hamburguesa
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const closeMenu = document.getElementById('closeMenu');
    
    if (menuToggle && sideMenu) {
        menuToggle.addEventListener('click', () => {
            sideMenu.classList.add('open');
        });
        
        if (closeMenu) {
            closeMenu.addEventListener('click', () => {
                sideMenu.classList.remove('open');
            });
        }
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (sideMenu.classList.contains('open') && 
                !sideMenu.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sideMenu.classList.remove('open');
            }
        });
    }
    
    // Cargar datos del dashboard al iniciar
    loadDashboardData();
    setupChartExpand();

    // Eventos de filtros del dashboard
    const btnAplicarDashboard = document.getElementById('btnAplicarFiltroDashboard');
    const btnLimpiarDashboard = document.getElementById('btnLimpiarFiltroDashboard');
    
    if (btnAplicarDashboard) {
        btnAplicarDashboard.addEventListener('click', aplicarFiltroDashboard);
    }
    if (btnLimpiarDashboard) {
        btnLimpiarDashboard.addEventListener('click', limpiarFiltroDashboard);
    }
    
    // Cargar categorías del select
    actualizarSelectDashboardCategorias();
}

// Mostrar página seleccionada
function showPage(page) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Mostrar página seleccionada
    const selectedPage = document.getElementById(`page${page.charAt(0).toUpperCase() + page.slice(1)}`);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }
    
    // Limpiar filtros según la página
    if (page === 'gastos') {
        resetearFiltrosGastos();
    } else if (page === 'ingresos') {
        resetearFiltrosIngresos();
    } else if (page === 'dashboard') {
        resetearFiltrosDashboard();
    }
    
    // Cargar datos según la página
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'gastos':
            loadGastos();
            break;
        case 'ingresos':
            loadIngresos();
            break;
        case 'operaciones':
            loadOperaciones();
            break;
        case 'tasas':
            loadTasas();
            break;
        case 'categorias':
            if (typeof loadAdminCategorias === 'function') {
                loadAdminCategorias();
            }
            break;
        case 'presupuestos':
            if (typeof initPresupuestosEvents === 'function') {
                initPresupuestosEvents();
            }
            break;
        case 'historial':
            if (typeof cargarHistorial === 'function') {
                cargarHistorial();
            }
            break;
    }
    
    // Cerrar menú en móvil
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu && window.innerWidth < 768) {
        sideMenu.classList.remove('open');
    }
}

// Cerrar modal
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Inicializar eventos de cierre de modal
function initModalEvents() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.modal-close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// Expandir gráfico a pantalla completa
function setupChartExpand() {
    document.querySelectorAll('.expand-chart').forEach(btn => {
        btn.addEventListener('click', () => {
            const chartId = btn.dataset.chart;
            const originalCanvas = document.getElementById(chartId);
            const expandedCanvas = document.getElementById('expandedChart');
            const modal = document.getElementById('chartModal');
            const modalTitle = document.getElementById('chartModalTitle');
            
            if (!originalCanvas || !expandedCanvas || !modal) return;
            
            // Obtener el título del gráfico
            const chartCard = btn.closest('.chart-card');
            const title = chartCard.querySelector('h3')?.textContent || 'Gráfico';
            modalTitle.textContent = title;
            
            // Obtener el gráfico original de Chart.js
            let originalChart = null;
            if (chartId === 'monthlyChart') originalChart = monthlyChart;
            else if (chartId === 'categoryChart') originalChart = categoryChart;
            else if (chartId === 'incomeCategoryChart') originalChart = window.incomeCategoryChart;
            
            if (!originalChart) return;
            
            // Crear un nuevo gráfico en el canvas expandido con los mismos datos
            if (window.expandedChartInstance) {
                window.expandedChartInstance.destroy();
            }
            
            // Copiar configuración del gráfico original
            const config = {
                type: originalChart.config.type,
                data: originalChart.config.data,
                options: {
                    ...originalChart.config.options,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        ...originalChart.config.options.plugins,
                        legend: {
                            position: 'bottom',
                            labels: { font: { size: 14 } }
                        },
                        tooltip: {
                            callbacks: originalChart.config.options.plugins?.tooltip?.callbacks || {}
                        }
                    }
                }
            };
            
            window.expandedChartInstance = new Chart(expandedCanvas, config);
            
            modal.classList.add('active');
        });
    });
    
    // Cerrar modal al hacer clic en el botón de cierre
    const closeBtn = document.querySelector('#chartModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('chartModal');
            modal.classList.remove('active');
            if (window.expandedChartInstance) {
                window.expandedChartInstance.destroy();
                window.expandedChartInstance = null;
            }
        });
    }
    
    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('chartModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (window.expandedChartInstance) {
                    window.expandedChartInstance.destroy();
                    window.expandedChartInstance = null;
                }
            }
        });
    }
}

// Cargar categorías de gastos que tienen datos
async function loadDashboardCategoriasConDatos() {
    try {
        const supabase = getSupabase();
        let query = supabase.from('gastos').select('categoria').not('categoria', 'is', null);
        
        if (filtroDashboard.desde) {
            query = query.gte('fecha', filtroDashboard.desde);
        }
        if (filtroDashboard.hasta) {
            query = query.lte('fecha', filtroDashboard.hasta);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        const categoriasUnicas = [...new Set(data.map(g => g.categoria).filter(c => c))];
        return categoriasUnicas.sort();
    } catch (error) {
        console.error('Error cargando categorías del dashboard:', error);
        return [];
    }
}

// Actualizar select de categorías del dashboard
async function actualizarSelectDashboardCategorias() {
    const categorias = await loadDashboardCategoriasConDatos();
    const select = document.getElementById('filtroDashboardCategoria');
    if (select) {
        select.innerHTML = '<option value="">Todas las categorías</option>' +
            categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
}

async function aplicarFiltroDashboard() {
    filtroDashboard.desde = document.getElementById('filtroDashboardDesde')?.value || '';
    filtroDashboard.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
    filtroDashboard.categoria = document.getElementById('filtroDashboardCategoria')?.value || '';
    
    await actualizarSelectDashboardCategorias();
    await loadDashboardData();
    showSuccess('Filtros aplicados al dashboard');
}

function limpiarFiltroDashboard() {
    filtroDashboard = { desde: '', hasta: '', categoria: '' };
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    loadDashboardData();
    actualizarSelectDashboardCategorias();
    showSuccess('Filtros del dashboard limpiados');
}

// Limpiar filtros del dashboard
function resetearFiltrosDashboard() {
    filtroDashboard = { desde: '', hasta: '', categoria: '' };
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    loadDashboardData();
}

// Verificar presupuestos y mostrar alertas
async function verificarAlertasPresupuesto() {
    const supabase = getSupabase();
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const añoActual = hoy.getFullYear();
    
    // Obtener presupuestos del mes actual
    const { data: presupuestos, error } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('mes', mesActual)
        .eq('año', añoActual);
    
    if (error || !presupuestos || presupuestos.length === 0) return;
    
    // Obtener gastos del mes actual
    const fechaInicio = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
    const fechaFin = `${añoActual}-${String(mesActual).padStart(2, '0')}-${new Date(añoActual, mesActual, 0).getDate()}`;
    
    const { data: gastos } = await supabase
        .from(TABLES.gastos)
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);
    
    const alertas = [];
    
    for (const p of presupuestos) {
        const gastado = (gastos || []).filter(g => g.categoria === p.categoria).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
        const porcentaje = (gastado / p.limite) * 100;
        
        if (porcentaje >= 100) {
            alertas.push(`⚠️ ¡ALERTA! Has superado el presupuesto de "${p.categoria}". Límite: ${formatCurrency(p.limite, 'EUR')}, Gastado: ${formatCurrency(gastado, 'EUR')}`);
        } else if (porcentaje >= 75) {
            alertas.push(`📢 Atención: Has alcanzado el ${porcentaje.toFixed(1)}% del presupuesto de "${p.categoria}".`);
        }
    }
    
    // Mostrar alertas si hay
    if (alertas.length > 0) {
        const mensaje = alertas.join('\n\n');
        // Usar modal de confirmación como alerta
        showConfirmModal(
            mensaje,
            () => {},
            'Alertas de Presupuesto'
        );
    }
}

=======
// ============================================
// DASHBOARD - Estadísticas y gráficos
// ============================================

// Variables globales para gráficos
let monthlyChart = null;
let categoryChart = null;
// Variables de filtros del dashboard
let filtroDashboard = {
    desde: '',
    hasta: '',
    categoria: ''
};

// Cargar datos para el dashboard
async function loadDashboardData() {
    try {
        const supabase = getSupabase();
        
        // Consulta de gastos con filtros
        let gastosQuery = supabase.from(TABLES.gastos).select('*');
        if (filtroDashboard.desde) {
            gastosQuery = gastosQuery.gte('fecha', filtroDashboard.desde);
        }
        if (filtroDashboard.hasta) {
            gastosQuery = gastosQuery.lte('fecha', filtroDashboard.hasta);
        }
        if (filtroDashboard.categoria) {
            gastosQuery = gastosQuery.eq('categoria', filtroDashboard.categoria);
        }
        
        const { data: gastos, error: errorGastos } = await gastosQuery;
        if (errorGastos) console.error('Error cargando gastos:', errorGastos);
        
        // Consulta de ingresos (sin filtro de categoría porque es de gastos)
        let ingresosQuery = supabase.from(TABLES.ingresos).select('*');
        if (filtroDashboard.desde) {
            ingresosQuery = ingresosQuery.gte('fecha', filtroDashboard.desde);
        }
        if (filtroDashboard.hasta) {
            ingresosQuery = ingresosQuery.lte('fecha', filtroDashboard.hasta);
        }
        
        const { data: ingresos, error: errorIngresos } = await ingresosQuery;
        if (errorIngresos) console.error('Error cargando ingresos:', errorIngresos);
        
        const operaciones = await loadOperaciones();
        
        const totalGastos = (gastos || []).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
        const totalIngresos = (ingresos || []).reduce((sum, i) => sum + (i.monto_eur || i.monto), 0);
        const balance = totalIngresos - totalGastos;
        const gananciaOperaciones = operaciones.reduce((sum, o) => sum + (o.ganancia_perdida || 0), 0);
        
        updateStatsDisplay(totalGastos, totalIngresos, balance, gananciaOperaciones);
        updateMonthlyChart(gastos || [], ingresos || []);
        updateCategoryChart(gastos || []);
        updateIncomeCategoryChart(ingresos || []);
        
        // Verificar alertas de presupuesto (nuevas con 75/90/100)
        if (typeof verificarTodasAlertas === 'function') {
            verificarTodasAlertas();
        }
        
        return { totalGastos, totalIngresos, balance, gananciaOperaciones };
        
    } catch (error) {
        console.error('Error en loadDashboardData:', error);
        return null;
    }
}

// Actualizar estadísticas en UI
function updateStatsDisplay(totalGastos, totalIngresos, balance, gananciaOperaciones) {
    const totalGastosEl = document.getElementById('totalGastos');
    const totalIngresosEl = document.getElementById('totalIngresos');
    const balanceEl = document.getElementById('balance');
    
    if (totalGastosEl) {
        totalGastosEl.textContent = formatCurrency(totalGastos, 'EUR');
    }
    
    if (totalIngresosEl) {
        totalIngresosEl.textContent = formatCurrency(totalIngresos, 'EUR');
    }
    
    if (balanceEl) {
        balanceEl.textContent = formatCurrency(balance, 'EUR');
        // Cambiar color según balance
        if (balance >= 0) {
            balanceEl.style.color = 'var(--success, #4CAF50)';
        } else {
            balanceEl.style.color = 'var(--error, #f44336)';
        }
    }
    
    // Mostrar ganancia de operaciones si existe el elemento
    const gananciaOperacionesEl = document.getElementById('gananciaOperaciones');
    if (gananciaOperacionesEl) {
        gananciaOperacionesEl.textContent = formatCurrency(gananciaOperaciones, 'EUR');
        if (gananciaOperaciones >= 0) {
            gananciaOperacionesEl.style.color = 'var(--success, #4CAF50)';
        } else {
            gananciaOperacionesEl.style.color = 'var(--error, #f44336)';
        }
    }
}

// Actualizar gráfico mensual (línea)
function updateMonthlyChart(gastos, ingresos) {
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    
    // Agrupar por mes
    const gastosPorMes = {};
    const ingresosPorMes = {};
    
    gastos.forEach(g => {
        const mes = g.fecha.substring(0, 7); // YYYY-MM
        gastosPorMes[mes] = (gastosPorMes[mes] || 0) + (g.monto_eur || g.monto);
    });
    
    ingresos.forEach(i => {
        const mes = i.fecha.substring(0, 7);
        ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + (i.monto_eur || i.monto);
    });
    
    // Obtener últimos 6 meses
    const meses = [];
    const gastosData = [];
    const ingresosData = [];
    
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        
        meses.push(nombreMes);
        gastosData.push(gastosPorMes[mesKey] || 0);
        ingresosData.push(ingresosPorMes[mesKey] || 0);
    }
    
    // Destruir gráfico anterior si existe
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    // Crear nuevo gráfico
    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Gastos',
                    data: gastosData,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Ingresos',
                    data: ingresosData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw, 'EUR')}`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de categorías de gastos (dona)
function updateCategoryChart(gastos) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    // Agrupar por categoría
    const categorias = {};
    gastos.forEach(g => {
        const cat = g.categoria || 'Otros';
        categorias[cat] = (categorias[cat] || 0) + (g.monto_eur || g.monto);
    });
    
    const labels = Object.keys(categorias);
    const data = Object.values(categorias);
    
    // Colores para las categorías
        const colores = [
        '#E1D5E7', '#BCAAA4', '#4CAF50', '#FF9800', '#2196F3', 
        '#f44336', '#9C27B0', '#00BCD4', '#FFEB3B', '#795548',
        '#607D8B', '#FF5722', '#009688', '#673AB7', '#3F51B5',
        '#CDDC39', '#FFC107', '#8BC34A', '#E91E63', '#F44336'
    ];
    
    // Destruir gráfico anterior si existe
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    // Crear nuevo gráfico
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw, 'EUR')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de categorías de ingresos (dona)
function updateIncomeCategoryChart(ingresos) {
    const ctx = document.getElementById('incomeCategoryChart')?.getContext('2d');
    if (!ctx) return;
    
    // Agrupar por origen
    const origenes = {};
    ingresos.forEach(i => {
        const orig = i.origen || 'Otros';
        origenes[orig] = (origenes[orig] || 0) + (i.monto_eur || i.monto);
    });
    
    const labels = Object.keys(origenes);
    const data = Object.values(origenes);
    
    // Colores para los orígenes
        const colores = [
        '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', 
        '#FF9800', '#E1D5E7', '#BCAAA4', '#2196F3', '#9C27B0',
        '#607D8B', '#FF5722', '#009688', '#673AB7', '#3F51B5',
        '#795548', '#E91E63', '#F44336', '#00BCD4', '#9E9E9E'
    ];
    
        // Destruir gráfico anterior si existe
    if (window.incomeCategoryChart && typeof window.incomeCategoryChart.destroy === 'function') {
        window.incomeCategoryChart.destroy();
    }
    
    // Crear nuevo gráfico
    window.incomeCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw, 'EUR')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Actualizar dashboard completo
async function refreshDashboard() {
    await loadDashboardData();
    await loadTasas();
}

// Inicializar dashboard
function initDashboard() {
    // Eventos de navegación
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            showPage(page);
            
            // Actualizar clase activa en menú
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showConfirmModal(
                '¿Cerrar sesión?',
                () => {
                    logoutUser();
                },
                'Cerrar Sesión'
            );
        });
    }
    
    // Menú hamburguesa
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const closeMenu = document.getElementById('closeMenu');
    
    if (menuToggle && sideMenu) {
        menuToggle.addEventListener('click', () => {
            sideMenu.classList.add('open');
        });
        
        if (closeMenu) {
            closeMenu.addEventListener('click', () => {
                sideMenu.classList.remove('open');
            });
        }
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (sideMenu.classList.contains('open') && 
                !sideMenu.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sideMenu.classList.remove('open');
            }
        });
    }
    
    // Cargar datos del dashboard al iniciar
    loadDashboardData();
    setupChartExpand();

    // Eventos de filtros del dashboard
    const btnAplicarDashboard = document.getElementById('btnAplicarFiltroDashboard');
    const btnLimpiarDashboard = document.getElementById('btnLimpiarFiltroDashboard');
    
    if (btnAplicarDashboard) {
        btnAplicarDashboard.addEventListener('click', aplicarFiltroDashboard);
    }
    if (btnLimpiarDashboard) {
        btnLimpiarDashboard.addEventListener('click', limpiarFiltroDashboard);
    }
    
    // Cargar categorías del select
    actualizarSelectDashboardCategorias();
}

// Mostrar página seleccionada
function showPage(page) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Mostrar página seleccionada
    const selectedPage = document.getElementById(`page${page.charAt(0).toUpperCase() + page.slice(1)}`);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }
    
    // Limpiar filtros según la página
    if (page === 'gastos') {
        resetearFiltrosGastos();
    } else if (page === 'ingresos') {
        resetearFiltrosIngresos();
    } else if (page === 'dashboard') {
        resetearFiltrosDashboard();
    }
    
    // Cargar datos según la página
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'gastos':
            loadGastos();
            break;
        case 'ingresos':
            loadIngresos();
            break;
        case 'operaciones':
            loadOperaciones();
            break;
        case 'tasas':
            loadTasas();
            break;
        case 'categorias':
            if (typeof loadAdminCategorias === 'function') {
                loadAdminCategorias();
            }
            break;
        case 'presupuestos':
            if (typeof initPresupuestosEvents === 'function') {
                initPresupuestosEvents();
            }
            break;
        case 'historial':
            if (typeof cargarHistorial === 'function') {
                cargarHistorial();
            }
            break;
    }
    
    // Cerrar menú en móvil
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu && window.innerWidth < 768) {
        sideMenu.classList.remove('open');
    }
}

// Cerrar modal
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Inicializar eventos de cierre de modal
function initModalEvents() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.modal-close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// Expandir gráfico a pantalla completa
function setupChartExpand() {
    document.querySelectorAll('.expand-chart').forEach(btn => {
        btn.addEventListener('click', () => {
            const chartId = btn.dataset.chart;
            const originalCanvas = document.getElementById(chartId);
            const expandedCanvas = document.getElementById('expandedChart');
            const modal = document.getElementById('chartModal');
            const modalTitle = document.getElementById('chartModalTitle');
            
            if (!originalCanvas || !expandedCanvas || !modal) return;
            
            // Obtener el título del gráfico
            const chartCard = btn.closest('.chart-card');
            const title = chartCard.querySelector('h3')?.textContent || 'Gráfico';
            modalTitle.textContent = title;
            
            // Obtener el gráfico original de Chart.js
            let originalChart = null;
            if (chartId === 'monthlyChart') originalChart = monthlyChart;
            else if (chartId === 'categoryChart') originalChart = categoryChart;
            else if (chartId === 'incomeCategoryChart') originalChart = window.incomeCategoryChart;
            
            if (!originalChart) return;
            
            // Crear un nuevo gráfico en el canvas expandido con los mismos datos
            if (window.expandedChartInstance) {
                window.expandedChartInstance.destroy();
            }
            
            // Copiar configuración del gráfico original
            const config = {
                type: originalChart.config.type,
                data: originalChart.config.data,
                options: {
                    ...originalChart.config.options,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        ...originalChart.config.options.plugins,
                        legend: {
                            position: 'bottom',
                            labels: { font: { size: 14 } }
                        },
                        tooltip: {
                            callbacks: originalChart.config.options.plugins?.tooltip?.callbacks || {}
                        }
                    }
                }
            };
            
            window.expandedChartInstance = new Chart(expandedCanvas, config);
            
            modal.classList.add('active');
        });
    });
    
    // Cerrar modal al hacer clic en el botón de cierre
    const closeBtn = document.querySelector('#chartModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('chartModal');
            modal.classList.remove('active');
            if (window.expandedChartInstance) {
                window.expandedChartInstance.destroy();
                window.expandedChartInstance = null;
            }
        });
    }
    
    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('chartModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (window.expandedChartInstance) {
                    window.expandedChartInstance.destroy();
                    window.expandedChartInstance = null;
                }
            }
        });
    }
}

// Cargar categorías de gastos que tienen datos
async function loadDashboardCategoriasConDatos() {
    try {
        const supabase = getSupabase();
        let query = supabase.from('gastos').select('categoria').not('categoria', 'is', null);
        
        if (filtroDashboard.desde) {
            query = query.gte('fecha', filtroDashboard.desde);
        }
        if (filtroDashboard.hasta) {
            query = query.lte('fecha', filtroDashboard.hasta);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        const categoriasUnicas = [...new Set(data.map(g => g.categoria).filter(c => c))];
        return categoriasUnicas.sort();
    } catch (error) {
        console.error('Error cargando categorías del dashboard:', error);
        return [];
    }
}

// Actualizar select de categorías del dashboard
async function actualizarSelectDashboardCategorias() {
    const categorias = await loadDashboardCategoriasConDatos();
    const select = document.getElementById('filtroDashboardCategoria');
    if (select) {
        select.innerHTML = '<option value="">Todas las categorías</option>' +
            categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
}

async function aplicarFiltroDashboard() {
    filtroDashboard.desde = document.getElementById('filtroDashboardDesde')?.value || '';
    filtroDashboard.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
    filtroDashboard.categoria = document.getElementById('filtroDashboardCategoria')?.value || '';
    
    await actualizarSelectDashboardCategorias();
    await loadDashboardData();
    showSuccess('Filtros aplicados al dashboard');
}

function limpiarFiltroDashboard() {
    filtroDashboard = { desde: '', hasta: '', categoria: '' };
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    loadDashboardData();
    actualizarSelectDashboardCategorias();
    showSuccess('Filtros del dashboard limpiados');
}

// Limpiar filtros del dashboard
function resetearFiltrosDashboard() {
    filtroDashboard = { desde: '', hasta: '', categoria: '' };
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    loadDashboardData();
}

// Verificar presupuestos y mostrar alertas
async function verificarAlertasPresupuesto() {
    const supabase = getSupabase();
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const añoActual = hoy.getFullYear();
    
    // Obtener presupuestos del mes actual
    const { data: presupuestos, error } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('mes', mesActual)
        .eq('año', añoActual);
    
    if (error || !presupuestos || presupuestos.length === 0) return;
    
    // Obtener gastos del mes actual
    const fechaInicio = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
    const fechaFin = `${añoActual}-${String(mesActual).padStart(2, '0')}-${new Date(añoActual, mesActual, 0).getDate()}`;
    
    const { data: gastos } = await supabase
        .from(TABLES.gastos)
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);
    
    const alertas = [];
    
    for (const p of presupuestos) {
        const gastado = (gastos || []).filter(g => g.categoria === p.categoria).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
        const porcentaje = (gastado / p.limite) * 100;
        
        if (porcentaje >= 100) {
            alertas.push(`⚠️ ¡ALERTA! Has superado el presupuesto de "${p.categoria}". Límite: ${formatCurrency(p.limite, 'EUR')}, Gastado: ${formatCurrency(gastado, 'EUR')}`);
        } else if (porcentaje >= 75) {
            alertas.push(`📢 Atención: Has alcanzado el ${porcentaje.toFixed(1)}% del presupuesto de "${p.categoria}".`);
        }
    }
    
    // Mostrar alertas si hay
    if (alertas.length > 0) {
        const mensaje = alertas.join('\n\n');
        // Usar modal de confirmación como alerta
        showConfirmModal(
            mensaje,
            () => {},
            'Alertas de Presupuesto'
        );
    }
}

>>>>>>> f3bae395b482f94449aa12c36abfcec5eb8392c9
console.log('✅ Módulo de dashboard cargado');