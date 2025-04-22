const { ipcRenderer } = require('electron');
const { shell } = require('electron');

// Elementos DOM
const selectFileBtn = document.getElementById('selectFileBtn');
const selectOutputBtn = document.getElementById('selectOutputBtn');
const processBtn = document.getElementById('processBtn');
const inputFileName = document.getElementById('inputFileName');
const outputFolder = document.getElementById('outputFolder');
const logContent = document.getElementById('logContent');
const resultModal = document.getElementById('resultModal');
const closeBtn = document.querySelector('.close-btn');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const openFileBtn = document.getElementById('openFileBtn');
const openFolderBtn = document.getElementById('openFolderBtn');

// Variables globales
let selectedFile = null;
let selectedOutputFolder = null;
let processedFilePath = null;

// Función para habilitar/deshabilitar botón de proceso
function updateProcessButton() {
  processBtn.disabled = !(selectedFile && selectedOutputFolder);
}

// Seleccionar archivo Excel
selectFileBtn.addEventListener('click', async () => {
  const filePath = await ipcRenderer.invoke('select-excel');
  if (filePath) {
    selectedFile = filePath;
    // Extraer solo el nombre del archivo
    const fileName = filePath.split(/[\\/]/).pop();
    inputFileName.textContent = fileName;
    updateProcessButton();
  }
});

// Seleccionar carpeta de salida
selectOutputBtn.addEventListener('click', async () => {
  const folderPath = await ipcRenderer.invoke('select-output-folder');
  if (folderPath) {
    selectedOutputFolder = folderPath;
    outputFolder.textContent = folderPath;
    updateProcessButton();
  }
});

// Procesar archivo Excel
processBtn.addEventListener('click', async () => {
  if (!selectedFile || !selectedOutputFolder) return;
  
  // Limpiar log y desactivar botón
  logContent.textContent = 'Iniciando procesamiento...\n';
  processBtn.disabled = true;
  processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
  
  try {
    const result = await ipcRenderer.invoke('process-excel', {
      inputFile: selectedFile,
      outputFolder: selectedOutputFolder
    });
    
    if (result.success) {
      processedFilePath = result.outputFile;
      showResultModal(true, 'Archivo procesado correctamente');
    } else {
      showResultModal(false, `Error: ${result.error}`);
    }
  } catch (error) {
    showResultModal(false, `Error inesperado: ${error.message || error}`);
  } finally {
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-cogs"></i> Procesar Excel';
  }
});

// Recibir logs del proceso
ipcRenderer.on('process-log', (event, message) => {
  logContent.textContent += message;
  // Auto-scroll hacia abajo
  logContent.scrollTop = logContent.scrollHeight;
});

// Recibir errores del proceso
ipcRenderer.on('process-error', (event, message) => {
  logContent.textContent += `ERROR: ${message}\n`;
  // Auto-scroll hacia abajo
  logContent.scrollTop = logContent.scrollHeight;
});

// Mostrar modal de resultado
function showResultModal(success, message) {
  resultTitle.textContent = success ? 'Procesamiento Completo' : 'Error en el Procesamiento';
  resultMessage.textContent = message;
  resultMessage.className = success ? 'success' : 'error';
  
  // Mostrar/ocultar botones según resultado
  openFileBtn.style.display = success ? 'block' : 'none';
  openFolderBtn.style.display = success ? 'block' : 'none';
  
  resultModal.style.display = 'block';
}

// Cerrar modal
closeBtn.addEventListener('click', () => {
  resultModal.style.display = 'none';
});

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (event) => {
  if (event.target === resultModal) {
    resultModal.style.display = 'none';
  }
});

// Abrir archivo procesado
openFileBtn.addEventListener('click', () => {
  if (processedFilePath) {
    shell.openPath(processedFilePath);
  }
});

// Abrir carpeta de salida
openFolderBtn.addEventListener('click', () => {
  if (selectedOutputFolder) {
    shell.openPath(selectedOutputFolder);
  }
});
