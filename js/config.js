// ============================================
// CONFIGURACIÓN GLOBAL - Supabase y APIs
// ============================================

// Configuración de Supabase
const SUPABASE_CONFIG = {
    // URL del proyecto (obtenida de Supabase)
    url: 'https://xcqoefomptnkonueloid.supabase.co',
    
    // Publishable key (clave pública para el cliente)
    anonKey: 'sb_publishable_IWZUGZiIzX024oEJ3_j-uA_IJgfJS7S',
    
    // Configuración adicional
    schema: 'public',
    autoRefreshToken: true,
    persistSession: true
};

// Configuración de APIs de tasas de cambio
const TASAS_CONFIG = {
    // Binance API (pública, no requiere clave)
    binanceApi: 'https://api.binance.com/api/v3/ticker/price',
    
    // Bybit API (pública para tasas)
    bybitApi: 'https://api.bybit.com/v5/market/tickers',
    
    // Tiempo de actualización (5 minutos en milisegundos)
    refreshInterval: 5 * 60 * 1000,
    
    // Monedas soportadas
    currencies: {
        USDT: 'USDT',
        EUR: 'EUR',
        BS: 'BS'
    },
    
    // Pares de conversión
    pairs: [
        { from: 'USDT', to: 'EUR', symbol: 'USDTEUR' },
        { from: 'BS', to: 'EUR', symbol: 'BSEUR' }
    ]
};

// Configuración de la aplicación
const APP_CONFIG = {
    // Nombre de la aplicación
    name: 'Gestor de Gastos y Remesas',
    
    // Versión
    version: '1.0.0',
    
    // Moneda base (para conversiones)
    baseCurrency: 'EUR',
    
    // Categorías predefinidas
    categories: {
        gastos: ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Entretenimiento', 'Salud', 'Educación', 'Otros'],
        ingresos: ['Trabajo', 'Remesa', 'Inversión', 'Regalo', 'Otros'],
        plataformas: ['Bybit', 'Binance', 'Otra']
    }
};

// Tablas de Supabase
const TABLES = {
    gastos: 'gastos',
    ingresos: 'ingresos',
    operaciones: 'operaciones',
    tasas: 'tasas',
    usuario_config: 'usuario_config'
};

// Mensajes de error predefinidos
const ERROR_MESSAGES = {
    network: 'Error de conexión. Verifica tu internet.',
    auth: 'Error de autenticación. Inicia sesión nuevamente.',
    unauthorized: 'No autorizado. Por favor inicia sesión.',
    notFound: 'Datos no encontrados.',
    serverError: 'Error en el servidor. Intenta más tarde.',
    invalidData: 'Datos inválidos. Verifica la información.',
    emailInUse: 'Este correo ya está registrado.',
    weakPassword: 'La contraseña debe tener al menos 6 caracteres.',
    invalidEmail: 'Correo electrónico inválido.'
};

// Inicializar cliente de Supabase
let supabaseClient = null;

function initSupabase() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey,
            {
                auth: {
                    autoRefreshToken: SUPABASE_CONFIG.autoRefreshToken,
                    persistSession: SUPABASE_CONFIG.persistSession
                }
            }
        );
    }
    return supabaseClient;
}

// Obtener cliente de Supabase (inicializado)
function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

// Verificar conexión a Supabase
async function checkSupabaseConnection() {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from(TABLES.gastos).select('count', { count: 'exact', head: true });
        if (error && error.code !== 'PGRST301') {
            console.error('Error de conexión a Supabase:', error);
            return false;
        }
        console.log('✅ Conexión a Supabase exitosa');
        return true;
    } catch (error) {
        console.error('❌ Error conectando a Supabase:', error);
        return false;
    }
}

// Exportar configuración (para uso en otros archivos)
console.log('✅ Configuración cargada correctamente');