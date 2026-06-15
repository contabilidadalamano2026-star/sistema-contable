import React from 'react';

const CRM = () => {
  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Contactos (CRM)</h1>
        <button className="bg-primary hover:bg-green-600 px-4 py-2 rounded font-bold transition">
          + Nuevo Contacto
        </button>
      </div>
      <div className="bg-surface rounded shadow p-6">
        <p className="text-gray-400">El módulo de CRM (Clientes, Proveedores, Puntos) será migrado a la nueva arquitectura en el próximo sprint.</p>
      </div>
    </div>
  );
};

export default CRM;
