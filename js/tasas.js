// ============================================
// TASAS DE CAMBIO - APIs y gestión de tasas
// ============================================

// Variables globales
let tasaInterval = null;
let currentTasas = {
    USDT_EUR: null,
    BS_EUR: null
};

/*
// Cargar tasas desde Supabase (caché)
async function loadTasasFromCache() {
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from(TABLES.tasas)
            .select('*')
            .order('fecha_actualizacion', { ascending: false });
        
        if (error) {
            console.error('Error al cargar tasas de caché:', error);
            return null;
        }
        
        if (data && data.length > 0) {
            // Mostrar tasas guardadas
            data.forEach(tasa => {
                const key = `${tasa.moneda_origen}_${tasa.moneda_destino}`;
                currentTasas[key] = tasa.tasa;
                updateTasaDisplay(tasa.moneda_origen, tasa.moneda_destino, tasa.tasa);
            });
            
            // Mostrar historial
            displayTasasHistory(data);
            return data;
        }
        
        return null;
    } catch (error) {
        console.error('Error en loadTasasFromCache:', error);
        return null;
    }
}
*/

// Obtener tasa de Binance
async function getTasaBinance(symbol) {
    try {
        const response = await fetch(`${TASAS_CONFIG.binanceApi}?symbol=${symbol}USDT`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.price) {
            return parseFloat(data.price);
        }
        
        return null;
    } catch (error) {
        console.error(`Error obteniendo tasa de Binance para ${symbol}:`, error);
        return null;
    }
}

// Obtener tasa USDT/EUR desde APIs
async function getTasaUSDT_EUR() {
    try {
        // Intentar con Binance primero
        let tasa = await getTasaBinance('EUR');
        
        if (tasa) {
            console.log(`✅ Tasa USDT/EUR desde Binance: ${tasa}`);
            return tasa;
        }
        
        // Fallback: tasa por defecto
        console.warn('⚠️ Usando tasa USDT/EUR por defecto: 0.92');
        return 0.92;
    } catch (error) {
        console.error('Error en getTasaUSDT_EUR:', error);
        return 0.92; // Tasa por defecto
    }
}

// Obtener tasa BS/EUR (tasa fija o desde API)
async function getTasaBS_EUR() {
    try {
        // Por ahora, tasa fija (se puede conectar a API de BCV después)
        // En Venezuela, la tasa oficial la da BCV
        const tasaOficial = 0.000025; // Aprox: 1 BS = 0.000025 EUR
        
        console.log(`✅ Tasa BS/EUR: ${tasaOficial}`);
        return tasaOficial;
    } catch (error) {
        console.error('Error en getTasaBS_EUR:', error);
        return 0.000025;
    }
}

