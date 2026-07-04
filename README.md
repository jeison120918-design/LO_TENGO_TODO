# 💄 Lo Tengo Todo Boutique — PWA de Punto de Venta (POS)

PWA instalable en iPhone para gestionar ventas, inventario y reportes de **Lo Tengo Todo Boutique** (Ropa · Accesorios · Pestañas · Lencería).

- ✅ 100% local — sin servidor externo, sin costos mensuales
- ✅ Funciona sin internet (offline-first con Service Worker + IndexedDB)
- ✅ Instalable en la pantalla de inicio del iPhone
- ✅ Genera facturas en PDF con el diseño de la marca
- ✅ Comparte facturas por WhatsApp
- ✅ Diseño femenino premium: dorado, vinotinto y negro

---

## 📁 Estructura del proyecto

```
lo-tengo-todo-pos/
├── index.html          # App principal (pantallas y modales)
├── manifest.json        # Configuración de la PWA
├── service-worker.js    # Cache offline
├── css/
│   └── style.css        # Estilos con la identidad de marca
├── js/
│   ├── db.js             # Base de datos local (IndexedDB)
│   ├── app.js             # Lógica de la app (ventas, inventario, reportes)
│   └── pdf-lib.js         # Librería jsPDF (incluida localmente, funciona offline)
├── icons/                # Íconos generados desde el logo, en todos los tamaños para iOS
└── README.md
```

> **Nota sobre la arquitectura:** esta versión usa **IndexedDB en el navegador** en lugar de un backend Node/Express + SQLite. Para una PWA instalable en iPhone que debe funcionar 100% offline, esta es la arquitectura recomendada: no depende de tener un servidor corriendo, y todos los datos (productos, ventas, configuración) quedan guardados directamente en el iPhone. Si en el futuro necesitas sincronizar entre varios dispositivos o tener la información en la nube, se puede agregar un backend después sin rehacer la app.

---

## 🚀 Cómo instalarla en tu iPhone

Un iPhone **no puede instalar una PWA desde una carpeta local** — Safari exige que la app se sirva por **HTTPS**. La forma más rápida y gratuita es GitHub Pages:

### Opción A — GitHub Pages (recomendado, gratis)

1. Crea un repositorio nuevo en GitHub (puede ser privado o público).
2. Sube todos los archivos de esta carpeta (`lo-tengo-todo-pos/`) a la raíz del repositorio.
3. Ve a **Settings → Pages** en tu repositorio.
4. En "Branch", selecciona `main` y carpeta `/ (root)`. Guarda.
5. Espera 1–2 minutos. GitHub te dará una URL como:
   `https://tu-usuario.github.io/tu-repositorio/`
6. Abre esa URL **desde Safari en tu iPhone**.
7. Toca el botón de **Compartir** (el cuadrado con la flecha hacia arriba).
8. Selecciona **"Agregar a pantalla de inicio"**.
9. ¡Listo! El ícono de Lo Tengo Todo aparecerá en tu pantalla de inicio como una app nativa.

### Opción B — Netlify / Vercel (también gratis)

1. Arrastra la carpeta del proyecto a [app.netlify.com/drop](https://app.netlify.com/drop) (no requiere cuenta para probar).
2. Copia la URL que te generan.
3. Ábrela en Safari en tu iPhone y sigue los pasos 7–9 de arriba.

---

## 🧭 Uso de la app

### 🏠 Inicio
Panel con ventas del día, ganancia del día, alertas de bajo stock, productos más vendidos y últimas ventas.

### 🛒 Ventas
1. Filtra por categoría (Zapatos, Bolsos, Pestañas, Vestidos, etc.)
2. Toca "+ Agregar" en cada producto para sumarlo al carrito.
3. Toca "Ver Carrito" para ajustar cantidades.
4. Ingresa el nombre y teléfono del cliente (opcional, pero necesario para enviar la factura por WhatsApp directo a su número).
5. Elige el método de pago: Efectivo o Transferencia.
6. Toca "Completar Venta" — el inventario se descuenta automáticamente.
7. Descarga la factura en PDF y/o compártela por WhatsApp.

> **Importante sobre WhatsApp:** por una limitación de Apple/WhatsApp, el enlace `wa.me` solo puede abrir un chat con un **mensaje de texto prellenado** — no puede adjuntar el PDF automáticamente. La app descarga el PDF y abre WhatsApp con el mensaje listo; solo debes adjuntar el PDF manualmente desde tus archivos/descargas dentro del chat (toma 2 toques extra).

### 📦 Inventario
- Agrega productos con nombre, categoría, precio de venta, costo, stock y alerta de bajo stock.
- Toca el ícono ✎ sobre cualquier producto para editarlo o eliminarlo.

### 📊 Reportes
- Ventas totales y ganancia total acumulada.
- Ranking de productos más vendidos.
- Historial completo de ventas.

### ⚙️ Ajustes
- Configura el nombre del negocio y el teléfono de WhatsApp (aparece en las facturas).
- **Exporta un respaldo** (.json) periódicamente — cópialo a tu computadora o Nube por seguridad.
- Importa un respaldo si cambias de teléfono o reinstalas la app.
- Opción de borrar todos los datos (con confirmación).

---

## 🔒 Privacidad y datos

Todos los datos (productos, ventas, clientes) se guardan **únicamente en tu iPhone**, usando IndexedDB. Nada se envía a internet, excepto el mensaje de WhatsApp que tú decides enviar. Si borras la app o los datos de Safari, se perderá la información — por eso se recomienda exportar respaldos regularmente desde Ajustes.

---

## 🛠️ Personalización futura

- Los colores de marca están centralizados como variables CSS en `css/style.css` (`--gold`, `--wine`, `--black`).
- Las categorías de productos (con sus emojis) están definidas en `js/app.js` en el objeto `CATEGORIES`.
- El logo usado para los íconos está en `icons/`. Si cambias el logo, vuelve a generar los tamaños: 16, 32, 64, 72, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512 y la versión "maskable" de 512.

---

**Lo Tengo Todo Boutique** · Ropa · Accesorios · Pestañas · Lencería 💖
