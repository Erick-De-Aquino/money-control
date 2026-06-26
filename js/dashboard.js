// ============================================
// DASHBOARD - Estadísticas y gráficos
// ============================================

// Variables globales para gráficos
let monthlyChart = null;
let categoryChart = null;
let intervaloParpadeo = null;
// Variables de filtros del dashboard
let filtroDashboard = {
    desde: '',
    hasta: '',
    categoriasGastos: [],
    categoriasIngresos: []
};

// Cargar datos para el dashboard
async function loadDashboardData() {

    try {

        const supabase = getSupabase();

        // =========================
        // ESPERAR AUTH LISTA
        // =========================
        const user = getCurrentUser();

        if (!user || !user.id) {
            console.warn('⏳ Esperando sesión de usuario...');

            // reintento corto (evita race condition)
            await new Promise(resolve => setTimeout(resolve, 300));

            const retryUser = getCurrentUser();

            if (!retryUser?.id) {
                console.error('No user ID válido');
                return null;
            }
        }

        const userId = getCurrentUser().id;

        // =========================
        // FECHAS
        // =========================
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        const mesActual = hoy.getMonth() + 1;

        const fechaInicioDefault = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
        const fechaFinDefault = `${añoActual}-${String(mesActual).padStart(2, '0')}-${new Date(añoActual, mesActual, 0).getDate()}`;

        const desde = filtroDashboard?.desde || fechaInicioDefault;
        const hasta = filtroDashboard?.hasta || fechaFinDefault;

        
        // =========================
        // GASTOS
        // =========================
        let gastosQuery = supabase
            .from(TABLES.gastos)
            .select('*')
            .eq('user_id', userId)
            .gte('fecha', desde)
            .lte('fecha', hasta);

        if (
            filtroDashboard.categoriasGastos &&
            filtroDashboard.categoriasGastos.length > 0
        ) {

            gastosQuery = gastosQuery.in(
                'categoria',
                filtroDashboard.categoriasGastos
            );

        }
        else if (
            filtroDashboard.categoriasIngresos &&
            filtroDashboard.categoriasIngresos.length > 0
        ) {

            // Si eligió ingresos pero ningún gasto,
            // no mostrar gastos
            gastosQuery = gastosQuery.in(
                'categoria',
                ['__SIN_RESULTADOS__']
            );

        }

        const { data: gastos, error: errorGastos } = await gastosQuery;

        if (errorGastos) {
            console.error('Error cargando gastos:', errorGastos);
        }

        // =========================
        // INGRESOS
        // =========================
        let ingresosQuery = supabase
            .from(TABLES.ingresos)
            .select('*')
            .eq('user_id', userId)
            .gte('fecha', desde)
            .lte('fecha', hasta);

        if (
            filtroDashboard.categoriasIngresos &&
            filtroDashboard.categoriasIngresos.length > 0
        ) {

            ingresosQuery = ingresosQuery.in(
                'origen',
                filtroDashboard.categoriasIngresos
            );

        }
        else if (
            filtroDashboard.categoriasGastos &&
            filtroDashboard.categoriasGastos.length > 0
        ) {

            // Si eligió gastos pero ningún ingreso,
            // no mostrar ingresos
            ingresosQuery = ingresosQuery.in(
                'origen',
                ['__SIN_RESULTADOS__']
            );

        }

        const {
            data: ingresos,
            error: errorIngresos
        } = await ingresosQuery;

        if (errorIngresos) {
            console.error('Error cargando ingresos:', errorIngresos);
        }

        // =========================
        // CACHE
        // =========================
        window.dashboardGastosFiltrados = gastos || [];
        window.dashboardIngresosFiltrados = ingresos || [];

        // =========================
        // REMESAS
        // =========================
        const remesas = (await loadRemesas?.()) || [];
        //await updateRemesasRatesPanel?.();

        // =========================
        // CALCULOS
        // =========================
        const totalGastos = (gastos || []).reduce((s, g) => s + (g.monto_eur || g.monto || 0), 0);
        const totalIngresos = (ingresos || []).reduce((s, i) => s + (i.monto_eur || i.monto || 0), 0);
        const balance = totalIngresos - totalGastos;

        const gananciaRemesas = remesas.reduce(
            (s, r) => s + (r.ganancia_real || r.ganancia_calculada || 0),
            0
        );

        // =========================
        // UI
        // =========================
        updateStatsDisplay(totalGastos, totalIngresos, balance, gananciaRemesas);
        updateMonthlyChart(gastos || [], ingresos || []);
        updateCategoryChart(gastos || []);
        updateIncomeCategoryChart(ingresos || []);

        if (typeof verificarTodasAlertas === 'function') {
            verificarTodasAlertas();
        }

        return { totalGastos, totalIngresos, balance, gananciaRemesas };

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

        balanceEl.style.color =
            balance >= 0
                ? 'var(--success, #4CAF50)'
                : 'var(--error, #f44336)';
    }

    const gananciaOperacionesEl = document.getElementById('gananciaOperaciones');

    if (gananciaOperacionesEl) {
        gananciaOperacionesEl.textContent = formatCurrency(gananciaOperaciones, 'EUR');

        gananciaOperacionesEl.style.color =
            gananciaOperaciones >= 0
                ? 'var(--success, #4CAF50)'
                : 'var(--error, #f44336)';
    }

    // =========================
    // BOTÓN GASTOS (SAFE)
    // =========================
    if (totalGastosEl) {
        const targetCardGastos = totalGastosEl.closest('.stat-card');

        if (targetCardGastos && !targetCardGastos.querySelector('#btnProgresoGastos')) {
            const btnContainer = document.createElement('div');

            btnContainer.style.marginTop = '25px';
            btnContainer.style.textAlign = 'center';

            const btnProgreso = document.createElement('button');

            btnProgreso.id = 'btnProgresoGastos';
            btnProgreso.textContent = 'Ver detalle';
            btnProgreso.className = 'btn btn-secondary btn-small';
            btnProgreso.style.width = '100%';

            btnProgreso.onclick = () => {
                mostrarResumenCategorias('gastos');
            };

            btnContainer.appendChild(btnProgreso);
            targetCardGastos.appendChild(btnContainer);
        }
    }

    // =========================
    // BOTÓN INGRESOS (SAFE)
    // =========================
    if (totalIngresosEl) {
        const targetCardIngresos = totalIngresosEl.closest('.stat-card');

        if (targetCardIngresos && !targetCardIngresos.querySelector('#btnProgresoIngresos')) {
            const btnContainer = document.createElement('div');

            btnContainer.style.marginTop = '25px';
            btnContainer.style.textAlign = 'center';

            const btnProgreso = document.createElement('button');

            btnProgreso.id = 'btnProgresoIngresos';
            btnProgreso.textContent = 'Ver detalle';
            btnProgreso.className = 'btn btn-secondary btn-small';
            btnProgreso.style.width = '100%';

            btnProgreso.onclick = () => {
                mostrarResumenCategorias('ingresos');
            };

            btnContainer.appendChild(btnProgreso);
            targetCardIngresos.appendChild(btnContainer);
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

    // Generar leyenda desplegable
    const leyendaContainer =
        document.getElementById('leyendaCategoriasGastos');

    if (leyendaContainer) {

        let leyendaHTML = `
            <div style="
                display:grid;
                grid-template-columns:repeat(2, 1fr);
                gap:8px 16px;
                margin-top:8px;
            ">
        `;

        labels.forEach((categoria, index) => {

            leyendaHTML += `
                <div style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    font-size:0.9rem;
                ">
                    <span style="
                        width:12px;
                        height:12px;
                        border-radius:2px;
                        background:${colores[index]};
                        display:inline-block;
                        flex-shrink:0;
                    "></span>

                    <span>${categoria}</span>
                </div>
            `;
        });

        leyendaHTML += '</div>';

        leyendaContainer.innerHTML = leyendaHTML;
    }
    
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
                    display: false
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

    const btnToggleLeyenda =
    document.getElementById('btnToggleLeyendaGastos');

    if (
        btnToggleLeyenda &&
        !btnToggleLeyenda.dataset.eventAttached
    ) {

        btnToggleLeyenda.dataset.eventAttached = 'true';

        btnToggleLeyenda.addEventListener('click', () => {

            const leyenda =
                document.getElementById('leyendaCategoriasGastos');

            if (!leyenda) return;

            const visible =
                leyenda.style.display === 'block';

            leyenda.style.display =
                visible ? 'none' : 'block';

            btnToggleLeyenda.textContent =
                visible
                    ? 'Ver categorías'
                    : 'Ocultar categorías';
        });
    }
}

// Actualizar gráfico de categorías de ingresos (dona)
function updateIncomeCategoryChart(ingresos) {

    const ctx =
        document.getElementById('incomeCategoryChart')
        ?.getContext('2d');

    if (!ctx) return;

    // Agrupar por origen
    const origenes = {};

    ingresos.forEach(i => {

        const orig = i.origen || 'Otros';

        origenes[orig] =
            (origenes[orig] || 0) +
            (i.monto_eur || i.monto);
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

    // Generar leyenda desplegable
    const leyendaContainer =
        document.getElementById('leyendaCategoriasIngresos');

    if (leyendaContainer) {

        let leyendaHTML = `
            <div style="
                display:grid;
                grid-template-columns:repeat(2, 1fr);
                gap:8px 16px;
                margin-top:8px;
            ">
        `;

        labels.forEach((origen, index) => {

            leyendaHTML += `
                <div style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    font-size:0.9rem;
                ">
                    <span style="
                        width:12px;
                        height:12px;
                        border-radius:2px;
                        background:${colores[index]};
                        display:inline-block;
                        flex-shrink:0;
                    "></span>

                    <span>${origen}</span>
                </div>
            `;
        });

        leyendaHTML += '</div>';

        leyendaContainer.innerHTML = leyendaHTML;
    }

    // Destruir gráfico anterior si existe
    if (
        window.incomeCategoryChart &&
        typeof window.incomeCategoryChart.destroy === 'function'
    ) {
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
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {

                            const total =
                                data.reduce((a, b) => a + b, 0);

                            const percentage =
                                ((context.raw / total) * 100)
                                .toFixed(1);

                            return `${context.label}: ${formatCurrency(context.raw, 'EUR')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    const btnToggleLeyenda =
        document.getElementById(
            'btnToggleLeyendaIngresos'
        );

    if (
        btnToggleLeyenda &&
        !btnToggleLeyenda.dataset.eventAttached
    ) {

        btnToggleLeyenda.dataset.eventAttached = 'true';

        btnToggleLeyenda.addEventListener('click', () => {

            const leyenda =
                document.getElementById(
                    'leyendaCategoriasIngresos'
                );

            if (!leyenda) return;

            const visible =
                leyenda.style.display === 'block';

            leyenda.style.display =
                visible ? 'none' : 'block';

            btnToggleLeyenda.textContent =
                visible
                    ? 'Ver categorías'
                    : 'Ocultar categorías';
        });
    }
}

function getUserRole() {
    return window.currentUserRole || localStorage.getItem('user_role') || 'usuario';
}

function isOperador() {
    return getUserRole() === 'operador';
}

function canAccessPage(page) {
    const role = getUserRole();

    const operadorOnlyPages = [
        'operaciones',
        'remesas',
        'tasas'
    ];

    if (role === 'usuario' && operadorOnlyPages.includes(page)) {
        return false;
    }

    return true;
}

function canExecuteAction(action) {

    const role = getUserRole();

    const operadorOnlyActions = [
        'create_operation',
        'create_remesa',
        'execute_remesa',
        'delete_operation',
        'admin_finance'
    ];

    if (role === 'usuario' && operadorOnlyActions.includes(action)) {
        return false;
    }

    return true;
}

// Actualizar dashboard completo
async function refreshDashboard() {
    await loadDashboardData();
    await loadTasas?.();
}

function initDashboard() {

    const role = window.currentUserRole || localStorage.getItem('user_role') || 'usuario';

    if (role === 'admin') {

        const adminMenuItem =
            document.getElementById('adminMenuItem');

        if (adminMenuItem) {
            adminMenuItem.style.display = 'block';
        }

    }

    // =========================
    // FILTRO DE MENÚ POR ROL
    // =========================
    const sideMenuItems = document.querySelectorAll('#sideMenu .menu-item');

    sideMenuItems.forEach(item => {
        const page = item.dataset.page;

        const operadorOnlyPages = [
            'operaciones',
            'remesas',
            'tasas'
        ];

        if (role === 'usuario' && operadorOnlyPages.includes(page)) {
            item.style.display = 'none';
        }
    });

    // =========================
    // NAVEGACIÓN
    // =========================
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            showPage(page);

            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // =========================
    // LOGOUT
    // =========================
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
        showConfirmModal(
            '¿Cerrar sesión?',
            () => logoutUser(),
            'Cerrar Sesión'
        );
    });

    // =========================
    // MENÚ HAMBURGUESA
    // =========================
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const closeMenu = document.getElementById('closeMenu');

    menuToggle?.addEventListener('click', () => {
        sideMenu?.classList.add('open');
    });

    closeMenu?.addEventListener('click', () => {
        sideMenu?.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
        if (
            sideMenu?.classList.contains('open') &&
            !sideMenu.contains(e.target) &&
            !menuToggle.contains(e.target)
        ) {
            sideMenu.classList.remove('open');
        }
    });

    // =========================
    // CERRAR SIDEBAR EN CLICK
    // =========================
    const sideMenuLinks = document.querySelectorAll('#sideMenu a, #sideMenu button');

    sideMenuLinks.forEach(el => {
        el.addEventListener('click', () => {
            const isLogout = el.id === 'btnLogout' || el.classList.contains('logout');
            const isDarkMode = el.id === 'toggleDarkMode' || el.classList.contains('dark-mode-toggle');

            if (!isLogout && !isDarkMode) {
                sideMenu?.classList.remove('open');
            }
        });
    });

    // =========================
    // DASHBOARD INIT
    // =========================
    loadDashboardData();
    setupChartExpand();

    document.getElementById('btnAplicarFiltroDashboard')
        ?.addEventListener('click', aplicarFiltroDashboard);

    document.getElementById('btnLimpiarFiltroDashboard')
        ?.addEventListener('click', limpiarFiltroDashboard);

    actualizarSelectDashboardCategorias();

    document.getElementById('btnAbrirModalFiltros')
        ?.addEventListener('click', () => {
            window.filtroActivoPara = 'dashboard';
            abrirModalFiltros();
        });

    document.getElementById('closeModalFiltros')
        ?.addEventListener('click', cerrarModalFiltros);

    document.getElementById('modalFiltros')
        ?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalFiltros')) {
                cerrarModalFiltros();
            }
        });

    document.getElementById('btnLimpiarFiltroDashboardReseña')
        ?.addEventListener('click', limpiarFiltroDashboard);

    document.getElementById('closeModalResumenCategorias')
        ?.addEventListener('click', cerrarModalResumenCategorias);

    document.getElementById('modalResumenCategorias')
        ?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalResumenCategorias')) {
                cerrarModalResumenCategorias();
            }
        });

    document.getElementById('toggleCategoriasGastos')
        ?.addEventListener('click', () => {
            document.getElementById('accordionCategoriasGastos')?.classList.toggle('hidden');
        });

    document.getElementById('toggleCategoriasIngresos')
        ?.addEventListener('click', () => {
            document.getElementById('accordionCategoriasIngresos')?.classList.toggle('hidden');
        });

    document.getElementById('btnNuevoGastoDashboard')
        ?.addEventListener('click', async () => {
            await getCategoriasCache('gastos');
            showGastoModal();
        });

    document.getElementById('btnNuevoIngresoDashboard')
        ?.addEventListener('click', async () => {
            await getCategoriasCache('ingresos');
            showIngresoModal();
        });

    // =========================
    // REMESAS INIT
    // =========================
    if (typeof initRemesas === 'function') {
        initRemesas();
    }
}

// Mostrar página seleccionada
function showPage(page) {

    // 🔥 PROTECCIÓN DE RUTA POR ROL
    if (!canAccessPage(page)) {
        console.warn('Acceso denegado a:', page);
        showError('No tienes permisos para acceder a esta sección');
        return;
    }

    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });

    // Mostrar página seleccionada
    const selectedPage = document.getElementById(
        `page${page.charAt(0).toUpperCase() + page.slice(1)}`
    );

    if (selectedPage) {
        selectedPage.classList.add('active');
    }

    if (page === 'administracion') {
        loadAdminUsers();
    }

    // actualizar filtro activo
    window.filtroActivoPara = page;

    // reset filtros
    if (page === 'gastos') {
        //resetearFiltrosGastos();
    } else if (page === 'ingresos') {
        resetearFiltrosIngresos();
    } else if (page === 'dashboard') {
        resetearFiltrosDashboard();
    }

    // cargar datos
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
        case 'remesas':
            loadRemesas?.();
            break;
        case 'tasas':
            loadTasas?.();
            break;
        case 'categorias':
            loadAdminCategorias?.();
            break;
        case 'presupuestos':
            initPresupuestosEvents?.();
            break;
        case 'historial':
            cargarHistorial?.();
            break;
    }

    // cerrar sidebar móvil
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

// Cargar categorías disponibles para filtros del dashboard
async function loadDashboardCategoriasConDatos() {

    try {

        const supabase = getSupabase();

        // ==========================
        // GASTOS
        // ==========================
        let queryGastos = supabase
            .from('gastos')
            .select('categoria')
            .not('categoria', 'is', null);

        if (filtroDashboard.desde) {
            queryGastos = queryGastos.gte('fecha', filtroDashboard.desde);
        }

        if (filtroDashboard.hasta) {
            queryGastos = queryGastos.lte('fecha', filtroDashboard.hasta);
        }

        const {
            data: gastosData,
            error: gastosError
        } = await queryGastos;

        if (gastosError) throw gastosError;

        // ==========================
        // INGRESOS
        // ==========================
        let queryIngresos = supabase
            .from('ingresos')
            .select('origen')
            .not('origen', 'is', null);

        if (filtroDashboard.desde) {
            queryIngresos = queryIngresos.gte('fecha', filtroDashboard.desde);
        }

        if (filtroDashboard.hasta) {
            queryIngresos = queryIngresos.lte('fecha', filtroDashboard.hasta);
        }

        const {
            data: ingresosData,
            error: ingresosError
        } = await queryIngresos;

        if (ingresosError) throw ingresosError;

        // ==========================
        // FORMATEAR
        // ==========================
        const categorias = [];

        (gastosData || []).forEach(item => {

            if (!item.categoria) return;

            categorias.push({
                nombre: item.categoria,
                tipo: 'gasto'
            });

        });

        (ingresosData || []).forEach(item => {

            if (!item.origen) return;

            categorias.push({
                nombre: item.origen,
                tipo: 'ingreso'
            });

        });

        // eliminar duplicados
        const categoriasUnicas = categorias.filter(
            (item, index, self) =>
                index === self.findIndex(
                    c =>
                        c.nombre === item.nombre &&
                        c.tipo === item.tipo
                )
        );

        return categoriasUnicas;

    } catch (error) {

        console.error(
            'Error cargando categorías del dashboard:',
            error
        );

        return [];

    }
}

// Actualizar categorías disponibles para filtros del dashboard
async function actualizarSelectDashboardCategorias() {

    const categorias = await loadDashboardCategoriasConDatos();

    window.dashboardCategoriasDisponibles = categorias || [];

    return categorias;

}

async function aplicarFiltroDashboard() {

    if (window.filtroActivoPara === 'gastos') {

        filtroGastos.desde = document.getElementById('filtroDashboardDesde')?.value || '';
        filtroGastos.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
        filtroGastos.categoria = Array.from(
            document.querySelectorAll('.checkboxCategoriaFiltro:checked')
        ).map(cb => cb.value);

        await loadGastos();

        const reseña = document.getElementById('filtroReseñaGastos');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroGastosReseña');

        if (filtroGastos.desde || filtroGastos.hasta || filtroGastos.categoria) {

            if (reseña) {

                let texto = '⚠️ Filtro aplicado';

                if (filtroGastos.desde && filtroGastos.hasta) {
                    texto = `⚠️ Filtro aplicado con rango ${filtroGastos.desde} - ${filtroGastos.hasta}`;
                } else if (filtroGastos.desde) {
                    texto = `⚠️ Filtro aplicado desde ${filtroGastos.desde}`;
                } else if (filtroGastos.hasta) {
                    texto = `⚠️ Filtro aplicado hasta ${filtroGastos.hasta}`;
                }

                if (filtroGastos.categoria) {
                    texto += ` | Categoría: ${filtroGastos.categoria}`;
                }

                reseña.textContent = texto;
                reseña.style.display = 'flex';
                reseña.className = 'filtro-reseña-normal';

                if (intervaloParpadeoGastos) {
                    clearInterval(intervaloParpadeoGastos);
                }

                let estado = true;

                intervaloParpadeoGastos = setInterval(() => {

                    if (reseña && reseña.style.display !== 'none') {

                        reseña.className =
                            estado
                                ? 'filtro-reseña-normal'
                                : 'filtro-reseña-alerta';

                        estado = !estado;

                    } else {

                        clearInterval(intervaloParpadeoGastos);
                        intervaloParpadeoGastos = null;

                    }

                }, 1000);

            }

            if (btnLimpiar) btnLimpiar.style.display = 'flex';

        } else {

            if (reseña) {

                reseña.style.display = 'none';

                if (intervaloParpadeoGastos) {
                    clearInterval(intervaloParpadeoGastos);
                    intervaloParpadeoGastos = null;
                }

            }

            if (btnLimpiar) btnLimpiar.style.display = 'none';
        }

        cerrarModalFiltros();
        showSuccess('Filtro aplicado a gastos');

    } else if (window.filtroActivoPara === 'ingresos') {

        filtroIngresos.desde = document.getElementById('filtroDashboardDesde')?.value || '';
        filtroIngresos.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
        filtroIngresos.categoria = Array.from(
            document.querySelectorAll('.checkboxCategoriaFiltro:checked')
        ).map(cb => cb.value);

        await loadIngresos();

        const reseña = document.getElementById('filtroReseñaIngresos');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroIngresosReseña');

        if (filtroIngresos.desde || filtroIngresos.hasta || filtroIngresos.categoria) {

            if (reseña) {

                let texto = '⚠️ Filtro aplicado';

                if (filtroIngresos.desde && filtroIngresos.hasta) {
                    texto = `⚠️ Filtro aplicado con rango ${filtroIngresos.desde} - ${filtroIngresos.hasta}`;
                } else if (filtroIngresos.desde) {
                    texto = `⚠️ Filtro aplicado desde ${filtroIngresos.desde}`;
                } else if (filtroIngresos.hasta) {
                    texto = `⚠️ Filtro aplicado hasta ${filtroIngresos.hasta}`;
                }

                if (filtroIngresos.categoria) {
                    texto += ` | Categoría: ${filtroIngresos.categoria}`;
                }

                reseña.textContent = texto;
                reseña.style.display = 'flex';
                reseña.className = 'filtro-reseña-normal';

                if (intervaloParpadeoIngresos) {
                    clearInterval(intervaloParpadeoIngresos);
                }

                let estado = true;

                intervaloParpadeoIngresos = setInterval(() => {

                    if (reseña && reseña.style.display !== 'none') {

                        reseña.className =
                            estado
                                ? 'filtro-reseña-normal'
                                : 'filtro-reseña-alerta';

                        estado = !estado;

                    } else {

                        clearInterval(intervaloParpadeoIngresos);
                        intervaloParpadeoIngresos = null;

                    }

                }, 500);

            }

            if (btnLimpiar) btnLimpiar.style.display = 'flex';

        } else {

            if (reseña) {

                reseña.style.display = 'none';

                if (intervaloParpadeoIngresos) {
                    clearInterval(intervaloParpadeoIngresos);
                    intervaloParpadeoIngresos = null;
                }

            }

            if (btnLimpiar) btnLimpiar.style.display = 'none';
        }

        cerrarModalFiltros();
        showSuccess('Filtro aplicado a ingresos');

    } else {

        filtroDashboard.desde =
            document.getElementById('filtroDashboardDesde')?.value || '';

        filtroDashboard.hasta =
            document.getElementById('filtroDashboardHasta')?.value || '';

        const checkboxesSeleccionados = Array.from(
            document.querySelectorAll('.checkboxCategoriaFiltro:checked')
        );

        filtroDashboard.categoriasGastos = [];
        filtroDashboard.categoriasIngresos = [];

        checkboxesSeleccionados.forEach(cb => {

            const tipo = cb.dataset.tipo;

            if (tipo === 'gasto') {
                filtroDashboard.categoriasGastos.push(cb.value);
            }

            if (tipo === 'ingreso') {
                filtroDashboard.categoriasIngresos.push(cb.value);
            }

        });

        await actualizarSelectDashboardCategorias();
        await loadDashboardData();

        const reseña = document.getElementById('filtroReseña');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroDashboardReseña');

        const hayFiltroDashboard =
            filtroDashboard.desde ||
            filtroDashboard.hasta ||
            filtroDashboard.categoriasGastos.length > 0 ||
            filtroDashboard.categoriasIngresos.length > 0;

        if (hayFiltroDashboard) {

            if (reseña) {

                let texto = '⚠️ Filtro aplicado';

                if (filtroDashboard.desde && filtroDashboard.hasta) {
                    texto = `⚠️ Filtro aplicado con rango ${filtroDashboard.desde} - ${filtroDashboard.hasta}`;
                } else if (filtroDashboard.desde) {
                    texto = `⚠️ Filtro aplicado desde ${filtroDashboard.desde}`;
                } else if (filtroDashboard.hasta) {
                    texto = `⚠️ Filtro aplicado hasta ${filtroDashboard.hasta}`;
                }

                if (filtroDashboard.categoriasGastos.length > 0) {
                    texto += ` | Gastos: ${filtroDashboard.categoriasGastos.join(', ')}`;
                }

                if (filtroDashboard.categoriasIngresos.length > 0) {
                    texto += ` | Ingresos: ${filtroDashboard.categoriasIngresos.join(', ')}`;
                }

                reseña.textContent = texto;
                reseña.style.display = 'flex';
                reseña.className = 'filtro-reseña-normal';

                if (intervaloParpadeo) {
                    clearInterval(intervaloParpadeo);
                }

                let estado = true;

                intervaloParpadeo = setInterval(() => {

                    if (reseña && reseña.style.display !== 'none') {

                        reseña.className =
                            estado
                                ? 'filtro-reseña-normal'
                                : 'filtro-reseña-alerta';

                        estado = !estado;

                    } else {

                        clearInterval(intervaloParpadeo);
                        intervaloParpadeo = null;

                    }

                }, 500);

            }

            if (btnLimpiar) {
                btnLimpiar.style.display = 'flex';
            }

        } else {

            if (reseña) {

                reseña.style.display = 'none';

                if (intervaloParpadeo) {
                    clearInterval(intervaloParpadeo);
                    intervaloParpadeo = null;
                }

            }

            if (btnLimpiar) {
                btnLimpiar.style.display = 'none';
            }

        }

        cerrarModalFiltros();
        showSuccess('Filtros aplicados al dashboard');
    }


}

// Limpiar filtros del dashboard (genérico)
function limpiarFiltroDashboard() {
    if (window.filtroActivoPara === 'gastos') {
        // Limpiar filtros de gastos
        filtroGastos = { desde: '', hasta: '', categoria: '' };
        
        const desdeInput = document.getElementById('filtroDashboardDesde');
        const hastaInput = document.getElementById('filtroDashboardHasta');
        const catSelect = document.getElementById('filtroDashboardCategoria');
        
        if (desdeInput) desdeInput.value = '';
        if (hastaInput) hastaInput.value = '';
        if (catSelect) catSelect.value = '';
        
        loadGastos();
        
        const reseña = document.getElementById('filtroReseñaGastos');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroGastosReseña');
        if (reseña) {
            reseña.style.display = 'none';
            if (intervaloParpadeoGastos) {
                clearInterval(intervaloParpadeoGastos);
                intervaloParpadeoGastos = null;
            }
        }
        if (btnLimpiar) btnLimpiar.style.display = 'none';
        
        cerrarModalFiltros();
        showSuccess('Filtros de gastos limpiados');
        
    } else if (window.filtroActivoPara === 'ingresos') {
        // Limpiar filtros de ingresos (lo implementaremos después)
        console.log('Limpiar filtros de ingresos - pendiente');
        cerrarModalFiltros();
        
    } else {
        // Dashboard (default)
        filtroDashboard = { desde: '', hasta: '', categoria: '' };
        const desdeInput = document.getElementById('filtroDashboardDesde');
        const hastaInput = document.getElementById('filtroDashboardHasta');
        const catSelect = document.getElementById('filtroDashboardCategoria');
        
        if (desdeInput) desdeInput.value = '';
        if (hastaInput) hastaInput.value = '';
        if (catSelect) catSelect.value = '';
        
        loadDashboardData();
        actualizarSelectDashboardCategorias();
        cerrarModalFiltros();
        
        const reseña = document.getElementById('filtroReseña');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroDashboardReseña');
        if (reseña) {
            reseña.style.display = 'none';
            if (intervaloParpadeo) {
                clearInterval(intervaloParpadeo);
                intervaloParpadeo = null;
            }
        }
        if (btnLimpiar) btnLimpiar.style.display = 'none';
        
        showSuccess('Filtros del dashboard limpiados');
    }
}

// Limpiar filtros del dashboard
function resetearFiltrosDashboard() {

    filtroDashboard = {
        desde: '',
        hasta: '',
        categoriasGastos: [],
        categoriasIngresos: []
    };

    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');

    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';

    document
        .querySelectorAll('.checkboxCategoriaFiltro')
        .forEach(cb => cb.checked = false);

    //loadDashboardData();

    const reseña = document.getElementById('filtroReseña');
    const btnLimpiar = document.getElementById('btnLimpiarFiltroDashboardReseña');

    if (reseña) {

        reseña.style.display = 'none';

        if (intervaloParpadeo) {
            clearInterval(intervaloParpadeo);
            intervaloParpadeo = null;
        }

    }

    if (btnLimpiar) {
        btnLimpiar.style.display = 'none';
    }
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

// Abrir modal de filtros (cargando valores según página activa)
async function abrirModalFiltros() {

    if (!window.filtroActivoPara) {
        window.filtroActivoPara = 'dashboard';
    }

    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');

    const catSelect = document.getElementById('filtroDashboardCategoria');

    let categorias = [];
    let seleccionadas = [];

    // DASHBOARD
    if (window.filtroActivoPara === 'dashboard') {

        if (desdeInput) desdeInput.value = filtroDashboard.desde || '';
        if (hastaInput) hastaInput.value = filtroDashboard.hasta || '';

        categorias = await loadDashboardCategoriasConDatos();
        seleccionadas = filtroDashboard.categoria || [];
    }

    // GASTOS
    else if (window.filtroActivoPara === 'gastos') {

        if (desdeInput) desdeInput.value = filtroGastos.desde || '';
        if (hastaInput) hastaInput.value = filtroGastos.hasta || '';

        categorias = await getCategoriasCache('gastos');
        seleccionadas = filtroGastos.categoria || [];
    }

    // INGRESOS
    else if (window.filtroActivoPara === 'ingresos') {

        if (desdeInput) desdeInput.value = filtroIngresos.desde || '';
        if (hastaInput) hastaInput.value = filtroIngresos.hasta || '';

        categorias = await getCategoriasCache('ingresos');
        seleccionadas = filtroIngresos.categoria || [];
    }

    // Crear contenedor de checkboxes
    if (catSelect) {

        let container = document.getElementById('contenedorCategoriasCheckbox');

        if (!container) {

            container = document.createElement('div');
            container.id = 'contenedorCategoriasCheckbox';

            container.style.maxHeight = '220px';
            container.style.overflowY = 'auto';
            container.style.border = '1px solid #ccc';
            container.style.borderRadius = '8px';
            container.style.padding = '10px';
            container.style.marginTop = '8px';

            catSelect.parentNode.appendChild(container);
        }

        const categoriasGastos = categorias.filter(
            c => c.tipo === 'gasto'
        );

        const categoriasIngresos = categorias.filter(
            c => c.tipo === 'ingreso'
        );

        container.innerHTML = `

            <div style="
                font-weight:bold;
                color:#dc3545;
                margin-bottom:10px;
                margin-top:4px;
            ">
                🔴 GASTOS
            </div>

            ${categoriasGastos.map(cat => `
                <label style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    margin-bottom:6px;
                    margin-left:10px;
                ">
                    <input
                        type="checkbox"
                        class="checkboxCategoriaFiltro"
                        data-tipo="gasto"
                        value="${cat.nombre}"
                        ${seleccionadas.includes(cat.nombre) ? 'checked' : ''}
                    >
                    ${cat.nombre}
                </label>
            `).join('')}

            <hr style="
                margin:12px 0;
                border:none;
                border-top:1px solid #ddd;
            ">

            <div style="
                font-weight:bold;
                color:#198754;
                margin-bottom:10px;
            ">
                🟢 INGRESOS
            </div>

            ${categoriasIngresos.map(cat => `
                <label style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    margin-bottom:6px;
                    margin-left:10px;
                ">
                    <input
                        type="checkbox"
                        class="checkboxCategoriaFiltro"
                        data-tipo="ingreso"
                        value="${cat.nombre}"
                        ${seleccionadas.includes(cat.nombre) ? 'checked' : ''}
                    >
                    ${cat.nombre}
                </label>
            `).join('')}
        `;

        catSelect.style.display = 'none';
    }

    const modal = document.getElementById('modalFiltros');

    if (modal) {
        modal.classList.add('active');
    }
}

// Función auxiliar para cargar categorías de gastos en el select
async function cargarCategoriasEnSelectGastos(select) {

    if (!select) return;

    // 🔥 SI NO HAY DATOS, ESPERA CACHE
    if (!categoriasGastos || categoriasGastos.length === 0) {
        console.log('⚠️ categorias vacías, esperando cache...');
        categoriasGastos = await getGastosCategoriasCached();
    }
    console.log('=== CARGANDO SELECT GASTOS ===');
    console.log('categoriasGastos:', categoriasGastos);
    console.log('cantidad:', categoriasGastos.length);

    console.log('categoriasGastos en el select:', categoriasGastos);
    console.log('cantidad:', categoriasGastos.length);

    if (!select) return;
    select.innerHTML = '<option value="">Todas las categorías</option>';
    categoriasGastos.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nombre;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}

// Función auxiliar para cargar categorías de ingresos en el select
function cargarCategoriasEnSelectIngresos(select) {
    if (!select) return;
    select.innerHTML = '<option value="">Todas las categorías</option>';
    categoriasIngresos.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nombre;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}

function cerrarModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.classList.remove('active');
    }
}

function mostrarResumenCategorias(tipo) {

    const titulo = document.getElementById('tituloResumenCategorias');
    const contenido = document.getElementById('contenidoResumenCategorias');

    let datos = [];
    let totalGeneral = 0;

    if (tipo === 'gastos') {

        titulo.textContent = 'Resumen de Gastos';

        const agrupados = {};

        (window.dashboardGastosFiltrados || []).forEach(gasto => {

            const categoria = gasto.categoria || 'Sin categoría';
            const monto = Number(gasto.monto || 0);

            if (!agrupados[categoria]) {
                agrupados[categoria] = {
                    total: 0,
                    operaciones: 0
                };
            }

            agrupados[categoria].total += monto;
            agrupados[categoria].operaciones += 1;

            totalGeneral += monto;

        });

        datos = Object.entries(agrupados)
            .map(([nombre, info]) => ({
                nombre,
                total: info.total,
                operaciones: info.operaciones
            }))
            .sort((a, b) => b.total - a.total);

    } else {

        titulo.textContent = 'Resumen de Ingresos';

        const agrupados = {};

        (window.dashboardIngresosFiltrados || []).forEach(ingreso => {

            const origen = ingreso.origen || 'Sin origen';
            const monto = Number(ingreso.monto || 0);

            if (!agrupados[origen]) {
                agrupados[origen] = {
                    total: 0,
                    operaciones: 0
                };
            }

            agrupados[origen].total += monto;
            agrupados[origen].operaciones += 1;

            totalGeneral += monto;

        });

        datos = Object.entries(agrupados)
            .map(([nombre, info]) => ({
                nombre,
                total: info.total,
                operaciones: info.operaciones
            }))
            .sort((a, b) => b.total - a.total);

    }

    if (datos.length === 0) {

        contenido.innerHTML = `
            <div style="text-align:center;padding:2rem;">
                No hay datos para mostrar
            </div>
        `;

        abrirModalResumenCategorias();
        return;
    }

    let html = `
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th style="text-align:left;padding:8px;">Categoría</th>
                    <th style="text-align:right;padding:8px;">Importe</th>
                    <th style="text-align:right;padding:8px;">%</th>
                    <th style="text-align:center;padding:8px;">Ops</th>
                </tr>
            </thead>
            <tbody>
    `;

    datos.forEach(item => {

        const porcentaje = totalGeneral > 0
            ? ((item.total / totalGeneral) * 100).toFixed(1)
            : 0;

        html += `
            <tr>
                <td style="padding:8px;">${item.nombre}</td>

                <td style="padding:8px;text-align:right;">
                    ${item.total.toFixed(2)} €
                </td>

                <td style="padding:8px;text-align:right;">
                    ${porcentaje}%
                </td>

                <td style="padding:8px;text-align:center;">
                    (${item.operaciones})
                </td>
            </tr>
        `;
    });

    const totalOperaciones = datos.reduce(
        (sum, item) => sum + item.operaciones,
        0
    );

    html += `
            </tbody>
        </table>

        <hr style="margin:1rem 0;">

        <div style="
            display:flex;
            justify-content:space-between;
            font-weight:bold;
            font-size:1.1rem;
        ">
            <span>TOTAL</span>
            <span>${formatNumber(totalGeneral)} €</span>
        </div>

        <div style="
            margin-top:0.75rem;
            text-align:center;
            color:var(--text-secondary);
            font-size:0.9rem;
        ">
            ${datos.length} categorías · ${totalOperaciones} operaciones
        </div>
    `;

    contenido.innerHTML = html;

    abrirModalResumenCategorias();
}

function abrirModalResumenCategorias() {
    const modal = document.getElementById('modalResumenCategorias');

    if (modal) {
        modal.classList.add('active');
    }
}

function cerrarModalResumenCategorias() {
    const modal = document.getElementById('modalResumenCategorias');

    if (modal) {
        modal.classList.remove('active');
    }
}

function hasPermission(roleNeeded) {
    const role = window.currentUserRole || localStorage.getItem('user_role') || 'usuario';

    if (roleNeeded === 'operador') {
        return role === 'operador';
    }

    return true;
}

console.log('✅ Módulo de dashboard cargado');