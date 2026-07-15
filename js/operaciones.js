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

        const userId = getCurrentUser()?.id;

        if (!userId || userId === 'undefined') {
            console.error('No user ID en operaciones');
            return [];
        }

        const { data, error } = await supabase
            .from(TABLES.operaciones)
            .select('*')
            .eq('user_id', userId)
            .order('fecha', { ascending: false });

        if (error) {
            console.error('Error al cargar operaciones:', error);
            showError?.('Error al cargar las operaciones');
            return [];
        }

        operacionesList = data || [];
        displayOperaciones?.();

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

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    if (operacionesList.length === 0) {
        container.innerHTML =
            '<p class="empty-message">No hay operaciones registradas</p>';
        return;
    }

    container.innerHTML = operacionesList.map(operacion => {
        const id = Number(operacion.id);
        const plataforma = escapeHTML(operacion.plataforma || 'Sin plataforma');
        const fecha = escapeHTML(formatDate(operacion.fecha));
        const enviado = escapeHTML(formatCurrency(operacion.monto_enviado, operacion.moneda_enviada));
        const recibido = escapeHTML(formatCurrency(operacion.monto_recibido, operacion.moneda_recibida));
        const monedaEnviada = escapeHTML(operacion.moneda_enviada || '');
        const monedaRecibida = escapeHTML(operacion.moneda_recibida || '');
        const notas = escapeHTML(operacion.notas || '');

        const ganancia = Number(operacion.ganancia_perdida) || 0;
        const gananciaClass = ganancia >= 0 ? 'positive' : 'negative';
        const gananciaSigno = ganancia >= 0 ? '+' : '';
        const gananciaTexto = escapeHTML(formatCurrency(ganancia, 'EUR'));

        return `
            <div class="list-item-card" data-id="${id}">
                <div class="item-info">
                    <div class="item-title">${plataforma}</div>

                    <div class="item-subtitle">
                        ${fecha} ·
                        Enviado: ${enviado} ${monedaEnviada} →
                        Recibido: ${recibido} ${monedaRecibida}
                    </div>

                    ${notas ? `<div class="item-subtitle">📝 ${notas}</div>` : ''}
                </div>

                <div class="item-amount ${gananciaClass}">
                    ${gananciaSigno}${gananciaTexto}
                </div>

                <div class="item-actions">
                    <button class="btn-icon btn-small edit-operacion" data-id="${id}" title="Editar">✏️</button>
                    <button class="btn-icon btn-small delete-operacion" data-id="${id}" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-operacion').forEach(btn => {
        btn.addEventListener('click', () => editOperacion(Number(btn.dataset.id)));
    });

    document.querySelectorAll('.delete-operacion').forEach(btn => {
        btn.addEventListener('click', () => deleteOperacion(Number(btn.dataset.id)));
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

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const escapeAttr = escapeHTML;

    modalTitle.textContent =
        operacion ? '✏️ Editar Operación' : '🔄 Nueva Operación';

    const fecha = escapeAttr(operacion ? operacion.fecha : getTodayDate());
    const montoEnviado = escapeAttr(operacion ? operacion.monto_enviado : '');
    const montoRecibido = escapeAttr(operacion ? operacion.monto_recibido : '');
    const notas = escapeHTML(operacion ? operacion.notas || '' : '');

    const plataformaActual = operacion?.plataforma || '';
    const monedaEnviada = operacion?.moneda_enviada || 'EUR';
    const monedaRecibida = operacion?.moneda_recibida || 'EUR';

    const plataformasOptions = APP_CONFIG.categories.plataformas.map(plat => {
        const selected = plataformaActual === plat ? 'selected' : '';

        return `
            <option value="${escapeAttr(plat)}" ${selected}>
                ${escapeHTML(plat)}
            </option>
        `;
    }).join('');

    modalBody.innerHTML = `
        <form id="operacionForm">
            <div class="form-group">
                <label for="operacionFecha">Fecha *</label>
                <input type="date" id="operacionFecha" name="fecha" value="${fecha}" required>
            </div>

            <div class="form-group">
                <label for="operacionPlataforma">Plataforma *</label>
                <select id="operacionPlataforma" name="plataforma" required>
                    <option value="">Seleccionar plataforma</option>
                    ${plataformasOptions}
                </select>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="operacionMontoEnviado">Monto Enviado *</label>
                    <input type="number" id="operacionMontoEnviado" name="monto_enviado" step="0.01" value="${montoEnviado}" required>
                </div>

                <div class="form-group">
                    <label for="operacionMonedaEnviada">Moneda *</label>
                    <select id="operacionMonedaEnviada" name="moneda_enviada" required>
                        <option value="EUR" ${monedaEnviada === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USDT" ${monedaEnviada === 'USDT' ? 'selected' : ''}>USDT (₿)</option>
                        <option value="BS" ${monedaEnviada === 'BS' ? 'selected' : ''}>BS (Bs.)</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="operacionMontoRecibido">Monto Recibido *</label>
                    <input type="number" id="operacionMontoRecibido" name="monto_recibido" step="0.01" value="${montoRecibido}" required>
                </div>

                <div class="form-group">
                    <label for="operacionMonedaRecibida">Moneda *</label>
                    <select id="operacionMonedaRecibida" name="moneda_recibida" required>
                        <option value="EUR" ${monedaRecibida === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USDT" ${monedaRecibida === 'USDT' ? 'selected' : ''}>USDT (₿)</option>
                        <option value="BS" ${monedaRecibida === 'BS' ? 'selected' : ''}>BS (Bs.)</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="operacionNotas">Notas</label>
                <textarea id="operacionNotas" name="notas" rows="2" placeholder="Ej: Tasa de cambio utilizada, comisiones, etc.">${notas}</textarea>
            </div>

            <div id="gananciaPreview" class="form-message info" style="display: none;"></div>

            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelOperacionBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">${operacion ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;

    modal.classList.add('active');

    document.getElementById('operacionForm')?.addEventListener('submit', saveOperacion);
    document.getElementById('cancelOperacionBtn')?.addEventListener('click', closeModal);

    document.getElementById('operacionMontoEnviado')?.addEventListener('input', previewGanancia);
    document.getElementById('operacionMonedaEnviada')?.addEventListener('change', previewGanancia);
    document.getElementById('operacionMontoRecibido')?.addEventListener('input', previewGanancia);
    document.getElementById('operacionMonedaRecibida')?.addEventListener('change', previewGanancia);
}

// Previsualizar ganancia/pérdida
async function previewGanancia() {
    const montoEnviado = parseFloat(document.getElementById('operacionMontoEnviado')?.value || 0);
    const monedaEnviada = document.getElementById('operacionMonedaEnviada')?.value;
    const montoRecibido = parseFloat(document.getElementById('operacionMontoRecibido')?.value || 0);
    const monedaRecibida = document.getElementById('operacionMonedaRecibida')?.value;

    if (!montoEnviado || !monedaEnviada || !montoRecibido || !monedaRecibida) return;

    const ganancia = await calculateGanancia(
        montoEnviado,
        monedaEnviada,
        montoRecibido,
        monedaRecibida
    );

    const preview = document.getElementById('gananciaPreview');

    if (preview) {
        const gananciaClass = ganancia >= 0 ? 'success' : 'error';
        const gananciaSigno = ganancia >= 0 ? '+' : '';

        preview.className = `form-message ${gananciaClass}`;

        preview.textContent =
            `Ganancia/Pérdida estimada: ${gananciaSigno}${formatCurrency(ganancia, 'EUR')}`;

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
        notas: notas || null,
        user_id: getCurrentUser()?.id
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
        await loadOperaciones?.();
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
                await loadOperaciones?.();
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

    if (!btnAddOperacion) return;

    btnAddOperacion.addEventListener('click', () => {
        showOperacionModal();
    });
}

console.log('✅ Módulo de operaciones cargado');