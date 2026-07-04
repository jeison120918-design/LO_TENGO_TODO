// app.js — Lógica principal de Lo Tengo Todo Boutique POS

const CATEGORIES = {
  zapatos:    { label: 'Zapatos',    emoji: '👠' },
  bolsos:     { label: 'Bolsos',     emoji: '👜' },
  pestanas:   { label: 'Pestañas',   emoji: '👁️' },
  vestidos:   { label: 'Vestidos',   emoji: '👗' },
  ropa:       { label: 'Ropa',       emoji: '👚' },
  accesorios: { label: 'Accesorios', emoji: '💍' },
  lenceria:   { label: 'Lencería',   emoji: '🩱' },
  otro:       { label: 'Otro',       emoji: '✨' }
};

let state = {
  products: [],
  sales: [],
  cart: [],            // [{productId, name, price, qty, cost}]
  saleFilterCat: 'all',
  invFilterCat: 'all',
  selectedPayment: 'Efectivo',
  businessName: 'Lo Tengo Todo Boutique',
  businessPhone: '',
  lastSaleForInvoice: null
};

function fmtMoney(n) {
  const v = Number(n) || 0;
  return 'RD$' + v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ---------------- NAVIGATION ----------------
const SCREEN_TITLES = {
  inicio: ['Inicio', ''],
  ventas: ['Nueva Venta', 'Selecciona productos'],
  inventario: ['Inventario', 'Gestiona tus productos'],
  reportes: ['Reportes', 'Analiza tu negocio'],
  config: ['Ajustes', 'Configuración general']
};

function goToScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  document.getElementById('screen-' + name).classList.remove('hidden');
  document.querySelectorAll('.tab-item').forEach((el) => el.classList.toggle('active', el.dataset.screen === name));
  const [title, subtitle] = SCREEN_TITLES[name];
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-subtitle').textContent = subtitle || state.businessName;

  const cartBar = document.getElementById('cart-bar');
  if (name === 'ventas' && state.cart.length > 0) cartBar.classList.remove('hidden');
  else cartBar.classList.add('hidden');

  if (name === 'inicio') renderDashboard();
  if (name === 'ventas') renderSaleGrid();
  if (name === 'inventario') renderInventory();
  if (name === 'reportes') renderReports();
  if (name === 'config') renderConfigScreen();
}

document.querySelectorAll('.tab-item').forEach((tab) => {
  tab.addEventListener('click', () => goToScreen(tab.dataset.screen));
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// ---------------- DATA LOADING ----------------
async function reloadData() {
  state.products = await DB.getAllProducts();
  state.sales = await DB.getAllSales();
}

async function loadConfig() {
  state.businessName = await DB.getConfig('businessName', 'Lo Tengo Todo Boutique');
  state.businessPhone = await DB.getConfig('businessPhone', '');
  state.autoBackupEnabled = await DB.getConfig('autoBackupEnabled', true);
}

// ==================================================================
// DASHBOARD
// ==================================================================
function renderDashboard() {
  const today = todayStr();
  const salesToday = state.sales.filter((s) => s.date.slice(0, 10) === today);
  const totalToday = salesToday.reduce((a, s) => a + s.total, 0);
  const profitToday = salesToday.reduce((a, s) => a + s.profit, 0);

  document.getElementById('d-ventas-hoy').textContent = fmtMoney(totalToday);
  document.getElementById('d-ganancia-hoy').textContent = fmtMoney(profitToday);
  document.getElementById('d-total-productos').textContent = state.products.length;

  // Low stock alert
  const lowStock = state.products.filter((p) => p.stock <= (p.minStock ?? 5));
  const alertEl = document.getElementById('low-stock-alert');
  if (lowStock.length > 0) {
    alertEl.innerHTML = `<div class="low-stock-banner">⚠️ ${lowStock.length} producto(s) con bajo stock: ${lowStock.slice(0, 3).map(p => p.name).join(', ')}${lowStock.length > 3 ? '…' : ''}</div>`;
  } else {
    alertEl.innerHTML = '';
  }

  // Top products (all-time by qty sold)
  const qtyByProduct = {};
  state.sales.forEach((s) => s.items.forEach((it) => {
    qtyByProduct[it.name] = (qtyByProduct[it.name] || 0) + it.qty;
  }));
  const top = Object.entries(qtyByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCard = document.getElementById('top-products-card');
  if (top.length === 0) {
    topCard.innerHTML = '<div class="empty-state"><div class="eicon">🛍️</div>Aún no hay ventas registradas</div>';
  } else {
    topCard.innerHTML = top.map(([name, qty], i) =>
      `<div class="sale-row"><div class="sinfo"><b>${i + 1}. ${name}</b></div><div class="stotal">${qty} vendidos</div></div>`
    ).join('');
  }

  // Recent sales
  const recentCard = document.getElementById('recent-sales-card');
  const recent = [...state.sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recent.length === 0) {
    recentCard.innerHTML = '<div class="empty-state"><div class="eicon">🧾</div>Sin ventas recientes</div>';
  } else {
    recentCard.innerHTML = recent.map((s) => `
      <div class="sale-row">
        <div class="sinfo"><b>${s.clientName || 'Cliente'}</b><div class="sdate">${new Date(s.date).toLocaleString('es-DO')}</div></div>
        <div class="stotal">${fmtMoney(s.total)}</div>
      </div>`).join('');
  }
}

// ==================================================================
// VENTAS (SALE SCREEN)
// ==================================================================
function renderCategoryFilter(containerId, activeCat, onSelect) {
  const el = document.getElementById(containerId);
  const cats = [{ key: 'all', label: 'Todos', emoji: '🗂️' }, ...Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, ...v }))];
  el.innerHTML = cats.map((c) =>
    `<div class="chip ${c.key === activeCat ? 'active' : ''}" data-cat="${c.key}">${c.emoji} ${c.label}</div>`
  ).join('');
  el.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => onSelect(chip.dataset.cat));
  });
}

