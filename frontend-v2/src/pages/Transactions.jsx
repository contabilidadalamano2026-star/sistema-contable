import React, { useState, useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { API_URL } from '../config';

const NotificationListener = registerPlugin('NotificationListener');
const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const initListener = async () => {
      await NotificationListener.addListener('notificationReceived', (data) => {
        setNotification(data);
      });
    };
    initListener();
  }, []);

  // Fetch from real backend
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const token = localStorage.getItem('token');
        const businessId = localStorage.getItem('businessId') || 2; 
        const res = await fetch(`${API_URL}/businesses/${businessId}/transactions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const handleRegisterNotification = async () => {
    // Extraer monto del texto usando RegEx
    const amountMatch = notification.text.match(/\d+(\.\d+)?/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
    
    const token = localStorage.getItem('token');
    const businessId = localStorage.getItem('businessId') || 2; 
    
    const payload = {
      type: 'income',
      amount: amount,
      category: 'Notificación Android',
      description: `Pago vía ${notification.title}`,
      is_paid: true
    };
    
    try {
        const res = await fetch(`${API_URL}/businesses/${businessId}/transactions`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            setTransactions([data, ...transactions]);
        }
    } catch(e) { console.error(e); }
    
    setNotification(null);
  };

  const fileInputRef = React.useRef(null);
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const confirmSync = window.confirm(
      "⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\n" +
      "Estás a punto de enviar una imagen/archivo a la nube (Servidor C.A.L.M) para su procesamiento.\n\n" +
      "¿Deseas continuar?"
    );

    if (!confirmSync) {
      e.target.value = ''; // Reset
      return;
    }

    const token = localStorage.getItem('token');
    const businessId = localStorage.getItem('businessId') || 2; 

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/businesses/${businessId}/invoices/receive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Gasto procesado: ₡${data.amount} (${data.supplier})`);
        // Refresh transactions list
        window.location.reload();
      } else {
        const error = await res.json();
        alert(`Error: ${error.detail}`);
      }
    } catch(err) {
      console.error(err);
      alert('Error de conexión');
    }
    e.target.value = ''; // Reset
  };

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Transacciones</h1>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,application/xml" 
            capture="environment" 
            className="hidden" 
          />
          <button onClick={handleUploadClick} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-medium transition flex items-center gap-2">
            📸 Importar XML/Cámara
          </button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition">
            + Nueva Transacción
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-green-800 border border-green-500 text-white p-4 rounded mb-6 flex justify-between items-center">
          <div>
            <h3 className="font-bold">¡Nuevo Pago Detectado! ({notification.title})</h3>
            <p className="text-sm text-green-200">{notification.text}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRegisterNotification} className="bg-green-500 hover:bg-green-400 px-4 py-2 rounded text-sm font-bold">Registrar</button>
            <button onClick={() => setNotification(null)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-sm">Ignorar</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-sm border-b border-gray-700">
              <th className="p-4 font-semibold">Fecha</th>
              <th className="p-4 font-semibold">Descripción</th>
              <th className="p-4 font-semibold">Categoría</th>
              <th className="p-4 font-semibold">Monto</th>
              <th className="p-4 font-semibold">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">Cargando...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">No hay transacciones registradas</td>
              </tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4">{tx.date}</td>
                  <td className="p-4">{tx.description}</td>
                  <td className="p-4">{tx.category}</td>
                  <td className="p-4 font-mono">₡{tx.amount.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'income' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Transactions;