/*
// Actualizar todas las tasas
async function updateAllTasas() {
    console.log('🔄 Actualizando tasas de cambio...');
    
    const loadingElement = document.getElementById('btnRefreshTasas');
    if (loadingElement) {
        showButtonLoading(loadingElement, 'Actualizando...');
    }
    
    try {
        // Obtener tasas actuales
        const tasaUSDT_EUR = await getTasaUSDT_EUR();
        const tasaBS_EUR = await getTasaBS_EUR();
        
        // Actualizar variables
        currentTasas.USDT_EUR = tasaUSDT_EUR;
        currentTasas.BS_EUR = tasaBS_EUR;
        
        // Mostrar en UI
        updateTasaDisplay('USDT', 'EUR', tasaUSDT_EUR);
        updateTasaDisplay('BS', 'EUR', tasaBS_EUR);
        
        // Guardar en Supabase
        await saveTasaToCache('USDT', 'EUR', tasaUSDT_EUR);
        await saveTasaToCache('BS', 'EUR', tasaBS_EUR);
        
        // Recargar historial
        await loadTasasFromCache();
        
        showSuccess('Tasas actualizadas correctamente');
      console.log('✅ Tasas actualizadas:', currentTasas);
        
    } catch (error) {
        console.error('Error al actualizar tasas:', error);
        showError('Error al actualizar tasas');
    } finally {
        if (loadingElement) {
            hideButtonLoading(loadingElement);
        }
    }
}

// Guardar tasa en caché (Supabase)
async function saveTasaToCache(monedaOrigen, monedaDestino, tasa) {
    try {
        const supabase = getSupabase();
        
        const { error } = await supabase
            .from(TABLES.tasas)
            .insert([{
                moneda_origen: monedaOrigen,
                moneda_destino: monedaDestino,
                tasa: tasa,
                fecha_actualizacion: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Error al guardar tasa:', error);
        } else {
            console.log(`✅ Tasa guardada: ${monedaOrigen} → ${monedaDestino} = ${tasa}`);
        }
    } catch (error) {
        console.error('Error en saveTasaToCache:', error);
    }
}

// Actualizar display de tasa en UI
function updateTasaDisplay(monedaOrigen, monedaDestino, tasa) {
    const elementId = `tasa${monedaOrigen}_${monedaDestino}`;
    const element = document.getElementById(elementId);
    
    if (element) {
        element.textContent = formatCurrency(tasa, monedaDestino);
    }
    
    // Formato alternativo (para IDs sin guión bajo)
    const altElement = document.getElementById(`tasa${monedaOrigen}${monedaDestino}`);
    if (altElement) {
        altElement.textContent = formatCurrency(tasa, monedaDestino);
    }
}

// Mostrar historial de tasas
async function displayTasasHistory(tasas) {
    const container = document.getElementById('tasasList');
    if (!container) return;
    
    if (!tasas || tasas.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay tasas guardadas</p>';
        return;
    }
    
    // Mostrar últimas 10 tasas
    const latestTasas = tasas.slice(0, 10);
    
    container.innerHTML = latestTasas.map(tasa => `
        <div class="list-item-card">
            <div class="item-info">
                <div class="item-title">${tasa.moneda_origen} → ${tasa.moneda_destino}</div>
                <div class="item-subtitle">${formatDate(tasa.fecha_actualizacion, 'datetime')}</div>
            </div>
            <div class="item-amount">${formatCurrency(tasa.tasa, tasa.moneda_destino)}</div>
        </div>
    `).join('');
}
*/

// Convertir monto a EUR
async function convertToEUR(monto, moneda) {
    if (moneda === 'EUR') {
        return monto;
    }
    
    let tasa;
    
    if (moneda === 'USDT') {
        tasa = currentTasas.USDT_EUR;
        if (!tasa) {
            tasa = await getTasaUSDT_EUR();
            currentTasas.USDT_EUR = tasa;
        }
    } else if (moneda === 'BS') {
        tasa = currentTasas.BS_EUR;
        if (!tasa) {
            tasa = await getTasaBS_EUR();
            currentTasas.BS_EUR = tasa;
        }
    } else {
        return monto;
    }
    
    return monto * tasa;
}

/*
// Iniciar actualización periódica de tasas (cada 5 minutos)
function startTasaInterval() {
    if (tasaInterval) {
        clearInterval(tasaInterval);
    }
    
    // Actualizar tasas cada 5 minutos
    tasaInterval = setInterval(() => {
        if (isAuthenticated()) {
            console.log('⏰ Actualización automática de tasas...');
            updateAllTasas?.();
        }
    }, TASAS_CONFIG.refreshInterval);
}

// Detener actualización periódica
function stopTasaInterval() {
    if (tasaInterval) {
        clearInterval(tasaInterval);
        tasaInterval = null;
    }
}
*/

/*
// Cargar tasas (función principal)
async function loadTasas() {
    // Primero cargar desde caché
    await loadTasasFromCache();
    
    // Luego actualizar desde APIs
    await updateAllTasas?.();
}
*/

/*console.log('✅ Módulo de tasas cargado');*/