function renderSaleGrid() {
  renderCategoryFilter('category-filter', state.saleFilterCat, (cat) => {
    state.saleFilterCat = cat;
    renderSaleGrid();
  });

  const grid = document.getElementById('sale-product-grid');
  const filtered = state.products.filter((p) => state.saleFilterCat === 'all' || p.category === state.saleFilterCat);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="eicon">📦</div>No hay productos en esta categoría.<br>Agrégalos desde Inventario.</div>';
    return;
  }

  grid.innerHTML = filtered.map((p) => {
    const cat = CATEGORIES[p.category] || CATEGORIES.otro;
    const lowClass = p.stock <= (p.minStock ?? 5) ? 'low' : '';
    const disabled = p.stock <= 0 ? 'disabled' : '';
    return `
    <div class="product-card">
      <div class="emoji">${cat.emoji}</div>
      <div class="pname">${p.name}</div>
      <div class="pprice">${fmtMoney(p.price)}</div>
      <div class="pstock ${lowClass}">${p.stock > 0 ? p.stock + ' en stock' : 'Agotado'}</div>
      <button class="add-btn" data-id="${p.id}" ${disabled} style="${p.stock <= 0 ? 'opacity:.4;' : ''}">${p.stock <= 0 ? 'Sin stock' : '+ Agregar'}</button>
    </div>`;
  }).join('');

  grid.querySelectorAll('.add-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.id)));
  });

  updateCartBar();
}

function addToCart(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const existing = state.cart.find((c) => c.productId === productId);
  const currentQtyInCart = existing ? existing.qty : 0;
  if (currentQtyInCart + 1 > product.stock) {
    showToast('⚠️ No hay más stock disponible de este producto');
    return;
  }
  if (existing) existing.qty += 1;
  else state.cart.push({ productId, name: product.name, price: product.price, cost: product.cost || 0, qty: 1 });
  showToast(`✔️ ${product.name} agregado`);
  updateCartBar();
}

function cartTotal() {
  return state.cart.reduce((a, c) => a + c.price * c.qty, 0);
}

function updateCartBar() {
  const bar = document.getElementById('cart-bar');
  const count = state.cart.reduce((a, c) => a + c.qty, 0);
  if (count === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('cart-count').textContent = `${count} producto${count !== 1 ? 's' : ''}`;
  document.getElementById('cart-total').textContent = fmtMoney(cartTotal());
}

document.getElementById('btn-open-cart').addEventListener('click', renderCartModal);

function renderCartModal() {
  const linesEl = document.getElementById('cart-lines');
  if (state.cart.length === 0) {
    linesEl.innerHTML = '<div class="empty-state"><div class="eicon">🛒</div>Tu carrito está vacío</div>';
  } else {
    linesEl.innerHTML = state.cart.map((c, idx) => `
      <div class="cart-line">
        <div>
          <div class="cname">${c.name}</div>
          <div class="cmeta">${fmtMoney(c.price)} c/u</div>
        </div>
        <div class="qty-control">
          <button data-act="dec" data-idx="${idx}">−</button>
          <span>${c.qty}</span>
          <button data-act="inc" data-idx="${idx}">+</button>
        </div>
      </div>`).join('');

    linesEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const line = state.cart[idx];
        const product = state.products.find((p) => p.id === line.productId);
        if (btn.dataset.act === 'inc') {
          if (line.qty + 1 > product.stock) { showToast('⚠️ Stock insuficiente'); return; }
          line.qty += 1;
        } else {
          line.qty -= 1;
          if (line.qty <= 0) state.cart.splice(idx, 1);
        }
        renderCartModal();
        updateCartBar();
      });
    });
  }
  document.getElementById('cart-modal-total').textContent = fmtMoney(cartTotal());
  openModal('modal-cart');
}

