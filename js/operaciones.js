// ============================================
// OPERACIONES - Intercambios de moneda (Bybit/Binance)
// ============================================

// Variables globales
let operacionesList = [];
let editingOperacionId = null;

// Cargar operaciones desde Supabase
async function loadOperaciones() {
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from(TABLES.operaciones)
            .select('*')
            .order('fecha', { ascending: false });
        
        if (error) {
            console.error('Error al cargar operaciones:', error);
            showError('Error al cargar las operaciones');
            return [];
        }
        
        operacionesList = data || [];
        displayOperaciones();
        return operacionesList;
        
    } catch (error) {
        console.error('Error en loadOperaciones:', error);
        return [];
    }
}

// Mostrar operaciones en UI
function displayOperaciones() {
    const container = document.getElementById('operacionesList');
    if (!container) return;
    
    if (operacionesList.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay operaciones registradas</p>';
        return;
    }
    
    container.innerHTML = operacionesList.map(operacion => {
        const ganancia = operacion.ganancia_perdida || 0;
        const gananciaClass = ganancia >= 0 ? 'positive' : 'negative';
        const gananciaSigno = ganancia >= 0 ? '+' : '';
        
        return `
            <div class="list-item-card" data-id="${operacion.id}">
                <div class="item-info">
                    <div class="item-title">${operacion.plataforma}</div>
                    <div class="item-subtitle">
                        ${formatDate(operacion.fecha)} • 
                        Enviado: ${formatCurrency(operacion.monto_enviado, operacion.moneda_enviada)} → 
                        Recibido: ${formatCurrency(operacion.monto_recibido, operacion.moneda_recibida)}
                    </div>
                    ${operacion.notas ? `<div class="item-subtitle">📝 ${operacion.notas}</div>` : ''}
                </div>
                <div class="item-amount ${gananciaClass}">
                    ${gananciaSigno}${formatCurrency(ganancia, 'EUR')}
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-small edit-operacion" data-id="${operacion.id}" title="Editar">✏️</button>
                    <button class="btn-icon btn-small delete-operacion" data-id="${operacion.id}" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.edit-operacion').forEach(btn => {
        btn.addEventListener('click', () => editOperacion(parseInt(btn.dataset.id)));
    });
    
    document.querySelectorAll('.delete-operacion').forEach(btn => {
        btn.addEventListener('click', () => deleteOperacion(parseInt(btn.dataset.id)));
    });
}

// Calcular ganancia/pérdida en EUR
async function calculateGanancia(montoEnviado, monedaEnviada, montoRecibido, monedaRecibida) {
    const enviadoEUR = await convertToEUR(montoEnviado, monedaEnviada);
    const recibidoEUR = await convertToEUR(montoRecibido, monedaRecibida);
    return recibidoEUR - enviadoEUR;
}

// Mostrar modal para agregar/editar operación
function showOperacionModal(operacion = null) {
    editingOperacionId = operacion ? operacion.id : null;
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modalTitle.textContent = operacion ? '✏️ Editar Operación' : '🔄 Nueva Operación';
    
    // Generar formulario
    modalBody.innerHTML = `
        <form id="operacionForm">
            <div class="form-group">
                <label for="operacionFecha">Fecha *</label>
                <input type="date" id="operacionFecha" name="fecha" value="${operacion ? operacion.fecha : getTodayDate()}" required>
            </div>
            
            <div class="form-group">
                <label for="operacionPlataforma">Plataforma *</label>
                <select id="operacionPlataforma" name="plataforma" required>
                    <option value="">Seleccionar plataforma</option>
                    ${APP_CONFIG.categories.plataformas.map(plat => `
                        <option value="${plat}" ${operacion && operacion.plataforma === plat ? 'selected' : ''}>${plat}</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="operacionMontoEnviado">Monto Enviado *</label>
                    <input type="number" id="operacionMontoEnviado" name="monto_enviado" step="0.01" value="${operacion ? operacion.monto_enviado : ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="operacionMonedaEnviada">Moneda *</label>
                    <select id="operacionMonedaEnviada" name="moneda_enviada" required>
                        <option value="EUR" ${operacion && operacion.moneda_enviada === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USDT" ${operacion && operacion.moneda_enviada === 'USDT' ? 'selected' : ''}>USDT (₿)</option>
                        <option value="BS" ${operacion && operacion.moneda_enviada === 'BS' ? 'selected' : ''}>BS (Bs.)</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="operacionMontoRecibido">Monto Recibido *</label>
                    <input type="number" id="operacionMontoRecibido" name="monto_recibido" step="0.01" value="${operacion ? operacion.monto_recibido : ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="operacionMonedaRecibida">Moneda *</label>
                    <select id="operacionMonedaRecibida" name="moneda_recibida" required>
                        <option value="EUR" ${operacion && operacion.moneda_recibida === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USDT" ${operacion && operacion.moneda_recibida === 'USDT' ? 'selected' : ''}>USDT (₿)</option>
                        <option value="BS" ${operacion && operacion.moneda_recibida === 'BS' ? 'selected' : ''}>BS (Bs.)</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label for="operacionNotas">Notas</label>
                <textarea id="operacionNotas" name="notas" rows="2" placeholder="Ej: Tasa de cambio utilizada, comisiones, etc.">${operacion ? operacion.notas || '' : ''}</textarea>
            </div>
            
            <div id="gananciaPreview" class="form-message info" style="display: none;"></div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelOperacionBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">${operacion ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Event listeners
    const form = document.getElementById('operacionForm');
    if (form) {
        form.addEventListener('submit', saveOperacion);
    }
    
    const cancelBtn = document.getElementById('cancelOperacionBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    // Eventos para calcular ganancia en tiempo real
    const montoEnviado = document.getElementById('operacionMontoEnviado');
    const monedaEnviada = document.getElementById('operacionMonedaEnviada');
    const montoRecibido = document.getElementById('operacionMontoRecibido');
    const monedaRecibida = document.getElementById('operacionMonedaRecibida');
    
    if (montoEnviado) montoEnviado.addEventListener('input', previewGanancia);
    if (monedaEnviada) monedaEnviada.addEventListener('change', previewGanancia);
    if (montoRecibido) montoRecibido.addEventListener('input', previewGanancia);
    if (monedaRecibida) monedaRecibida.addEventListener('change', previewGanancia);
}

// Previsualizar ganancia/pérdida
async function previewGanancia() {
    const montoEnviado = parseFloat(document.getElementById('operacionMontoEnviado')?.value || 0);
    const monedaEnviada = document.getElementById('operacionMonedaEnviada')?.value;
    const montoRecibido = parseFloat(document.getElementById('operacionMontoRecibido')?.value || 0);
    const monedaRecibida = document.getElementById('operacionMonedaRecibida')?.value;
    
    if (!montoEnviado || !monedaEnviada || !montoRecibido || !monedaRecibida) return;
    
    const ganancia = await calculateGanancia(montoEnviado, monedaEnviada, montoRecibido, monedaRecibida);
    
    const preview = document.getElementById('gananciaPreview');
    if (preview) {
        const gananciaClass = ganancia >= 0 ? 'success' : 'error';
        const gananciaSigno = ganancia >= 0 ? '+' : '';
        preview.className = `form-message ${gananciaClass}`;
        preview.innerHTML = `<strong>Ganancia/Pérdida estimada:</strong> ${gananciaSigno}${formatCurrency(ganancia, 'EUR')}`;
        preview.style.display = 'block';
    }
}

// Guardar operación (crear o actualizar)
async function saveOperacion(event) {
    event.preventDefault();
    
    const fecha = document.getElementById('operacionFecha')?.value;
    const plataforma = document.getElementById('operacionPlataforma')?.value;
    const montoEnviado = parseFloat(document.getElementById('operacionMontoEnviado')?.value);
    const monedaEnviada = document.getElementById('operacionMonedaEnviada')?.value;
    const montoRecibido = parseFloat(document.getElementById('operacionMontoRecibido')?.value);
    const monedaRecibida = document.getElementById('operacionMonedaRecibida')?.value;
    const notas = document.getElementById('operacionNotas')?.value;
    
    // Validaciones
    if (!fecha || !plataforma || !montoEnviado || !monedaEnviada || !montoRecibido || !monedaRecibida) {
        showError('Por favor completa todos los campos obligatorios');
        return;
    }
    
    if (montoEnviado <= 0 || montoRecibido <= 0) {
        showError('Los montos deben ser mayores a 0');
        return;
    }
    
    // Calcular ganancia/pérdida
    const ganancia = await calculateGanancia(montoEnviado, monedaEnviada, montoRecibido, monedaRecibida);
    
    const operacionData = {
        fecha,
        plataforma,
        monto_enviado: montoEnviado,
        moneda_enviada: monedaEnviada,
        monto_recibido: montoRecibido,
        moneda_recibida: monedaRecibida,
        ganancia_perdida: ganancia,
        notas: notas || null
    };
    
    try {
        const supabase = getSupabase();
        let result;
        
        if (editingOperacionId) {
            // Actualizar
            result = await supabase
                .from(TABLES.operaciones)
                .update(operacionData)
                .eq('id', editingOperacionId);
        } else {
            // Crear nueva
            result = await supabase
                .from(TABLES.operaciones)
                .insert([operacionData]);
        }
        
        if (result.error) {
            console.error('Error al guardar operación:', result.error);
            showError('Error al guardar la operación');
            return;
        }
        
        showSuccess(editingOperacionId ? 'Operación actualizada' : 'Operación guardada');
        closeModal();
        await loadOperaciones();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error en saveOperacion:', error);
        showError('Error al guardar la operación');
    }
}

// Editar operación
async function editOperacion(id) {
    const operacion = operacionesList.find(o => o.id === id);
    if (operacion) {
        showOperacionModal(operacion);
    }
}

// Eliminar operación
async function deleteOperacion(id) {
    const operacion = operacionesList.find(o => o.id === id);
    const ganancia = operacion.ganancia_perdida || 0;
    
    showConfirmModal(
        `¿Eliminar operación de ${operacion.plataforma} con ganancia de ${formatCurrency(ganancia, 'EUR')}?`,
        async () => {
            try {
                const supabase = getSupabase();
                
                const { error } = await supabase
                    .from(TABLES.operaciones)
                    .delete()
                    .eq('id', id);
                
                if (error) {
                    console.error('Error al eliminar operación:', error);
                    showError('Error al eliminar la operación');
                    return;
                }
                
                showSuccess('Operación eliminada');
                await loadOperaciones();
                await loadDashboardData();
                
            } catch (error) {
                console.error('Error en deleteOperacion:', error);
                showError('Error al eliminar la operación');
            }
        },
        'Eliminar Operación'
    );
}

// Inicializar eventos de operaciones
function initOperacionesEvents() {
    const btnAddOperacion = document.getElementById('btnAddOperacion');
    if (btnAddOperacion) {
        btnAddOperacion.addEventListener('click', () => showOperacionModal());
    }
}

console.log('✅ Módulo de operaciones cargado');