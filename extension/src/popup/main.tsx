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
      <div className="w-12 h-12 rounded-lg border border-surface-border bg-surface-card flex items-center justify-center mb-4 text-brand-700">
        <MessageCircle size={22} />
      </div>

      <h1 className="text-lg font-semibold text-gray-100 mb-1">
        SaySo
      </h1>
      <p className="text-xs text-gray-400 mb-5 max-w-[220px] leading-relaxed">
        A little help with your WhatsApp replies
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
