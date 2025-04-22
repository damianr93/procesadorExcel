const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { fileURLToPath } = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'excel-icon.png')
  });

  mainWindow.loadFile('index.html');
  // Descomentar para abrir herramientas de desarrollo
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Manejar selección de archivo Excel
ipcMain.handle('select-excel', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Manejar selección de carpeta destino
ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Manejar el proceso de un archivo Excel
ipcMain.handle('process-excel', async (event, { inputFile, outputFolder }) => {
  try {
    // Crear directorio excel2 temporalmente
    const tempDir = path.join(app.getPath('temp'), 'excel2');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Copiar archivo de entrada al directorio temporal
    const tempInputFile = path.join(tempDir, 'RptLiqTransp.xlsx');
    fs.copyFileSync(inputFile, tempInputFile);
    
    // Determinar la ruta correcta al script según el entorno
    let scriptPath;
    if (app.isPackaged) {
      // Si estamos en la aplicación empaquetada
      scriptPath = path.join(process.resourcesPath, './excelProcessor.js');
    } else {
      // Si estamos en desarrollo
      scriptPath = path.join(__dirname, './excelProcessor.js');
    }
    
    return new Promise((resolve, reject) => {
      const processExec = exec(`node "${scriptPath}"`, {
        cwd: app.getPath('temp') // Establecer directorio de trabajo
      });
      
      let output = '';
      let errorOutput = '';
      
      processExec.stdout.on('data', (data) => {
        output += data;
        mainWindow.webContents.send('process-log', data);
      });
      
      processExec.stderr.on('data', (data) => {
        errorOutput += data;
        mainWindow.webContents.send('process-error', data);
      });
      
      processExec.on('close', (code) => {
        if (code === 0) {
          // Si el proceso fue exitoso, copiar el archivo resultante a la carpeta destino
          const processedFile = path.join(tempDir, 'Archivo_procesado.xlsx');
          const destinationFile = path.join(outputFolder, 'Archivo_procesado.xlsx');
          
          try {
            fs.copyFileSync(processedFile, destinationFile);
            resolve({
              success: true,
              outputFile: destinationFile,
              log: output
            });
          } catch (err) {
            reject({
              success: false,
              error: `Error al copiar archivo procesado: ${err.message}`,
              log: output
            });
          }
        } else {
          reject({
            success: false,
            error: `El proceso falló con código: ${code}`,
            log: output,
            errorLog: errorOutput
          });
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});