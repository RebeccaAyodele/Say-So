import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { MessageCircle, ExternalLink } from 'lucide-react';

function Popup() {
  function openSidePanel() {
    // Open the side panel on the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
    window.close();
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center font-sans">
      {/* Logo */}
      <div className="w-14 h-14 rounded-xl bg-brand-700 flex items-center justify-center mb-4">
        <MessageCircle size={24} className="text-white" />
      </div>

      <h1 className="text-lg font-bold text-white mb-1">
        Say<span className="text-brand-400">So</span>
      </h1>
      <p className="text-xs text-gray-400 mb-5 max-w-[220px] leading-relaxed">
        AI-powered personal reply assistant for WhatsApp Web
      </p>

      <button
        onClick={openSidePanel}
        className="button-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold active:scale-[0.98]"
      >
        <ExternalLink size={15} />
        Open Side Panel
      </button>

      <p className="text-[10px] text-gray-600 mt-4">
        Navigate to <strong className="text-gray-400">web.whatsapp.com</strong> first
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
