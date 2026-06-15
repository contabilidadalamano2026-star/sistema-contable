import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, setToken }) => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar setToken={setToken} />
      <div className="flex-1 overflow-y-auto p-8">
        {children}
      </div>
    </div>
  );
};

export default Layout;
