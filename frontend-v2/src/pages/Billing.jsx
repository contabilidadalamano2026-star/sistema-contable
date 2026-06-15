import { useState } from 'react';
import API_URL from '../config';

function Billing({ businessId }) {
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState([{ name: '', price: 0, qty: 1, iva_rate: 13, is_service: false }]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddItem = () => {
    setItems([...items, { name: '', price: 0, qty: 1, iva_rate: 13, is_service: false }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleEmitInvoice = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/businesses/${businessId}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          client_name: clientName,
          client_id: clientId,
          items: items.map(item => ({...item, price: parseFloat(item.price), qty: parseInt(item.qty), iva_rate: parseFloat(item.iva_rate)}))
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message} - Clave: ${data.invoice_number}`);
        setClientName('');
        setClientId('');
        setItems([{ name: '', price: 0, qty: 1, iva_rate: 13, is_service: false }]);
      } else {
        setMessage(`❌ Error: ${data.detail}`);
      }
    } catch (err) {
      setMessage('❌ Error de conexión al emitir factura');
    }
    setLoading(false);
  };

  return (
    <div className="container p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Facturación Electrónica (Hacienda CR)</h2>
      
      {message && (
        <div className="p-3 mb-4 rounded bg-blue-100 text-blue-800">{message}</div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">Datos del Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Nombre completo o Razón Social" className="border p-2 rounded dark:bg-gray-700 dark:text-white" value={clientName} onChange={e => setClientName(e.target.value)} />
          <input type="text" placeholder="Cédula (Física/Jurídica)" className="border p-2 rounded dark:bg-gray-700 dark:text-white" value={clientId} onChange={e => setClientId(e.target.value)} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">Líneas de Factura</h3>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2 items-center bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <input type="text" placeholder="Descripción" className="border p-2 rounded col-span-2" value={item.name} onChange={e => handleItemChange(i, 'name', e.target.value)} />
            <input type="number" placeholder="Precio Unit" className="border p-2 rounded" value={item.price} onChange={e => handleItemChange(i, 'price', e.target.value)} />
            <input type="number" placeholder="Cantidad" className="border p-2 rounded" value={item.qty} onChange={e => handleItemChange(i, 'qty', e.target.value)} />
            <select className="border p-2 rounded" value={item.iva_rate} onChange={e => handleItemChange(i, 'iva_rate', e.target.value)}>
              <option value="13">IVA 13%</option>
              <option value="4">IVA 4%</option>
              <option value="2">IVA 2%</option>
              <option value="1">IVA 1%</option>
              <option value="0">Exento</option>
            </select>
          </div>
        ))}
        <button onClick={handleAddItem} className="mt-2 text-sm text-blue-600 font-semibold hover:underline">+ Agregar línea</button>
      </div>

      <button 
        onClick={handleEmitInvoice}
        disabled={loading || !clientName || !items[0].name}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg disabled:opacity-50 transition w-full md:w-auto"
      >
        {loading ? 'Firmando XML y Enviando...' : 'Fimar y Enviar a Hacienda'}
      </button>

      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-500 rounded text-sm text-yellow-800 dark:text-yellow-200">
        <p><strong>Nota (Pruebas - Fase 8):</strong> Los comprobantes generados actualmente utilizan un certificado criptográfico (.p12) de pruebas (Staging) autogenerado y no tienen validez legal. Cuando pases a producción, el certificado ATV será inyectado en el servidor.</p>
      </div>
    </div>
  );
}

export default Billing;
