import React from 'react';
import { useApp } from './context/AppContext';
import { HomeView } from './views/HomeView';
import { RepliesView } from './views/RepliesView';
import { EditorView } from './views/EditorView';
import { SettingsView } from './views/SettingsView';
import { Header } from './components/Header';

export function SidePanelApp() {
  const { state } = useApp();

  return (
    <div className="flex flex-col h-screen bg-surface-base text-gray-100 font-sans">
      <Header />

      <main className="flex-1 overflow-y-auto px-3 py-4">
        {state.view === 'home' && <HomeView />}
        {state.view === 'replies' && <RepliesView />}
        {state.view === 'editor' && <EditorView />}
        {state.view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
