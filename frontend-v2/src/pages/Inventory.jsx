import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('token');
        const businessId = localStorage.getItem('businessId') || 2; 
        const res = await fetch(`${API_URL}/businesses/${businessId}/products`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventario de Productos</h1>
        <button className="bg-primary hover:bg-green-600 px-4 py-2 rounded font-bold transition">
          + Nuevo Producto
        </button>
      </div>

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-sm border-b border-gray-700">
              <th className="p-4 font-semibold">Nombre</th>
              <th className="p-4 font-semibold">Precio Base</th>
              <th className="p-4 font-semibold">IVA (%)</th>
              <th className="p-4 font-semibold">Stock</th>
              <th className="p-4 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">Cargando...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">No hay productos registrados</td>
              </tr>
            ) : (
              products.map(p => (
                <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4">{p.name}</td>
                  <td className="p-4 font-mono">₡{p.price.toLocaleString()}</td>
                  <td className="p-4">{p.iva_rate}%</td>
                  <td className="p-4">{p.stock}</td>
                  <td className="p-4 text-secondary cursor-pointer hover:underline">Editar</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;