document.querySelectorAll('.pay-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.pay-option').forEach((o) => o.classList.remove('selected'));
    opt.classList.add('selected');
    state.selectedPayment = opt.dataset.pay;
  });
});

document.getElementById('btn-complete-sale').addEventListener('click', completeSale);

async function completeSale() {
  if (state.cart.length === 0) { showToast('Agrega productos antes de vender'); return; }

  const clientName = document.getElementById('sale-client-name').value.trim() || 'Cliente';
  const clientPhone = document.getElementById('sale-client-phone').value.trim();
  const total = cartTotal();
  const profit = state.cart.reduce((a, c) => a + (c.price - (c.cost || 0)) * c.qty, 0);

  const sale = {
    date: new Date().toISOString(),
    items: state.cart.map((c) => ({ name: c.name, price: c.price, qty: c.qty })),
    total, profit,
    payment: state.selectedPayment,
    clientName, clientPhone
  };

  const saleId = await DB.addSale(sale);
  sale.id = saleId;

  // Descontar stock
  for (const c of state.cart) {
    const product = state.products.find((p) => p.id === c.productId);
    if (product) {
      product.stock = Math.max(0, product.stock - c.qty);
      await DB.updateProduct(product);
    }
  }

  state.lastSaleForInvoice = sale;
  state.cart = [];
  await reloadData();

  closeModal('modal-cart');
  document.getElementById('success-total-text').textContent = `Total: ${fmtMoney(total)}`;
  openModal('modal-success');

  updateCartBar();
  renderSaleGrid();
}

// ==================================================================
// FACTURA PDF + WHATSAPP
// ==================================================================
function drawPDFHeader(doc, wineRGB, goldRGB, subtitleLines) {
  // Fondo del encabezado
  const headerHeight = 8 + subtitleLines.length * 6 + 26;
  doc.setFillColor(...wineRGB);
  doc.rect(0, 0, 210, headerHeight, 'F');

  // Logo circular real de la marca
  try {
    if (typeof LOGO_BASE64 !== 'undefined') {
      doc.addImage(LOGO_BASE64, 'PNG', 14, 8, 24, 24);
    }
  } catch (e) { /* si falla el logo, seguimos sin romper la factura */ }

  doc.setTextColor(...goldRGB);
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.text(state.businessName || 'Lo Tengo Todo Boutique', 105, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  let sy = 25;
  subtitleLines.forEach((line) => {
    doc.text(line, 105, sy, { align: 'center' });
    sy += 6;
  });

  // Franja dorada decorativa inferior del header
  doc.setFillColor(...goldRGB);
  doc.rect(0, headerHeight - 1.5, 210, 1.5, 'F');

  return headerHeight;
}

function drawPDFFooter(doc, wineRGB) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('¡Gracias por elegirnos! Lo Tengo Todo Boutique', 105, pageH - 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('Ropa · Accesorios · Pestañas · Lencería', 105, pageH - 11, { align: 'center' });
}

function generateInvoicePDF(sale) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const wineRGB = [90, 15, 46];
  const goldRGB = [212, 175, 55];
  const creamRGB = [250, 245, 235];

  const subtitle = ['Boutique de Moda y Belleza'];
  if (state.businessPhone) subtitle.push('WhatsApp: ' + state.businessPhone);
  const headerHeight = drawPDFHeader(doc, wineRGB, goldRGB, subtitle);

  // Meta de la factura, en recuadro limpio
  let y = headerHeight + 12;
  doc.setDrawColor(...goldRGB);
  doc.setFillColor(...creamRGB);
  doc.roundedRect(14, y - 7, 182, 26, 2, 2, 'FD');

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Factura #${String(sale.id).padStart(5, '0')}`, 20, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date(sale.date).toLocaleString('es-DO')}`, 20, y + 7);
  doc.text(`Cliente: ${sale.clientName || 'Cliente'}`, 20, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...wineRGB);
  doc.text(`Método de pago: ${sale.payment}`, 130, y + 14, { maxWidth: 62 });

  y += 30;

  // Encabezado de la tabla
  doc.setFillColor(...wineRGB);
  doc.rect(14, y - 6, 182, 9, 'F');
  doc.setTextColor(...goldRGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Producto', 18, y);
  doc.text('Cant.', 128, y, { align: 'center' });
  doc.text('Precio', 155, y, { align: 'center' });
  doc.text('Subtotal', 190, y, { align: 'right' });

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const pageBottomLimit = 250;

  sale.items.forEach((it, i) => {
    // Salto de página si se acumulan muchos productos
    if (y > pageBottomLimit) {
      drawPDFFooter(doc, wineRGB);
      doc.addPage();
      y = 20;
      doc.setFillColor(...wineRGB);
      doc.rect(14, y - 6, 182, 9, 'F');
      doc.setTextColor(...goldRGB);
      doc.setFont('helvetica', 'bold');
      doc.text('Producto', 18, y);
      doc.text('Cant.', 128, y, { align: 'center' });
      doc.text('Precio', 155, y, { align: 'center' });
      doc.text('Subtotal', 190, y, { align: 'right' });
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
    }
    if (i % 2 === 0) { doc.setFillColor(...creamRGB); doc.rect(14, y - 6, 182, 8, 'F'); }
    doc.setTextColor(30, 30, 30);
    doc.text(String(it.name).slice(0, 40), 18, y);
    doc.text(String(it.qty), 128, y, { align: 'center' });
    doc.text(fmtMoney(it.price), 155, y, { align: 'center' });
    doc.text(fmtMoney(it.price * it.qty), 190, y, { align: 'right' });
    y += 8;
  });

  y += 6;
  doc.setDrawColor(...goldRGB);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
  y += 11;

  // Caja de total destacada
  doc.setFillColor(...wineRGB);
  doc.roundedRect(120, y - 8, 76, 14, 2, 2, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...goldRGB);
  doc.text(`TOTAL: ${fmtMoney(sale.total)}`, 193, y, { align: 'right' });

  drawPDFFooter(doc, wineRGB);
  return doc;
}

document.getElementById('btn-download-pdf').addEventListener('click', () => {
  if (!state.lastSaleForInvoice) return;
  const doc = generateInvoicePDF(state.lastSaleForInvoice);
  doc.save(`Factura_${state.lastSaleForInvoice.id}.pdf`);
});

function buildWhatsappMessage(sale) {
  const itemsList = sale.items
    .map((it) => `🎀 ${it.qty}x ${it.name}\n     💲 ${fmtMoney(it.price)} c/u  →  ${fmtMoney(it.price * it.qty)}`)
    .join('\n');

  const payEmoji = sale.payment === 'Efectivo' ? '💵' : '🏦';

  return (
`💖✨ *${state.businessName || 'Lo Tengo Todo Boutique'}* ✨💖
👗 Ropa · 👜 Accesorios · 👁️ Pestañas · 🩱 Lencería

Hola ${sale.clientName || 'preciosa'} 🌸, ¡gracias por tu compra! 💕

🧾 *Factura #${String(sale.id).padStart(5, '0')}*
📅 ${new Date(sale.date).toLocaleString('es-DO')}

🛍️ *Detalle de tu compra:*
${itemsList}

━━━━━━━━━━━━━━━
💰 *TOTAL: ${fmtMoney(sale.total)}*
${payEmoji} Método de pago: ${sale.payment}
━━━━━━━━━━━━━━━

📎 Te adjuntamos tu factura en PDF en este chat 💌
🚚 ¡Esperamos que la disfrutes muchísimo! 💃

Con cariño,
💄 Equipo ${state.businessName || 'Lo Tengo Todo Boutique'} 🎀`
  );
}

document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
  const sale = state.lastSaleForInvoice;
  if (!sale) return;
  const message = buildWhatsappMessage(sale);
  const phone = (sale.clientPhone || '').replace(/[^0-9]/g, '');
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  showToast('📎 No olvides adjuntar el PDF descargado en el chat de WhatsApp');
});

