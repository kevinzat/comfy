import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import UnifiedEditor from './editor/UnifiedEditor';

const isTauri = '__TAURI_INTERNALS__' in window;

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(isTauri ? <UnifiedEditor /> : <App />);
