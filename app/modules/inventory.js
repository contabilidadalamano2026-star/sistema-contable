    if (!state.transactionsNegocio || state.transactionsNegocio.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    
    // Obtener filtros actuales
    const monthFilter = document.getElementById('filter-month') ? document.getElementById('filter-month').value : '';
    const textFilter = document.getElementById('filter-text') ? document.getElementById('filter-text').value.toLowerCase() : '';
    
    const filteredTxs = state.transactionsNegocio.filter(tx => {
        const txDate = new Date(tx.date);
        if (monthFilter !== '' && txDate.getMonth().toString() !== monthFilter) return false;
        if (textFilter !== '' && (!tx.category.toLowerCase().includes(textFilter) && (!tx.description || !tx.description.toLowerCase().includes(textFilter)))) return false;
        return true;
    });

    if (filteredTxs.length === 0) {
        alert("Los filtros actuales no devuelven resultados para exportar.");
        return;
    }

    let csvContent = "Fecha,Tipo,CategorÃ­a,Detalle,Monto (CRC),Estado Hacienda
";
    
    filteredTxs.forEach(tx => {
        const fecha = new Date(tx.date).toLocaleDateString();
        const tipo = tx.type === 'income' ? 'Ingreso' : 'Gasto';
        const categoria = "${tx.category || ''}";
        const detalle = "${tx.description || ''}";
        const monto = tx.amount.toFixed(2);
        const estado = "${tx.hacienda_status || 'Local'}";
        
        csvContent += "","","","","","
";
    });

    // AÃ±adir BOM para que Excel lea los acentos correctamente
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Reporte_Contable_" + new Date().getTime() + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- MODULO DE INVENTARIO / CATALOGO ---

async function loadProducts(businessId) {
    try {
        const response = await fetch(`${API_URL}/products?business_id=${businessId}`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (response.ok) {
            state.productosNegocio = await response.json();
            renderProducts();
            populateProductDatalist();
        }
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function renderProducts() {
    const tbody = document.getElementById('list-productos');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!state.productosNegocio || state.productosNegocio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay productos en el inventario.</td></tr>';
        return;
    }
    
    state.productosNegocio.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        const isLow = p.quantity <= 5;
        const alertBadge = isLow ? <span style='background:#f44336; color:white; padding:2px 5px; border-radius:3px; font-size:0.7rem; margin-left:5px;'>¡Stock Bajo!</span> : '';
        const qtyText = p.warehouse_name ? ${p.quantity} () : ${p.quantity};
        tr.innerHTML = `
            <td style="padding:10px;">${p.product_name}</td>
            <td style="padding:10px;">â‚¡${p.price.toFixed(2)}</td>
            <td style="padding:10px;">Stock: ${qtyText}</td>
            <td style="padding:10px; text-align:right;">
                <button class="btn btn-outline" style="padding:3px 8px; font-size:0.8rem;" onclick="openProductModal(${p.product_id})">Editar</button>
                <button class="btn btn-danger" style="padding:3px 8px; font-size:0.8rem;" onclick="deleteProduct(${p.product_id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Funciones FASE 22: Bodegas
async function loadWarehouses() {
    if (!state.currentBusinessId) return;
    const warehouses = await authFetch(`/businesses/${state.currentBusinessId}/warehouses`);
    const ul = document.getElementById('list-warehouses');
    if(ul) {
        ul.innerHTML = '';
        warehouses.forEach(w => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            li.innerHTML = `<span>${w.name}</span>`;
            ul.appendChild(li);
        });
    }
}

function openWarehouseModal() {
    document.getElementById('modal-warehouse').style.display = 'flex';
    loadWarehouses();
}

function closeWarehouseModal() {
    document.getElementById('modal-warehouse').style.display = 'none';
}

async function createWarehouse() {
    const name = document.getElementById('warehouse-name').value;
    if(!name) return alert("Ingrese el nombre de la bodega");
    
    await authFetch(`/businesses/${state.currentBusinessId}/warehouses`, {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    document.getElementById('warehouse-name').value = '';
    loadWarehouses();
}

function populateProductDatalist() {
    const datalist = document.getElementById('products-list');
    if(!datalist) return;
    datalist.innerHTML = '';
    
    if(state.productosNegocio) {
        const added = new Set();
        state.productosNegocio.forEach(p => {
            if(!added.has(p.product_name)) {
                added.add(p.product_name);
                const option = document.createElement('option');
                option.value = p.product_name;
                datalist.appendChild(option);
            }
        });
    }
}

function onProductSelect(productName) {
    if(!state.productosNegocio) return;
    const prod = state.productosNegocio.find(p => p.product_name.toLowerCase() === productName.toLowerCase());
    if(prod) {
        document.getElementById('tn-amount').value = prod.price;
        const ivaSelect = document.getElementById('tn-iva');
        if(ivaSelect) {
            ivaSelect.value = prod.iva_rate ? prod.iva_rate.toString() : "0";
        }
    }
}

function openProductModal(id = null) {
    document.getElementById('modal-product').style.display = 'flex';
    document.getElementById('prod-id').value = id || '';
    if(id) {
        const prod = state.productosNegocio.find(p => p.id === id);
        if(prod) {
            document.getElementById('modal-product-title').innerText = 'Editar Producto';
            document.getElementById('prod-name').value = prod.name;
            document.getElementById('prod-price').value = prod.price;
            document.getElementById('prod-iva').value = prod.iva_rate;
            document.getElementById('prod-stock').value = prod.stock;
        }
    } else {
        document.getElementById('modal-product-title').innerText = 'Nuevo Producto';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-iva').value = '13';
        document.getElementById('prod-stock').value = '0';
    }
}

function closeProductModal() {
    document.getElementById('modal-product').style.display = 'none';
}

async function saveProduct() {
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const iva_rate = parseInt(document.getElementById('prod-iva').value);
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    
    if(!name || isNaN(price)) {
        alert("Completa el nombre y el precio vÃ¡lidamente.");
        return;
    }
    
    const payload = id ? { name, price, iva_rate, stock } : { business_id: state.currentBusinessId, name, price, iva_rate, stock };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/products/${id}` : `${API_URL}/products`;
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + state.token
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            closeProductModal();
            loadProducts(state.currentBusinessId);
        } else {
            alert("Error al guardar producto");
        }
    } catch (error) {
        console.error("Error guardando producto:", error);
    }
}

async function deleteProduct(id) {
    if(!confirm("Â¿Seguro que deseas borrar este producto del catÃ¡logo?")) return;
    
    try {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (response.ok) {
            loadProducts(state.currentBusinessId);
        } else {
            alert("Error al borrar producto");
        }
    } catch (error) {
        console.error("Error borrando producto:", error);
    }
}

// --- MODULO DE GASTOS RECURRENTES / SUSCRIPCIONES ---

async function processRecurringExpenses(businessId) {
// FASE 23: ORDENES DE COMPRA
let poLines = [];
function openPurchaseOrdersModal() {
    document.getElementById('modal-purchase-orders').style.display = 'flex';
    document.getElementById('po-date').valueAsDate = new Date();
    loadPurchaseOrders();
    // Load contacts into select
    const select = document.getElementById('po-contact-id');
    select.innerHTML = '<option value=\"\">Seleccione Proveedor</option>';
    if (state.contactosNegocio) {
        state.contactosNegocio.forEach(c => {
            select.innerHTML += <option value=\"${c.id}\">${c.name}</option>;
        });
    }
}
function closePurchaseOrdersModal() {
    document.getElementById('modal-purchase-orders').style.display = 'none';
}
function addPurchaseOrderLine() {
    const prodInput = document.getElementById('po-product').value;
    const qty = parseInt(document.getElementById('po-qty').value);
    const price = parseFloat(document.getElementById('po-price').value);
    
    if(!prodInput || !qty || !price) return alert('Llene todos los campos de la línea');
    
    const prod = state.productosNegocio.find(p => p.product_name === prodInput);
    if(!prod) return alert('Producto no encontrado en el inventario');
    
    poLines.push({ product_id: prod.product_id, name: prod.product_name, quantity: qty, price: price });
    
    document.getElementById('po-product').value = '';
    document.getElementById('po-qty').value = '1';
    document.getElementById('po-price').value = '';
    
    renderPOLines();
}
function renderPOLines() {
    const ul = document.getElementById('po-lines');
    ul.innerHTML = '';
    let total = 0;
    poLines.forEach((l, i) => {
        total += l.quantity * l.price;
        const li = document.createElement('li');
        li.className = 'tx-item';
        li.innerHTML = <span>${l.quantity}x ${l.name} - ¢${l.price}</span>
            <button class="btn btn-outline" style="padding:2px 5px; color:red; border-color:red;" onclick="poLines.splice(${i},1); renderPOLines()">X</button>;
        ul.appendChild(li);
    });
    document.getElementById('po-total').value = total;
}
async function createPurchaseOrder() {
    const contactId = document.getElementById('po-contact-id').value;
    const date = document.getElementById('po-date').value;
    const total = parseFloat(document.getElementById('po-total').value);
    
    if(!contactId || poLines.length === 0) return alert('Seleccione proveedor y agregue líneas');
    
    const order = {
        contact_id: parseInt(contactId),
        date: date,
        total: total,
        lines: poLines.map(l => ({ product_id: l.product_id, quantity: l.quantity, price: l.price }))
    };
    
    try {
        await authFetch(/businesses/${state.currentBusinessId}/purchase_orders, {
            method: 'POST',
            body: JSON.stringify(order)
        });
        poLines = [];
        renderPOLines();
        loadPurchaseOrders();
    } catch (e) {
        alert(e.message);
    }
}
async function loadPurchaseOrders() {
    try {
        const orders = await authFetch(/businesses/${state.currentBusinessId}/purchase_orders);
        const ul = document.getElementById('list-purchase-orders');
        ul.innerHTML = '';
        orders.forEach(o => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            const statusColor = o.status === 'received' ? 'green' : 'orange';
            li.innerHTML = 
                <div>
                    <strong>#${o.id} - ${o.contact_name}</strong><br>
                    <small>${o.date} - ¢${o.total.toLocaleString()}</small><br>
                    <span style="color:${statusColor}">${o.status.toUpperCase()}</span>
                </div>
                ${o.status === 'pending' ? <button class="btn btn-primary" style="padding:5px;" onclick="receivePurchaseOrder(${o.id})">Recibir</button> : ''}
            ;
            ul.appendChild(li);
        });
    } catch(e) {
        console.error(e);
    }
}
async function receivePurchaseOrder(id) {
    const whStr = prompt('Ingrese ID de la Bodega de destino (0 para principal):', '0');
    if(whStr === null) return;
    const whId = parseInt(whStr) || 0;
    
    try {
        await authFetch(/businesses/${state.currentBusinessId}/purchase_orders/${id}/receive?warehouse_id=${whId}, {
            method: 'PUT'
        });
        alert('Orden recibida. Inventario actualizado.');
        loadPurchaseOrders();
        loadProducts();
    } catch(e) {
        alert(e.message);
    }
}

// FASE 24: IMPORTAR CSV
function openImportModal() {
    document.getElementById('modal-import-csv').style.display = 'flex';
}
function closeImportModal() {
    document.getElementById('modal-import-csv').style.display = 'none';
}
async function uploadCSV() {
    const fileInput = document.getElementById('csv-file');
    if(fileInput.files.length === 0) return alert('Seleccione un archivo CSV');
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch(\/businesses/\/products/import, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + state.token
            },
            body: formData
        });
        const data = await response.json();
        if(!response.ok) throw new Error(data.detail || 'Error en importación');
        alert(data.message);
        closeImportModal();
        loadProducts();
    } catch(e) {
        alert(e.message);
    }
}

