// ============================================
// TASAS DE CAMBIO - APIs y gestión de tasas
// ============================================

// Variables globales
let tasaInterval = null;
let currentTasas = {
    USDT_EUR: null,
    BS_EUR: null
};

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

