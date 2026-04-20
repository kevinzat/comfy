import { EditorView } from '@codemirror/view';
import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { buildProofText, buildProofFile } from './UnifiedEditor';
import { toLean } from '../proof/lean';

export function installNativeMenu(view: EditorView): () => void {
  let cancelled = false;
  let currentPath: string | null = null;

  const setDoc = (text: string) => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  };

  const newProof = () => {
    currentPath = null;
    setDoc('');
  };

  const openProof = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: 'Proof', extensions: ['prf'] }],
    });
    if (!path || typeof path !== 'string') return;
    const text = await readTextFile(path);
    currentPath = path;
    setDoc(text);
  };

  const saveProof = async () => {
    if (currentPath) {
      await writeTextFile(currentPath, buildProofText(view));
      return;
    }
    await saveProofAs();
  };

  const saveProofAs = async () => {
    const path = await save({
      filters: [{ name: 'Proof', extensions: ['prf'] }],
      defaultPath: currentPath ?? 'untitled.prf',
    });
    if (!path) return;
    currentPath = path;
    await writeTextFile(path, buildProofText(view));
  };

  const saveLean = async () => {
    const path = await save({
      filters: [{ name: 'Lean', extensions: ['lean'] }],
      defaultPath: 'untitled.lean',
    });
    if (!path) return;
    await writeTextFile(path, toLean(buildProofFile(view)));
  };

  const viewLog = async () => {
    const existing = await WebviewWindow.getByLabel('log');
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
    const win = new WebviewWindow('log', {
      url: 'index.html#log',
      title: 'Comfy Log',
      width: 900,
      height: 600,
      resizable: true,
    });
    win.once('tauri://error', (e) => {
      console.error('Failed to open log window', e);
    });
  };

  (async () => {
    const fileItems = await Promise.all([
      MenuItem.new({ text: 'New', accelerator: 'CmdOrCtrl+N', action: newProof }),
      MenuItem.new({ text: 'Open…', accelerator: 'CmdOrCtrl+O', action: openProof }),
      PredefinedMenuItem.new({ item: 'Separator' }),
      MenuItem.new({ text: 'Save', accelerator: 'CmdOrCtrl+S', action: saveProof }),
      MenuItem.new({ text: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', action: saveProofAs }),
      MenuItem.new({ text: 'Export Lean…', action: saveLean }),
      PredefinedMenuItem.new({ item: 'Separator' }),
      PredefinedMenuItem.new({ item: 'Quit' }),
    ]);
    const fileMenu = await Submenu.new({ text: 'File', items: fileItems });

    const viewItems = await Promise.all([
      MenuItem.new({ text: 'View Log', accelerator: 'CmdOrCtrl+Shift+L', action: viewLog }),
    ]);
    const viewMenu = await Submenu.new({ text: 'View', items: viewItems });

    const menu = await Menu.default();
    if (cancelled) return;
    // Menu.default() on macOS includes File/Edit/View/Window/Help submenus.
    // Keep the app menu and Edit; drop the rest so we can supply our own.
    for (const item of await menu.items()) {
      if (item.kind === 'Submenu') {
        const t = await (item as Submenu).text();
        if (t === 'File' || t === 'View' || t === 'Window' || t === 'Help') {
          await menu.remove(item);
        }
      }
    }
    // Standard macOS order: App, File, Edit, View.
    await menu.insert(fileMenu, 1);
    await menu.append(viewMenu);
    if (cancelled) return;
    await menu.setAsAppMenu();
  })().catch((e) => {
    console.error('Failed to install native menu', e);
  });

  return () => {
    cancelled = true;
  };
}
