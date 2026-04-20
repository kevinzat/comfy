import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import UnifiedEditor from './editor/UnifiedEditor';
import LogWindow from './editor/LogWindow';
import { installProducer } from './editor/errorLog';

const isTauri = '__TAURI_INTERNALS__' in window;
const isLog = window.location.hash === '#log';

if (isTauri && !isLog) {
  installProducer();
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
if (isLog) {
  root.render(<LogWindow />);
} else {
  root.render(isTauri ? <UnifiedEditor /> : <App />);
}
