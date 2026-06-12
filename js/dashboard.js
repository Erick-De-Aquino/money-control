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
    categoria: ''
};

// Cargar datos para el dashboard
async function loadDashboardData() {
    try {
        const supabase = getSupabase();
        
        // Fechas del mes actual (por defecto)
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        const mesActual = hoy.getMonth() + 1;
        const fechaInicioDefault = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
        const fechaFinDefault = `${añoActual}-${String(mesActual).padStart(2, '0')}-${new Date(añoActual, mesActual, 0).getDate()}`;
        
        // Usar filtros del dashboard si existen, sino usar mes actual
        const desde = filtroDashboard.desde || fechaInicioDefault;
        const hasta = filtroDashboard.hasta || fechaFinDefault;
        
        // Consulta de gastos con filtros
        let gastosQuery = supabase.from(TABLES.gastos).select('*');
        gastosQuery = gastosQuery.gte('fecha', desde).lte('fecha', hasta);
        if (filtroDashboard.categoria) {
            gastosQuery = gastosQuery.eq('categoria', filtroDashboard.categoria);
        }
        
        const { data: gastos, error: errorGastos } = await gastosQuery;
        if (errorGastos) console.error('Error cargando gastos:', errorGastos);

        // Consulta de ingresos
        let ingresosQuery = supabase.from(TABLES.ingresos).select('*');
        ingresosQuery = ingresosQuery.gte('fecha', desde).lte('fecha', hasta);

        const { data: ingresos, error: errorIngresos } = await ingresosQuery;
        if (errorIngresos) console.error('Error cargando ingresos:', errorIngresos);

        // Guardar datos filtrados para los modales de resumen
        window.dashboardGastosFiltrados = gastos || [];
        window.dashboardIngresosFiltrados = ingresos || [];
        
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

        gananciaOperacionesEl.textContent =
            formatCurrency(gananciaOperaciones, 'EUR');

        if (gananciaOperaciones >= 0) {
            gananciaOperacionesEl.style.color =
                'var(--success, #4CAF50)';
        } else {
            gananciaOperacionesEl.style.color =
                'var(--error, #f44336)';
        }
    }

    // Botón detalle gastos
    const targetCardGastos = totalGastosEl.closest('.stat-card');

    if (targetCardGastos &&
        !document.getElementById('btnProgresoGastos')) {

        const btnContainer = document.createElement('div');

        btnContainer.style.marginTop = '12px';
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

    // Botón detalle ingresos
    const targetCardIngresos = totalIngresosEl.closest('.stat-card');

    if (targetCardIngresos &&
        !document.getElementById('btnProgresoIngresos')) {

        const btnContainer = document.createElement('div');

        btnContainer.style.marginTop = '12px';
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
            if (
                sideMenu.classList.contains('open') &&
                !sideMenu.contains(e.target) &&
                !menuToggle.contains(e.target)
            ) {
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

    // Modal filtros
    const btnAbrirFiltros = document.getElementById('btnAbrirModalFiltros');

    if (btnAbrirFiltros) {
        btnAbrirFiltros.addEventListener('click', abrirModalFiltros);
    }

    const closeModalFiltros = document.getElementById('closeModalFiltros');

    if (closeModalFiltros) {
        closeModalFiltros.addEventListener('click', cerrarModalFiltros);
    }

    const modalFiltros = document.getElementById('modalFiltros');

    if (modalFiltros) {
        modalFiltros.addEventListener('click', (e) => {
            if (e.target === modalFiltros) {
                cerrarModalFiltros();
            }
        });
    }

    // Botón limpiar filtro de la reseña
    const btnLimpiarReseña = document.getElementById('btnLimpiarFiltroDashboardReseña');

    if (btnLimpiarReseña) {
        btnLimpiarReseña.addEventListener('click', () => {
            limpiarFiltroDashboard();
        });
    }

    const closeResumen = document.getElementById('closeModalResumenCategorias');

    if (closeResumen) {
        closeResumen.addEventListener('click', cerrarModalResumenCategorias);
    }

    const modalResumen = document.getElementById('modalResumenCategorias');

    if (modalResumen) {
        modalResumen.addEventListener('click', (e) => {
            if (e.target === modalResumen) {
                cerrarModalResumenCategorias();
            }
        });
    }

    const closeModalResumen = document.getElementById('closeModalResumenCategorias');

    if (closeModalResumen) {
        closeModalResumen.addEventListener('click', cerrarModalResumenCategorias);
    }

    // Acordeón categorías
    const toggleCategoriasGastos = document.getElementById('toggleCategoriasGastos');
    const accordionCategoriasGastos = document.getElementById('accordionCategoriasGastos');

    if (toggleCategoriasGastos && accordionCategoriasGastos) {

        toggleCategoriasGastos.addEventListener('click', () => {

            accordionCategoriasGastos.classList.toggle('hidden');

            const icon =
                toggleCategoriasGastos.querySelector('.accordion-icon');

            if (icon) {
                icon.classList.toggle('rotated');
            }
        });
    }

    const toggleCategoriasIngresos = document.getElementById('toggleCategoriasIngresos');
    const accordionCategoriasIngresos = document.getElementById('accordionCategoriasIngresos');

    // En móvil iniciar acordeones cerrados
    if (window.innerWidth <= 768) {

        accordionCategoriasGastos?.classList.add('hidden');
        accordionCategoriasIngresos?.classList.add('hidden');

        const iconGastos =
            toggleCategoriasGastos?.querySelector('.accordion-icon');

        const iconIngresos =
            toggleCategoriasIngresos?.querySelector('.accordion-icon');

        iconGastos?.classList.add('rotated');
        iconIngresos?.classList.add('rotated');
    }

    if (toggleCategoriasIngresos && accordionCategoriasIngresos) {

        toggleCategoriasIngresos.addEventListener('click', () => {

            accordionCategoriasIngresos.classList.toggle('hidden');

            const icon =
                toggleCategoriasIngresos.querySelector('.accordion-icon');

            if (icon) {
                icon.classList.toggle('rotated');
            }
        });
    }

    // Nuevo gasto desde dashboard
    const btnNuevoGastoDashboard =
        document.getElementById('btnNuevoGastoDashboard');

    if (btnNuevoGastoDashboard) {

        btnNuevoGastoDashboard.addEventListener('click', async () => {

            await loadGastosCategorias();

            showGastoModal();
        });
    }

    // Nuevo ingreso desde dashboard
    const btnNuevoIngresoDashboard =
        document.getElementById('btnNuevoIngresoDashboard');

    if (btnNuevoIngresoDashboard) {

        btnNuevoIngresoDashboard.addEventListener('click', async () => {

            await loadIngresosCategorias();

            showIngresoModal();
        });
    }
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
    
    // Actualizar el filtro activo para el modal central
    window.filtroActivoPara = page;
    
    // Limpiar filtros según la página (se limpia TODO al cambiar)
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
    if (window.filtroActivoPara === 'gastos') {
        // Ejecutar filtro de gastos
        filtroGastos.desde = document.getElementById('filtroDashboardDesde')?.value || '';
        filtroGastos.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
        filtroGastos.categoria = document.getElementById('filtroDashboardCategoria')?.value || '';
        
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
                
                if (intervaloParpadeoGastos) clearInterval(intervaloParpadeoGastos);
                
                let estado = true;
                intervaloParpadeoGastos = setInterval(() => {
                    if (reseña && reseña.style.display !== 'none') {
                        reseña.className = estado ? 'filtro-reseña-normal' : 'filtro-reseña-alerta';
                        estado = !estado;
                    } else {
                        clearInterval(intervaloParpadeoGastos);
                        intervaloParpadeoGastos = null;
                    }
                }, 2000);
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
        // Ejecutar filtro de ingresos
        filtroIngresos.desde = document.getElementById('filtroDashboardDesde')?.value || '';
        filtroIngresos.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
        filtroIngresos.categoria = document.getElementById('filtroDashboardCategoria')?.value || '';
        
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
                
                if (intervaloParpadeoIngresos) clearInterval(intervaloParpadeoIngresos);
                
                let estado = true;
                intervaloParpadeoIngresos = setInterval(() => {
                    if (reseña && reseña.style.display !== 'none') {
                        reseña.className = estado ? 'filtro-reseña-normal' : 'filtro-reseña-alerta';
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
        // Dashboard (default)
        filtroDashboard.desde = document.getElementById('filtroDashboardDesde')?.value || '';
        filtroDashboard.hasta = document.getElementById('filtroDashboardHasta')?.value || '';
        filtroDashboard.categoria = document.getElementById('filtroDashboardCategoria')?.value || '';
        
        await actualizarSelectDashboardCategorias();
        await loadDashboardData();
        
        const reseña = document.getElementById('filtroReseña');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroDashboardReseña');
        
        if (filtroDashboard.desde || filtroDashboard.hasta || filtroDashboard.categoria) {
            if (reseña) {
                let texto = '⚠️ Filtro aplicado';
                if (filtroDashboard.desde && filtroDashboard.hasta) {
                    texto = `⚠️ Filtro aplicado con rango ${filtroDashboard.desde} - ${filtroDashboard.hasta}`;
                } else if (filtroDashboard.desde) {
                    texto = `⚠️ Filtro aplicado desde ${filtroDashboard.desde}`;
                } else if (filtroDashboard.hasta) {
                    texto = `⚠️ Filtro aplicado hasta ${filtroDashboard.hasta}`;
                }
                if (filtroDashboard.categoria) {
                    texto += ` | Categoría: ${filtroDashboard.categoria}`;
                }
                reseña.textContent = texto;
                reseña.style.display = 'flex';
                reseña.className = 'filtro-reseña-normal';
                
                if (intervaloParpadeo) clearInterval(intervaloParpadeo);
                
                let estado = true;
                intervaloParpadeo = setInterval(() => {
                    if (reseña && reseña.style.display !== 'none') {
                        reseña.className = estado ? 'filtro-reseña-normal' : 'filtro-reseña-alerta';
                        estado = !estado;
                    } else {
                        clearInterval(intervaloParpadeo);
                        intervaloParpadeo = null;
                    }
                }, 500);
            }
            if (btnLimpiar) btnLimpiar.style.display = 'flex';
        } else {
            if (reseña) {
                reseña.style.display = 'none';
                if (intervaloParpadeo) {
                    clearInterval(intervaloParpadeo);
                    intervaloParpadeo = null;
                }
            }
            if (btnLimpiar) btnLimpiar.style.display = 'none';
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
    filtroDashboard = { desde: '', hasta: '', categoria: '' };
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    loadDashboardData();
    
    // Ocultar reseña y botón de limpiar
    const reseña = document.getElementById('filtroReseña');
    const btnLimpiar = document.getElementById('btnLimpiarFiltroDashboardReseña');
    if (reseña) {
        reseña.style.display = 'none';
        // Detener el intervalo de parpadeo
        if (intervaloParpadeo) {
            clearInterval(intervaloParpadeo);
            intervaloParpadeo = null;
        }
    }
    if (btnLimpiar) btnLimpiar.style.display = 'none';
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

// Mostrar modal con progreso de gastos del mes actual
async function mostrarModalProgreso() {
    try {
        const supabase = getSupabase();
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        const mesActual = hoy.getMonth() + 1;
        
        // Fechas del mes actual
        const fechaInicio = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
        const fechaFin = `${añoActual}-${String(mesActual).padStart(2, '0')}-${new Date(añoActual, mesActual, 0).getDate()}`;
        
        // Obtener gastos del mes actual
        const { data: gastos, error } = await supabase
            .from(TABLES.gastos)
            .select('*')
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin);
        
        if (error) {
            console.error('Error cargando gastos del mes:', error);
            showError('Error al cargar los datos');
            return;
        }
        
        // Agrupar por categoría y sumar montos en EUR
        const categorias = {};
        let totalMes = 0;
        
        (gastos || []).forEach(gasto => {
            const cat = gasto.categoria || 'Sin categoría';
            const montoEUR = gasto.monto_eur || gasto.monto;
            categorias[cat] = (categorias[cat] || 0) + montoEUR;
            totalMes += montoEUR;
        });
        
        // Ordenar categorías por monto (mayor a menor)
        const categoriasOrdenadas = Object.entries(categorias)
            .sort((a, b) => b[1] - a[1]);
        
        // Crear contenido HTML del modal
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.querySelector('#modal .modal-body');
        
        if (!modal || !modalTitle || !modalBody) return;
        
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        modalTitle.textContent = `📊 Progreso de Gastos - ${meses[mesActual - 1]} ${añoActual}`;
        
        if (categoriasOrdenadas.length === 0) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p>No hay gastos registrados en este mes.</p>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-primary" id="cerrarModalProgreso">Cerrar</button>
                </div>
            `;
        } else {
            let listaHTML = '<div style="max-height: 400px; overflow-y: auto;">';
            listaHTML += '<table style="width: 100%; border-collapse: collapse;">';
            listaHTML += '<thead><tr style="border-bottom: 1px solid var(--border-light);"><th style="text-align: left; padding: 8px;">Categoría</th><th style="text-align: right; padding: 8px;">Monto (EUR)</th></tr></thead>';
            listaHTML += '<tbody>';
            
            for (const [categoria, monto] of categoriasOrdenadas) {
                listaHTML += `
                    <tr style="border-bottom: 1px solid var(--border-light);">
                        <td style="padding: 8px;">${categoria}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${formatCurrency(monto, 'EUR')}</td>
                    </tr>
                `;
            }
            
            listaHTML += '</tbody>';
            listaHTML += '</table>';
            listaHTML += '</div>';
            
            listaHTML += `
                <div style="margin-top: 16px; padding-top: 12px; border-top: 2px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                        <span>Total del mes:</span>
                        <span>${formatCurrency(totalMes, 'EUR')}</span>
                    </div>
                </div>
                <div class="form-actions" style="margin-top: 20px;">
                    <button type="button" class="btn btn-primary" id="cerrarModalProgreso">Cerrar</button>
                </div>
            `;
            
            modalBody.innerHTML = listaHTML;
        }
        
        modal.classList.add('active');
        
        // Evento para cerrar modal
        const cerrarBtn = document.getElementById('cerrarModalProgreso');
        if (cerrarBtn) {
            cerrarBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        
    } catch (error) {
        console.error('Error en mostrarModalProgreso:', error);
        showError('Error al mostrar el progreso');
    }
}

// Mostrar modal con progreso de ingresos del mes actual
async function mostrarModalProgresoIngresos() {
    try {
        const supabase = getSupabase();
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        const mesActual = hoy.getMonth() + 1;
        
        // Fechas del mes actual
        const fechaInicio = `${añoActual}-${String(mesActual).padStart(2, '0')}-01`;
        const fechaFin = `${añoActual}-${String(mesActual).padStart(2, '0')}-${new Date(añoActual, mesActual, 0).getDate()}`;
        
        // Obtener ingresos del mes actual
        const { data: ingresos, error } = await supabase
            .from(TABLES.ingresos)
            .select('*')
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin);
        
        if (error) {
            console.error('Error cargando ingresos del mes:', error);
            showError('Error al cargar los datos');
            return;
        }
        
        // Agrupar por origen y sumar montos en EUR
        const origenes = {};
        let totalMes = 0;
        
        (ingresos || []).forEach(ingreso => {
            const orig = ingreso.origen || 'Sin origen';
            const montoEUR = ingreso.monto_eur || ingreso.monto;
            origenes[orig] = (origenes[orig] || 0) + montoEUR;
            totalMes += montoEUR;
        });
        
        // Ordenar orígenes por monto (mayor a menor)
        const origenesOrdenados = Object.entries(origenes)
            .sort((a, b) => b[1] - a[1]);
        
        // Crear contenido HTML del modal
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.querySelector('#modal .modal-body');
        
        if (!modal || !modalTitle || !modalBody) return;
        
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        modalTitle.textContent = `📊 Progreso de Ingresos - ${meses[mesActual - 1]} ${añoActual}`;
        
        if (origenesOrdenados.length === 0) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p>No hay ingresos registrados en este mes.</p>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-primary" id="cerrarModalProgresoIngresos">Cerrar</button>
                </div>
            `;
        } else {
            let listaHTML = '<div style="max-height: 400px; overflow-y: auto;">';
            listaHTML += '<table style="width: 100%; border-collapse: collapse;">';
            listaHTML += '<thead><tr style="border-bottom: 1px solid var(--border-light);"><th style="text-align: left; padding: 8px;">Origen</th><th style="text-align: right; padding: 8px;">Monto (EUR)</th></tr></thead>';
            listaHTML += '<tbody>';
            
            for (const [origen, monto] of origenesOrdenados) {
                listaHTML += `
                    <tr style="border-bottom: 1px solid var(--border-light);">
                        <td style="padding: 8px;">${origen}</td>
                        <td style="text-align: right; padding: 8px; font-weight: 500;">${formatCurrency(monto, 'EUR')}</td>
                    </tr>
                `;
            }
            
            listaHTML += '</tbody>';
            listaHTML += '</table>';
            listaHTML += '</div>';
            
            listaHTML += `
                <div style="margin-top: 16px; padding-top: 12px; border-top: 2px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                        <span>Total del mes:</span>
                        <span>${formatCurrency(totalMes, 'EUR')}</span>
                    </div>
                </div>
                <div class="form-actions" style="margin-top: 20px;">
                    <button type="button" class="btn btn-primary" id="cerrarModalProgresoIngresos">Cerrar</button>
                </div>
            `;
            
            modalBody.innerHTML = listaHTML;
        }
        
        modal.classList.add('active');
        
        // Evento para cerrar modal
        const cerrarBtn = document.getElementById('cerrarModalProgresoIngresos');
        if (cerrarBtn) {
            cerrarBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        
    } catch (error) {
        console.error('Error en mostrarModalProgresoIngresos:', error);
        showError('Error al mostrar el progreso');
    }
}

// Abrir modal de filtros (cargando valores según página activa)
function abrirModalFiltros() {
    // Cargar valores actuales según la página activa
    if (window.filtroActivoPara === 'gastos') {
        const desdeInput = document.getElementById('filtroDashboardDesde');
        const hastaInput = document.getElementById('filtroDashboardHasta');
        const catSelect = document.getElementById('filtroDashboardCategoria');
        
        if (desdeInput) desdeInput.value = filtroGastos.desde || '';
        if (hastaInput) hastaInput.value = filtroGastos.hasta || '';
        if (catSelect) {
            // Cargar categorías de gastos en el select
            cargarCategoriasEnSelectGastos(catSelect);
            catSelect.value = filtroGastos.categoria || '';
        }
    } else if (window.filtroActivoPara === 'ingresos') {
        const desdeInput = document.getElementById('filtroDashboardDesde');
        const hastaInput = document.getElementById('filtroDashboardHasta');
        const catSelect = document.getElementById('filtroDashboardCategoria');
        
        if (desdeInput) desdeInput.value = filtroIngresos.desde || '';
        if (hastaInput) hastaInput.value = filtroIngresos.hasta || '';
        if (catSelect) {
            // Cargar categorías de ingresos en el select
            cargarCategoriasEnSelectIngresos(catSelect);
            catSelect.value = filtroIngresos.categoria || '';
        }
    } else {
        // Dashboard
        const desdeInput = document.getElementById('filtroDashboardDesde');
        const hastaInput = document.getElementById('filtroDashboardHasta');
        const catSelect = document.getElementById('filtroDashboardCategoria');
        
        if (desdeInput) desdeInput.value = filtroDashboard.desde || '';
        if (hastaInput) hastaInput.value = filtroDashboard.hasta || '';
        if (catSelect) catSelect.value = filtroDashboard.categoria || '';
    }
    
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.classList.add('active');
    }
}

// Función auxiliar para cargar categorías de gastos en el select
function cargarCategoriasEnSelectGastos(select) {
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
            <span>${totalGeneral.toFixed(2)} €</span>
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

console.log('✅ Módulo de dashboard cargado');