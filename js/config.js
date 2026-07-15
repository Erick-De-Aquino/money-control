// ============================================
// CONFIGURACIÓN GLOBAL - Supabase y APIs
// ============================================

// Configuración de Supabase
const SUPABASE_CONFIG = {
    url: 'https://xcqoefomptnkonueloid.supabase.co',
    anonKey: 'sb_publishable_IWZUGZiIzX024oEJ3_j-uA_IJgfJS7S',
    schema: 'public',
    autoRefreshToken: true,
    persistSession: true
};

// Configuración de APIs de tasas de cambio
const TASAS_CONFIG = {
    binanceApi: 'https://api.binance.com/api/v3/ticker/price',
    bybitApi: 'https://api.bybit.com/v5/market/tickers',
    refreshInterval: 5 * 60 * 1000,
    currencies: {
        USDT: 'USDT',
        EUR: 'EUR',
        BS: 'BS'
    },
    pairs: [
        { from: 'USDT', to: 'EUR', symbol: 'USDTEUR' },
        { from: 'BS', to: 'EUR', symbol: 'BSEUR' }
    ]
};

// Configuración de la aplicación
const APP_CONFIG = {
    name: 'Gestor de Gastos y Remesas',
    version: '1.0.0',
    baseCurrency: 'EUR',
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
    usuario_config: 'usuario_config',
    remesas: 'remesas',
    remesas_config: 'remesas_config'
};

// Mensajes de error
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

// ============================================
// 🧠 NIVEL 2 - CACHE GLOBAL (NUEVO)
// ============================================

window.appCache = {
    userId: null,
    categorias: {
        gastos: {
            loaded: false,
            promise: null,
            data: []
        },
        ingresos: {
            loaded: false,
            promise: null,
            data: []
        }
    }
};

// ============================================
// SUPABASE CLIENT
// ============================================

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

function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

// Verificar conexión
async function checkSupabaseConnection() {
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from(TABLES.gastos)
            .select('count', { count: 'exact', head: true });

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

console.log('✅ Configuración cargada correctamente');