// ==================================================================
// INVENTARIO
// ==================================================================
function renderInventory() {
  renderCategoryFilter('inv-category-filter', state.invFilterCat, (cat) => {
    state.invFilterCat = cat;
    renderInventory();
  });

  const grid = document.getElementById('inventory-grid');
  const filtered = state.products.filter((p) => state.invFilterCat === 'all' || p.category === state.invFilterCat);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="eicon">📦</div>No hay productos aún.<br>Toca "Agregar Producto" para empezar.</div>';
    return;
  }

  grid.innerHTML = filtered.map((p) => {
    const cat = CATEGORIES[p.category] || CATEGORIES.otro;
    const lowClass = p.stock <= (p.minStock ?? 5) ? 'low' : '';
    return `
    <div class="product-card">
      <div class="edit-dot" data-id="${p.id}">✎</div>
      <div class="emoji">${cat.emoji}</div>
      <div class="pname">${p.name}</div>
      <div class="pprice">${fmtMoney(p.price)}</div>
      <div class="pstock ${lowClass}">${p.stock} en stock</div>
      <div class="badge-cat">${cat.label}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.edit-dot').forEach((dot) => {
    dot.addEventListener('click', () => openProductModal(Number(dot.dataset.id)));
  });
}

function openProductModal(productId = null) {
  const isEdit = productId !== null;
  document.getElementById('product-modal-title').textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('btn-delete-product').classList.toggle('hidden', !isEdit);

  if (isEdit) {
    const p = state.products.find((x) => x.id === productId);
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-category').value = p.category;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-cost').value = p.cost || '';
    document.getElementById('p-stock').value = p.stock;
    document.getElementById('p-min-stock').value = p.minStock ?? 5;
  } else {
    document.getElementById('p-id').value = '';
    document.getElementById('p-name').value = '';
    document.getElementById('p-category').value = 'zapatos';
    document.getElementById('p-price').value = '';
    document.getElementById('p-cost').value = '';
    document.getElementById('p-stock').value = '';
    document.getElementById('p-min-stock').value = 5;
  }
  openModal('modal-product');
}

document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());

document.getElementById('btn-save-product').addEventListener('click', async () => {
  const id = document.getElementById('p-id').value;
  const name = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value;
  const price = parseFloat(document.getElementById('p-price').value) || 0;
  const cost = parseFloat(document.getElementById('p-cost').value) || 0;
  const stock = parseInt(document.getElementById('p-stock').value) || 0;
  const minStock = parseInt(document.getElementById('p-min-stock').value) || 5;

  if (!name || price <= 0) { showToast('Completa nombre y precio válidos'); return; }

  const product = { name, category, price, cost, stock, minStock };
  if (id) {
    product.id = Number(id);
    await DB.updateProduct(product);
    showToast('✔️ Producto actualizado');
  } else {
    await DB.addProduct(product);
    showToast('✔️ Producto agregado');
  }
  await reloadData();
  closeModal('modal-product');
  renderInventory();
  renderDashboard();
});

document.getElementById('btn-delete-product').addEventListener('click', async () => {
  const id = Number(document.getElementById('p-id').value);
  if (!id) return;
  if (!confirm('¿Eliminar este producto permanentemente?')) return;
  await DB.deleteProduct(id);
  await reloadData();
  closeModal('modal-product');
  renderInventory();
  renderDashboard();
});

// ==================================================================
// ENTRADA DE MERCANCÍA (RESTOCK)
// ==================================================================
function openRestockModal() {
  const sel = document.getElementById('rs-product');
  if (state.products.length === 0) {
    showToast('Primero agrega productos en Inventario');
    return;
  }
  sel.innerHTML = state.products
    .map((p) => `<option value="${p.id}">${(CATEGORIES[p.category] || CATEGORIES.otro).emoji} ${p.name}</option>`)
    .join('');
  document.getElementById('rs-qty').value = '';
  document.getElementById('rs-cost').value = '';
  document.getElementById('rs-note').value = '';
  updateRestockStockLabel();
  openModal('modal-restock');
}

function updateRestockStockLabel() {
  const id = Number(document.getElementById('rs-product').value);
  const p = state.products.find((x) => x.id === id);
  document.getElementById('rs-current-stock').textContent = p ? `Stock actual: ${p.stock} unidades` : '';
}

document.getElementById('btn-restock').addEventListener('click', openRestockModal);
document.getElementById('rs-product').addEventListener('change', updateRestockStockLabel);

document.getElementById('btn-confirm-restock').addEventListener('click', async () => {
  const id = Number(document.getElementById('rs-product').value);
  const qty = parseInt(document.getElementById('rs-qty').value);
  const newCost = document.getElementById('rs-cost').value;
  const note = document.getElementById('rs-note').value.trim();

  if (!id || !qty || qty <= 0) { showToast('Ingresa una cantidad válida'); return; }

  const product = state.products.find((p) => p.id === id);
  if (!product) return;

  product.stock = (product.stock || 0) + qty;
  if (newCost !== '' && !isNaN(parseFloat(newCost))) {
    product.cost = parseFloat(newCost);
  }
  await DB.updateProduct(product);
  await reloadData();

  closeModal('modal-restock');
  renderInventory();
  renderDashboard();
  showToast(`✔️ Entrada registrada: +${qty} uds. de ${product.name}${note ? ' (' + note + ')' : ''}`);
});

// ==================================================================
// REPORTES
// ==================================================================
function renderReports() {
  const totalVentas = state.sales.reduce((a, s) => a + s.total, 0);
  const totalGanancia = state.sales.reduce((a, s) => a + s.profit, 0);
  document.getElementById('r-ventas-total').textContent = fmtMoney(totalVentas);
  document.getElementById('r-ganancia-total').textContent = fmtMoney(totalGanancia);

  const qtyByProduct = {};
  state.sales.forEach((s) => s.items.forEach((it) => {
    qtyByProduct[it.name] = (qtyByProduct[it.name] || 0) + it.qty;
  }));
  const top = Object.entries(qtyByProduct).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topEl = document.getElementById('r-top-products');
  topEl.innerHTML = top.length === 0
    ? '<div class="empty-state"><div class="eicon">🏆</div>Sin datos aún</div>'
    : top.map(([name, qty], i) => `<div class="sale-row"><div class="sinfo">${i + 1}. ${name}</div><div class="stotal">${qty} uds.</div></div>`).join('');

  const histEl = document.getElementById('r-history');
  const sorted = [...state.sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  histEl.innerHTML = sorted.length === 0
    ? '<div class="empty-state"><div class="eicon">📜</div>No hay ventas registradas</div>'
    : sorted.map((s) => `
      <div class="sale-row">
        <div class="sinfo"><b>${s.clientName || 'Cliente'}</b><div class="sdate">${new Date(s.date).toLocaleString('es-DO')} · ${s.payment}</div></div>
        <div class="sale-row-actions">
          <div class="stotal">${fmtMoney(s.total)}</div>
          <button class="btn-reprint" onclick="reprintInvoice(${s.id})" title="Reimprimir factura">🖨️</button>
        </div>
      </div>`).join('');
}

// Reimprime (descarga/comparte de nuevo) la factura de una venta del historial
function reprintInvoice(saleId) {
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) { showToast('⚠️ No se encontró esa venta'); return; }
  state.lastSaleForInvoice = sale;
  document.getElementById('reprint-total-text').textContent =
    `Factura #${String(sale.id).padStart(5, '0')} · Total: ${fmtMoney(sale.total)}`;
  openModal('modal-reprint');
}

document.getElementById('btn-reprint-download-pdf').addEventListener('click', () => {
  if (!state.lastSaleForInvoice) return;
  const doc = generateInvoicePDF(state.lastSaleForInvoice);
  doc.save(`Factura_${state.lastSaleForInvoice.id}.pdf`);
});

document.getElementById('btn-reprint-share-whatsapp').addEventListener('click', () => {
  const sale = state.lastSaleForInvoice;
  if (!sale) return;
  const message = buildWhatsappMessage(sale);
  const phone = (sale.clientPhone || '').replace(/[^0-9]/g, '');
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  showToast('📎 No olvides adjuntar el PDF descargado en el chat de WhatsApp');
});

function generateStoreReportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const wineRGB = [90, 15, 46];
  const goldRGB = [212, 175, 55];
  const creamRGB = [250, 245, 235];

  const headerHeight = drawPDFHeader(doc, wineRGB, goldRGB, [
    'Reporte de Estado General del Negocio',
    `Generado el ${new Date().toLocaleString('es-DO')}`
  ]);

  let y = headerHeight + 14;

  // ---- Resumen general (tarjetas) ----
  const totalVentas = state.sales.reduce((a, s) => a + s.total, 0);
  const totalGanancia = state.sales.reduce((a, s) => a + s.profit, 0);
  const totalProductos = state.products.length;
  const totalUnidadesStock = state.products.reduce((a, p) => a + (p.stock || 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...wineRGB);
  doc.text('Resumen General', 14, y);
  y += 8;

  const cards = [
    ['Ventas Totales', fmtMoney(totalVentas)],
    ['Ganancia Total', fmtMoney(totalGanancia)],
    ['Total de Ventas', String(state.sales.length)],
    ['Productos en Catálogo', String(totalProductos)],
    ['Unidades en Stock', String(totalUnidadesStock)]
  ];
  const cardW = 58, cardH = 22, gap = 4;
  let cx = 14, cy = y;
  cards.forEach((c, i) => {
    if (i > 0 && i % 3 === 0) { cx = 14; cy += cardH + gap; }
    doc.setFillColor(...wineRGB);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'F');
    doc.setTextColor(...goldRGB);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(c[1], cx + cardW / 2, cy + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(c[0].toUpperCase(), cx + cardW / 2, cy + 16, { align: 'center' });
    cx += cardW + gap;
  });
  y = cy + cardH + 14;

  // ---- Alerta de bajo stock ----
  const lowStock = state.products.filter((p) => p.stock <= (p.minStock ?? 5));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...wineRGB);
  doc.text('Productos con Bajo Stock', 14, y);
  y += 7;
  if (lowStock.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text('Todo el inventario está en niveles saludables.', 14, y);
    y += 10;
  } else {
    lowStock.slice(0, 10).forEach((p, i) => {
      if (i % 2 === 0) { doc.setFillColor(...creamRGB); doc.rect(14, y - 5, 182, 7, 'F'); }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(p.name.slice(0, 45), 18, y);
      doc.setTextColor(176, 35, 58);
      doc.setFont('helvetica', 'bold');
      doc.text(`${p.stock} uds. (mínimo ${p.minStock ?? 5})`, 192, y, { align: 'right' });
      y += 7;
    });
    y += 6;
  }

  // ---- Productos más vendidos ----
  const qtyByProduct = {};
  state.sales.forEach((s) => s.items.forEach((it) => { qtyByProduct[it.name] = (qtyByProduct[it.name] || 0) + it.qty; }));
  const top = Object.entries(qtyByProduct).sort((a, b) => b[1] - a[1]).slice(0, 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...wineRGB);
  doc.text('Productos Más Vendidos', 14, y);
  y += 8;
  doc.setFillColor(...wineRGB);
  doc.rect(14, y - 6, 182, 8, 'F');
  doc.setTextColor(...goldRGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Producto', 18, y);
  doc.text('Unidades Vendidas', 190, y, { align: 'right' });
  y += 9;

  if (top.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text('Aún no hay ventas registradas.', 14, y);
    y += 10;
  } else {
    top.forEach(([name, qty], i) => {
      if (y > 260) { drawPDFFooter(doc, wineRGB); doc.addPage(); y = 20; }
      if (i % 2 === 0) { doc.setFillColor(...creamRGB); doc.rect(14, y - 5, 182, 7, 'F'); }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(`${i + 1}. ${name}`.slice(0, 55), 18, y);
      doc.text(String(qty), 190, y, { align: 'right' });
      y += 7;
    });
    y += 6;
  }

  // ---- Inventario completo ----
  if (y > 240) { drawPDFFooter(doc, wineRGB); doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...wineRGB);
  doc.text('Inventario Completo', 14, y);
  y += 8;
  doc.setFillColor(...wineRGB);
  doc.rect(14, y - 6, 182, 8, 'F');
  doc.setTextColor(...goldRGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Producto', 18, y);
  doc.text('Categoría', 110, y);
  doc.text('Precio', 150, y, { align: 'center' });
  doc.text('Stock', 190, y, { align: 'right' });
  y += 9;

  const sortedProducts = [...state.products].sort((a, b) => a.name.localeCompare(b.name));
  sortedProducts.forEach((p, i) => {
    if (y > 270) {
      drawPDFFooter(doc, wineRGB);
      doc.addPage();
      y = 20;
      doc.setFillColor(...wineRGB);
      doc.rect(14, y - 6, 182, 8, 'F');
      doc.setTextColor(...goldRGB);
      doc.setFont('helvetica', 'bold');
      doc.text('Producto', 18, y);
      doc.text('Categoría', 110, y);
      doc.text('Precio', 150, y, { align: 'center' });
      doc.text('Stock', 190, y, { align: 'right' });
      y += 9;
    }
    if (i % 2 === 0) { doc.setFillColor(...creamRGB); doc.rect(14, y - 5, 182, 7, 'F'); }
    const cat = CATEGORIES[p.category] || CATEGORIES.otro;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(p.name.slice(0, 38), 18, y);
    doc.text(cat.label, 110, y);
    doc.text(fmtMoney(p.price), 150, y, { align: 'center' });
    doc.setTextColor(p.stock <= (p.minStock ?? 5) ? 176 : 30, p.stock <= (p.minStock ?? 5) ? 35 : 30, p.stock <= (p.minStock ?? 5) ? 58 : 30);
    doc.text(String(p.stock), 190, y, { align: 'right' });
    y += 7;
  });

  drawPDFFooter(doc, wineRGB);
  return doc;
}

document.getElementById('btn-download-report-pdf').addEventListener('click', () => {
  const doc = generateStoreReportPDF();
  doc.save(`Estado_General_${state.businessName.replace(/\s+/g, '_')}_${todayStr()}.pdf`);
  showToast('✔️ Reporte PDF generado');
});

// ==================================================================
// CONFIGURACIÓN
// ==================================================================
function renderConfigScreen() {
  document.getElementById('cfg-business-name').value = state.businessName;
  document.getElementById('cfg-business-phone').value = state.businessPhone;
  document.getElementById('cfg-auto-backup').checked = state.autoBackupEnabled !== false;
}

document.getElementById('btn-save-config').addEventListener('click', async () => {
  const name = document.getElementById('cfg-business-name').value.trim() || 'Lo Tengo Todo Boutique';
  const phone = document.getElementById('cfg-business-phone').value.trim();
  await DB.setConfig('businessName', name);
  await DB.setConfig('businessPhone', phone);
  state.businessName = name;
  state.businessPhone = phone;
  document.getElementById('topbar-subtitle').textContent = name;
  showToast('✔️ Datos guardados');
});

document.getElementById('cfg-auto-backup').addEventListener('change', async (e) => {
  state.autoBackupEnabled = e.target.checked;
  await DB.setConfig('autoBackupEnabled', e.target.checked);
  showToast(e.target.checked ? '✔️ Copia automática activada' : 'Copia automática desactivada');
});

function triggerBackupDownload(data, silent) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo_lo_tengo_todo_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (silent) showToast('💾 Copia de seguridad automática guardada');
  else showToast('✔️ Respaldo exportado');
}

// Respaldo automático: una vez al día, sin que el usuario tenga que acordarse.
// Si en Ajustes de Safari > Descargas está seleccionado "iCloud Drive", este
// archivo queda fuera del almacenamiento del navegador (IndexedDB) y
// sobrevive aunque iOS borre los datos de la app o se reinstale el ícono.
async function autoBackupIfNeeded() {
  try {
    const enabled = await DB.getConfig('autoBackupEnabled', true);
    if (!enabled) return;
    const today = todayStr();
    const lastBackup = await DB.getConfig('lastAutoBackupDate', null);
    if (lastBackup === today) return;
    const products = await DB.getAllProducts();
    const sales = await DB.getAllSales();
    if (products.length === 0 && sales.length === 0) return; // nada que respaldar aún
    const data = await DB.exportAll();
    triggerBackupDownload(data, true);
    await DB.setConfig('lastAutoBackupDate', today);
  } catch (e) {
    console.error('No se pudo generar la copia automática:', e);
  }
}

document.getElementById('btn-export').addEventListener('click', async () => {
  const data = await DB.exportAll();
  triggerBackupDownload(data, false);
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!confirm('Esto reemplazará los datos actuales con el respaldo. ¿Continuar?')) return;
    await DB.importAll(data);
    await reloadData();
    await loadConfig();
    renderConfigScreen();
    renderDashboard();
    showToast('✔️ Datos importados correctamente');
  } catch (err) {
    showToast('❌ Archivo inválido');
  }
  e.target.value = '';
});

