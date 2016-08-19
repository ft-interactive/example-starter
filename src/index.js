/**
 * Main controller for Vocab
 */

const electron = require('electron');
const storage = require('electron-json-storage');
const buildProject = require('./buildProject');
const processFile = require('./processFile');
const manageVisualVocabularyRepo = require('./manageVisualVocabularyRepo');
const postBuild = require('./postBuild');
const runAutoUpdate = require('./autoUpdate');

const {
  createOptionsWindow,
  createMainWindow,
  createNewProjectWindow,
} = require('./createWindow');

const app = electron.app;
const Menu = electron.Menu;
const ipcMain = electron.ipcMain;


// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// Prevent window being garbage collected
let mainWindow;
// These should probably be garbage collected...
let optionWindow;
let newProjectWindow;

function setupMenu() {
  // Set up the menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload();
          },
        },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click() {
            if (!optionWindow) {
              optionWindow = createOptionsWindow();
              optionWindow.on('closed', () => {
                optionWindow = null;
              });
            }
          },
        },
        {
          role: 'quit',
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);

  Menu.setApplicationMenu(menu);

  return menu;
}

function activate() {
  if (!mainWindow) {
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
}

app.on('activate', activate);
ipcMain.on('activate', activate);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('ready', () => {
  setupMenu();
  mainWindow = createMainWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  storage.get('vocabPath', (err, data) => {
    manageVisualVocabularyRepo(data, mainWindow);
  });

  runAutoUpdate(mainWindow);
});

ipcMain.on('file-to-process', (evt, file) => {
  const { meta, processed, filePath } = processFile(file);
  meta.shift(); // `ipc` irritatingly dedupes messages. See electron/electron#874.

  if (!newProjectWindow) {
    newProjectWindow = createNewProjectWindow();
    newProjectWindow.on('closed', () => {
      newProjectWindow = null;
      activate();
    });
    mainWindow.close();
  }

  newProjectWindow.webContents.on('did-finish-load', () => {
    newProjectWindow.webContents.send('incoming-data', {
      metadata: meta,
      path: filePath,
      processed,
    });
  });
});

ipcMain.on('build-project', buildProject);
ipcMain.on('post-build', postBuild);