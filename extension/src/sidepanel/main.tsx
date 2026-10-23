import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { SidePanelApp } from './SidePanelApp';
import { AppProvider } from './context/AppContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <SidePanelApp />
    </AppProvider>
  </React.StrictMode>,
);