document.getElementById('btn-wipe').addEventListener('click', async () => {
  if (!confirm('Esto eliminará TODOS los productos y ventas permanentemente (se conserva el nombre y teléfono del negocio). ¿Estás segura?')) return;
  try {
    await DB.wipeAll();
    await reloadData();
    renderDashboard();
    renderInventory();
    renderConfigScreen();
    showToast('🗑️ Datos eliminados');
  } catch (err) {
    console.error('Error al borrar los datos:', err);
    showToast('❌ No se pudieron borrar los datos. Intenta de nuevo.');
  }
});

document.getElementById('btn-reset-system').addEventListener('click', async () => {
  const step1 = confirm('⚠️ RESTABLECER SISTEMA\n\nEsto borrará TODO de forma permanente: productos, ventas, historial, configuración del negocio y la caché de la app. No se puede deshacer.\n\n¿Deseas continuar?');
  if (!step1) return;

  const step2 = confirm('Última confirmación: la app se reiniciará como si la instalaras por primera vez.\n\n¿Confirmas el restablecimiento total?');
  if (!step2) return;

  showToast('🔄 Restableciendo sistema...');

  try {
    // 1. Borrar toda la base de datos local
    await DB.deleteDatabaseCompletely();

    // 2. Borrar la caché del Service Worker
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // 3. Desregistrar el Service Worker para que se reinstale limpio
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (err) {
    console.error('Error al restablecer:', err);
  }

  // 4. Recargar la app desde cero
  setTimeout(() => window.location.reload(), 400);
});

// ==================================================================
// SEED DATA (productos de ejemplo la primera vez)
// ==================================================================
async function seedIfEmpty() {
  const existing = await DB.getAllProducts();
  if (existing.length > 0) return;
  const samples = [
    { name: 'Zapatos Glam Dorados', category: 'zapatos', price: 2500, cost: 1200, stock: 8, minStock: 3 },
    { name: 'Bolso Elegance Negro', category: 'bolsos', price: 1800, cost: 900, stock: 5, minStock: 2 },
    { name: 'Pestañas Volumen Ruby', category: 'pestanas', price: 450, cost: 150, stock: 20, minStock: 5 },
    { name: 'Vestido Noche Vinotinto', category: 'vestidos', price: 3200, cost: 1500, stock: 4, minStock: 2 },
    { name: 'Conjunto Lencería Rosa', category: 'lenceria', price: 1200, cost: 500, stock: 6, minStock: 3 },
    { name: 'Collar Dorado Boutique', category: 'accesorios', price: 950, cost: 350, stock: 10, minStock: 3 }
  ];
  for (const s of samples) await DB.addProduct(s);
}

// ==================================================================
// SIN SERVICE WORKER + INIT
// ==================================================================
// Ya no usamos Service Worker: el proyecto de referencia (D'Sammy Burgers)
// nunca ha perdido datos y funciona solo con IndexedDB, sin nada cacheando
// el "shell" de la app. Si el iPhone ya tenía instalado el Service Worker
// de una versión anterior, lo desregistramos y borramos su caché aquí para
// que deje de interceptar peticiones y de servir archivos viejos.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* silencioso */ }
  });
}

async function init() {
  // Pedimos almacenamiento persistente: reduce el riesgo de que iOS borre
  // automáticamente el IndexedDB de la app (productos, ventas, config).
  if (navigator.storage && navigator.storage.persist) {
    try {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    } catch (e) { /* si el navegador no lo soporta, seguimos igual */ }
  }

  await loadConfig();
  await seedIfEmpty();
  await reloadData();
  document.getElementById('topbar-subtitle').textContent = state.businessName;
  goToScreen('inicio');

  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 650);
  }, 1200);

  // Se dispara después del splash para no competir con el arranque de la app.
  setTimeout(() => autoBackupIfNeeded(), 2000);
}

init();
