import React, { useState, useEffect } from 'react';
import API_URL from '../config';

const CRM = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newOpp, setNewOpp] = useState({ title: '', description: '', amount: 0, status: 'Lead' });

  const columns = ['Lead', 'Contactado', 'Propuesta', 'Ganado', 'Perdido'];

  const fetchOpportunities = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/opportunities/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar oportunidades');
      const data = await res.json();
      setOpportunities(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleDragStart = (e, oppId) => {
    e.dataTransfer.setData('oppId', oppId);
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('oppId');
    const opp = opportunities.find(o => o.id === parseInt(oppId));
    if (opp && opp.status !== newStatus) {
      // Optimistic UI update
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: newStatus } : o));
      
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/opportunities/${opp.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ...opp, status: newStatus })
        });
      } catch (err) {
        // Revert on error
        fetchOpportunities();
        alert('Error al actualizar el estado');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const createOpportunity = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/opportunities/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newOpp)
      });
      if (!res.ok) throw new Error('Error al crear');
      const data = await res.json();
      setOpportunities([...opportunities, data]);
      setShowModal(false);
      setNewOpp({ title: '', description: '', amount: 0, status: 'Lead' });
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="text-white p-6">Cargando CRM...</div>;

  return (
    <div className="text-white h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-green-300">
            Pipeline de Ventas (CRM)
          </h1>
          <p className="text-gray-400 mt-1">Arrastra y suelta oportunidades entre columnas</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-green-600 px-4 py-2 rounded-lg font-bold transition shadow-lg shadow-primary/20"
        >
          + Nueva Oportunidad
        </button>
      </div>

      {error && <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4 border border-red-500/30">{error}</div>}

      <div className="flex gap-4 overflow-x-auto pb-4 flex-grow">
        {columns.map(status => (
          <div 
            key={status}
            className="bg-surface/50 border border-gray-700/50 rounded-xl p-4 min-w-[300px] flex flex-col"
            onDrop={(e) => handleDrop(e, status)}
            onDragOver={handleDragOver}
          >
            <h3 className="font-bold text-lg mb-4 flex justify-between items-center text-gray-200">
              {status}
              <span className="bg-background text-xs px-2 py-1 rounded-full text-gray-400">
                {opportunities.filter(o => o.status === status).length}
              </span>
            </h3>
            
            <div className="flex-grow space-y-3">
              {opportunities.filter(o => o.status === status).map(opp => (
                <div 
                  key={opp.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, opp.id)}
                  className="bg-background border border-gray-700 hover:border-primary/50 p-4 rounded-lg cursor-move shadow-md transition transform hover:-translate-y-1 active:scale-95"
                >
                  <h4 className="font-bold text-gray-100">{opp.title}</h4>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{opp.description}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-primary font-medium">₡{opp.amount.toLocaleString()}</span>
                    <span className="text-xs text-gray-500">{new Date(opp.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {opportunities.filter(o => o.status === status).length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-gray-700/50 rounded-lg text-gray-500 text-sm">
                  Arrastra aquí
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-surface border border-gray-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Nueva Oportunidad</h2>
            <form onSubmit={createOpportunity} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Título</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white focus:border-primary outline-none transition"
                  value={newOpp.title}
                  onChange={e => setNewOpp({...newOpp, title: e.target.value})}
                  placeholder="Ej: Proyecto Venta Empresa X"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea 
                  className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white focus:border-primary outline-none transition"
                  value={newOpp.description}
                  onChange={e => setNewOpp({...newOpp, description: e.target.value})}
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Monto Estimado (₡)</label>
                <input 
                  type="number" 
                  className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white focus:border-primary outline-none transition"
                  value={newOpp.amount}
                  onChange={e => setNewOpp({...newOpp, amount: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-primary hover:bg-green-600 px-4 py-2 rounded-lg font-bold text-white transition"
                >
                  Crear Oportunidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRM;
