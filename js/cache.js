const CACHE_KEY = 'app_cache_v1';

function saveCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(window.appCache));
}

function loadCache() {
    const data = localStorage.getItem(CACHE_KEY);

    window.appCache = {
        categorias: {
            gastos: { loaded: false, promise: null, data: [] },
            ingresos: { loaded: false, promise: null, data: [] }
        }
    };

    if (data) {
        const parsed = JSON.parse(data);

        // merge seguro (evita romper estructura)
        if (parsed?.categorias) {
            window.appCache.categorias.gastos = {
                ...window.appCache.categorias.gastos,
                ...(parsed.categorias.gastos || {})
            };

            window.appCache.categorias.ingresos = {
                ...window.appCache.categorias.ingresos,
                ...(parsed.categorias.ingresos || {})
            };
        }
    }
}

async function getCategoriasCache(tipo) {
    if (!tipo) return [];

    const cache = window.appCache.categorias?.[tipo];

    if (!cache) {
        console.warn('Tipo de categoría no soportado:', tipo);
        return [];
    }

    if (cache.loaded) return cache.data;

    if (cache.promise) return await cache.promise;

    cache.promise = (async () => {
        try {
            const supabase = getSupabase();

            const { data, error } = await supabase
                .from('categorias')
                .select('*')
                .eq('tipo', tipo === 'gastos' ? 'gasto' : 'ingreso')
                .order('nombre');

            if (error) {
                console.error('Error cargando categorías:', error);
                cache.promise = null;
                return [];
            }

            const categorias = data || [];

            cache.data = categorias;
            cache.loaded = true;
            cache.promise = null;

            return categorias;

        } catch (err) {
            console.error('Error en cache global:', err);
            cache.promise = null;
            return [];
        }
    })();

    return await cache.promise;
}

window.getCategoriasCache = getCategoriasCache;
window.loadCache = loadCache;
window.saveCache = saveCache;
window.categoriasGastos = [];
window.categoriasIngresos = [];