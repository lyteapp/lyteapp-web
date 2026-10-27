// The dashboard's guided tours: the general one (the menu) and one per
// section, each shown the first time that section is opened. A step points
// at a CSS selector; steps whose element isn't on screen (an empty list, a
// phone-only button) are skipped. `only` keeps a step to one layout and
// `phoneText` rewords it for phones, where the menu lives behind ☰ and
// things are tapped, not clicked.

export type TourStep = {
  sel?: string
  title: string
  text: string
  phoneText?: string
  only?: 'phone' | 'desktop'
  /** Phone: the ☰ menu drawer must be open / closed for this step */
  menu?: 'open' | 'closed'
}

export type Tour = { id: string; match: (path: string) => boolean; steps: TourStep[] }

const nav = (k: string) => `[data-tour="${k}"]`

export const TOURS: Tour[] = [
  {
    id: 'intro', match: p => p === '/dashboard',
    steps: [
      { title: 'Bienvenido a Lyte', text: 'Te mostramos en menos de un minuto dónde está todo. Puedes saltar el tutorial cuando quieras.', menu: 'closed' },
      { sel: nav('menu'), only: 'phone', menu: 'closed', title: 'Tu menú', text: 'Todas las secciones están aquí. Tócalo cuando quieras ir a otra parte. Te las mostramos.' },
      { sel: nav('store'), menu: 'open', title: 'Tu tienda', text: 'Aquí ves la tienda que estás manejando. Haz clic para cambiar entre tus tiendas o crear una nueva.', phoneText: 'La tienda que estás manejando. Tócala para cambiar entre tus tiendas o crear una nueva.' },
      { sel: nav('orders'), menu: 'open', title: 'Pedidos', text: 'Cada pedido nuevo llega aquí al instante, con un sonido para que no se te escape ninguno.' },
      { sel: nav('caja'), menu: 'open', title: 'Caja', text: 'Revisa los pagos del día y lleva el cuadre de tu caja.' },
      { sel: nav('delivery'), menu: 'open', title: 'Delivery', text: 'Asigna repartidores, sigue las entregas en el mapa en vivo y define tus zonas y tarifas.' },
      { sel: nav('products'), menu: 'open', title: 'Productos', text: 'Crea tus productos con fotos, variables (sabores, tamaños) y extras, y ordénalos por categorías.' },
      { sel: nav('inventario'), menu: 'open', title: 'Inventario', text: 'Controla almacenes, compras e ingredientes. Cada venta descuenta sola de tu almacén.' },
      { sel: nav('finanzas'), menu: 'open', title: 'Finanzas', text: 'Tus cuentas, ingresos y gastos en un solo lugar.' },
      { sel: nav('design'), menu: 'open', title: 'Diseño', text: 'Personaliza cómo se ve tu tienda: vitrina, página de inicio, checkout y rastreo del pedido.' },
      { sel: nav('analytics'), menu: 'open', title: 'Analíticas', text: 'Mira cuánto vendes, tus productos estrella y cómo crece tu negocio.' },
      { sel: nav('assistant'), menu: 'closed', title: 'Asistente', text: '¿Tienes dudas? Pregúntale al asistente cómo hacer cualquier cosa en Lyte.', phoneText: '¿Dudas? Toca aquí y pregúntale al asistente cómo hacer cualquier cosa.' },
      { title: 'Todo listo', text: 'Ya conoces lo básico. Cada sección te muestra su propio tutorial la primera vez que la abras.', menu: 'closed' },
    ],
  },
  {
    id: 'home', match: p => p === '/dashboard',
    steps: [
      { sel: '.dh-cta', title: 'Tu tienda en línea', text: 'Abre tu tienda como la ven tus clientes, o copia su enlace para compartirlo por WhatsApp o redes.' },
      { sel: '.dh-kpi-grid', title: 'El resumen de hoy', text: 'Ventas, pedidos y ticket promedio del día, actualizados en vivo.' },
      { sel: '.dh-grid', title: 'Tiempos y delivery', text: 'Cuánto tardan tus pedidos en prepararse y entregarse hoy.' },
      { sel: '.dh-bottom-grid', title: 'Lo que más se vende', text: 'Tus productos estrella y la actividad reciente de la tienda.' },
    ],
  },
  {
    id: 'orders', match: p => p.startsWith('/dashboard/pedidos'),
    steps: [
      { title: 'Pedidos', text: 'Aquí llegan todos los pedidos de tu tienda, en tiempo real. Te mostramos cómo manejarlos.' },
      { sel: '.pd-filters', title: 'Filtra por estado', text: 'Mira solo los pendientes, en preparación, listos o entregados.' },
      { sel: '.pd-list .pd-card', title: 'Cada pedido', text: 'Haz clic en un pedido para ver sus productos, el pago y la dirección, y cambiar su estado.', phoneText: 'Toca un pedido para ver sus productos, el pago y la dirección, y cambiar su estado.' },
      { sel: '.pd-display-btn', title: 'Pantalla de cocina', text: 'Abre la vista de comandas para la cocina, con el tiempo de cada pedido a la vista.' },
      { sel: '[title="Ajustes de tiempos"]', title: 'Tiempos', text: 'Define en cuántos minutos un pedido pasa a "demorado" para que nada se quede atrás.' },
    ],
  },
  {
    id: 'caja', match: p => p.startsWith('/dashboard/caja'),
    steps: [
      { title: 'Caja', text: 'Revisa todos los pagos recibidos por día y cuadra tu caja.' },
      { sel: '.cx-calendar', title: 'Elige el día', text: 'Toca un día del calendario para ver sus pagos.', only: 'desktop' },
      { sel: '.cx-day-totals', title: 'Totales por método', text: 'Cuánto entró por cada método de pago: Pago Móvil, Zelle, efectivo y los demás.' },
      { sel: '.cx-pay-list', title: 'Cada pago', text: 'El detalle de cada pago, con su comprobante y quién lo verificó.' },
      { sel: '.cx-settings-btn', title: 'Ajustes de caja', text: 'Crea el enlace de acceso para tus cajeras y administra quién puede verificar pagos.' },
    ],
  },
  {
    id: 'delivery', match: p => p.startsWith('/dashboard/delivery'),
    steps: [
      { title: 'Delivery', text: 'Todo lo de tus entregas en un solo lugar. Te mostramos las partes.' },
      { sel: '.dv-tabs', title: 'Las secciones', text: 'En vivo, Hoy, Repartidores, Zonas, Liquidaciones y Ajustes. Cambia entre ellas desde aquí.' },
      { sel: '.dv-map-mobile-btn', only: 'phone', title: 'El mapa en vivo', text: 'Toca aquí para ver en pantalla completa dónde va cada repartidor.' },
      { sel: '.dv-tab-settings', title: 'Ajustes', text: 'Tarifa del delivery, comisión de la tienda y cierre diario de lo acumulado.' },
    ],
  },
  {
    id: 'products', match: p => p === '/dashboard/productos',
    steps: [
      { title: 'Productos', text: 'Aquí creas y ordenas todo lo que vendes.' },
      { sel: '.pr-add-btn', title: 'Nuevo producto', text: 'Crea un producto con fotos o video, precio, variables (sabores, tamaños), extras y valor nutricional.' },
      { sel: '.pr-search', title: 'Busca rápido', text: 'Escribe para encontrar cualquier producto al instante.' },
      { sel: '.pr-list', title: 'Tu lista', text: 'Toca un producto para editarlo, o actívalo y desactívalo sin borrarlo.' },
    ],
  },
  {
    id: 'categories', match: p => p.startsWith('/dashboard/productos/categorias'),
    steps: [
      { sel: '.pr-add-btn', title: 'Categorías', text: 'Agrupa tus productos para que tus clientes encuentren todo fácil. Crea una nueva desde aquí.' },
      { sel: '.cat-list', title: 'Orden y productos', text: 'Cambia el orden con las flechas, y abre una categoría para ordenar sus productos arrastrándolos.' },
    ],
  },
  {
    id: 'inventario', match: p => p.startsWith('/dashboard/inventario'),
    steps: [
      { title: 'Inventario', text: 'Lleva el control de lo que tienes en cada almacén.' },
      { sel: '.inv-wh-grid', title: 'Tus almacenes', text: 'Primero elige el almacén con el que vas a trabajar. Las ventas descuentan del almacén principal.' },
      { sel: '.inv-tabs', title: 'Las secciones', text: 'Artículos, compras con foto de factura, proveedores, productos y recetas, y el kardex de movimientos.' },
      { sel: '.inv-toolbar', title: 'Crea y registra', text: 'Agrega artículos y registra entradas o salidas de inventario.' },
    ],
  },
  {
    id: 'clientes', match: p => p.startsWith('/dashboard/clientes'),
    steps: [
      { title: 'Clientes', text: 'Todas las personas que te han comprado, con lo que gastaron y cuándo.' },
      { sel: '.cl-search', title: 'Busca', text: 'Encuentra a un cliente por su nombre o teléfono.' },
      { sel: '.cl-sort', title: 'Ordena', text: 'Por el más reciente, el que más gasta o el que más pedidos hace.' },
      { sel: '.cl-row', title: 'Cada cliente', text: 'Ábrelo para ver su historial de pedidos y escribirle por WhatsApp.' },
    ],
  },
  {
    id: 'analytics', match: p => p.startsWith('/dashboard/analitics'),
    steps: [
      { title: 'Analíticas', text: 'Cómo va tu negocio, en números.' },
      { sel: '.an-presets', title: 'El periodo', text: 'Hoy, la semana, el mes o las fechas que quieras.' },
      { sel: '.an-kpi-row', title: 'Lo importante', text: 'Total facturado, pedidos y ticket promedio del periodo.' },
      { sel: '.an-chart-wrap', title: 'La tendencia', text: 'Tus ventas día a día para ver cuándo vendes más.' },
    ],
  },
  {
    id: 'settings', match: p => p.startsWith('/dashboard/configuracion'),
    steps: [
      { title: 'Ajustes', text: 'La información general de tu tienda, el horario, el tema del dashboard y más.' },
      { sel: '.cf-section-header', title: 'Cada sección', text: 'Ábrela para cambiar sus datos. Cada una se guarda por separado.' },
    ],
  },
  {
    id: 'vitrina', match: p => p.startsWith('/dashboard/canal/vitrina'),
    steps: [
      { title: 'Editor de la vitrina', text: 'Diseña cómo se ve tu tienda. Los cambios se ven al momento en la vista previa.' },
      { sel: '.ed-device', title: 'La vista previa', text: 'Así se ve tu tienda. Puedes tocar y navegar en ella como un cliente.' },
      { sel: '.ed-device-switch', title: 'Teléfono, tablet o computadora', text: 'Mira tu tienda en cada pantalla. Los tamaños se pueden ajustar por separado en cada una.' },
      { sel: '.ed-side-bar', title: 'Las herramientas', text: 'Colores, letras, fotos, precios, encabezado, categorías, bloques, producto y anuncios.', phoneText: 'Colores, letras, fotos, precios y más. Desliza la barra para ver todas las herramientas.' },
      { title: 'Guardar', text: 'Cuando cambies algo, aparece un aviso para guardar o cancelar. Nada se publica hasta que guardes.' },
    ],
  },
  {
    id: 'inicio', match: p => p.startsWith('/dashboard/canal/inicio'),
    steps: [
      { title: 'Página de inicio', text: 'La pantalla de bienvenida que ven tus clientes antes de entrar a la tienda.' },
      { sel: '.cn-inicio-preview-col', only: 'desktop', title: 'La vista previa', text: 'Haz clic en un elemento y arrastra su esquina para cambiarle el tamaño.' },
      { sel: '.cn-sidebar', only: 'desktop', title: 'Los ajustes', text: 'Activa la página, elige qué datos pedir al cliente, el fondo, las fotos y la transición.' },
      { sel: '.cn-co-stage', only: 'phone', title: 'La vista previa', text: 'Toca un elemento y arrastra su esquina para cambiarle el tamaño.' },
      { sel: '.cn-co-bar', only: 'phone', title: 'Las secciones', text: 'Cada ícono abre una parte de la configuración. Con las flechas pasas de una a otra.' },
    ],
  },
  {
    id: 'checkout', match: p => p.startsWith('/dashboard/canal/checkout'),
    steps: [
      { title: 'Checkout', text: 'Configura cómo compran tus clientes: pagos, datos que pides y tipo de entrega.' },
      { sel: '.cn-checkout-preview-col', only: 'desktop', title: 'La vista previa', text: 'El checkout real de tu tienda. Se actualiza al guardar.' },
      { sel: '.cn-section[data-sec="0"]', only: 'desktop', title: 'Métodos de pago', text: 'Activa los métodos que aceptas y agrega tus datos para que el cliente sepa a dónde pagar.' },
      { sel: '.cn-co-stage', only: 'phone', title: 'La vista previa', text: 'El checkout real de tu tienda. Se actualiza al guardar.' },
      { sel: '.cn-co-bar', only: 'phone', title: 'Las secciones', text: 'Pagos, campos, entrega, reglas, numeración, colores y WhatsApp. Cada ícono abre una.' },
    ],
  },
  {
    id: 'tracking', match: p => p.startsWith('/dashboard/canal/apariencia'),
    steps: [
      { title: 'Rastreo del pedido', text: 'La página donde tus clientes siguen su pedido en vivo. Personalízala aquí.' },
      { sel: '[data-tsec="mode"]', only: 'desktop', title: 'El estilo', text: 'Por estatus, con el mapa en vivo, o la pantalla de turnos.' },
      { sel: '.cn-co-stage', only: 'phone', title: 'La vista previa', text: 'Así lo ve tu cliente. Cambia al momento mientras editas.' },
      { sel: '.cn-co-bar', only: 'phone', title: 'Las secciones', text: 'Estilo, mapa, colores, puntos, letras, textos de cada estatus y más.' },
    ],
  },
]

export function stepsFor(tour: Tour, phone: boolean): TourStep[] {
  return tour.steps
    .filter(s => !s.only || (s.only === 'phone') === phone)
    .map(s => (phone && s.phoneText ? { ...s, text: s.phoneText } : s))
}
