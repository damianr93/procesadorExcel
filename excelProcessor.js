const XlsxPopulate = require('xlsx-populate');
const fs = require('fs');
const path = require('path');

const procesarExcelTransporte = async () => {
  const archivoRuta = path.join(process.cwd(), "excel2", "RptLiqTransp.xlsx");

  if (!fs.existsSync(archivoRuta)) {
    const error = new Error(`Archivo no encontrado: ${archivoRuta}`);
    error.code = 'FILE_NOT_FOUND';
    throw error;
  }

  try {
    console.log("🔄 Procesando archivo Excel...");

    // Cargar el archivo Excel
    const workbook = await XlsxPopulate.fromFileAsync(archivoRuta).catch(err => {
      const error = new Error(`Error al cargar el archivo Excel: ${err.message}`);
      error.originalError = err;
      error.code = 'EXCEL_LOAD_ERROR';
      throw error;
    });

    // Obtener la primera hoja
    const hojaOrigen = workbook.sheet(0);
    if (!hojaOrigen) {
      const error = new Error('No se encontró la primera hoja en el archivo Excel');
      error.code = 'SHEET_NOT_FOUND';
      throw error;
    }

    // Obtener todos los datos como una matriz
    const datos = hojaOrigen.usedRange().value();
    if (!datos || datos.length < 2) {
      const error = new Error('El archivo Excel no contiene datos suficientes');
      error.code = 'INSUFFICIENT_DATA';
      throw error;
    }

    // Obtener encabezados (primera fila)
    const encabezadosOriginales = datos[0];

    // Matrices para almacenar las filas filtradas
    const filasLince = [encabezadosOriginales];
    const filasBateaLince = [encabezadosOriginales];
    const filasTerceros = [encabezadosOriginales];
    const filasOtras = [encabezadosOriginales];

    // Procesar cada fila de datos (excluyendo la fila de encabezados)
    // Procesar cada fila de datos (excluyendo la fila de encabezados)
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];

      // Verificar si la fila tiene datos
      if (!fila || fila.length === 0) continue;

      // Columna J es el índice 9 (ANULADO o no)
      const valorColumnaJ = fila[9];
      const esAnulado = valorColumnaJ && String(valorColumnaJ).toUpperCase() === "ANULADO";

      // Columna C es el índice 2 (nombre del cliente)
      const valorColumnaC = fila[9];
      const tieneCliente = valorColumnaC !== null && valorColumnaC !== undefined && valorColumnaC !== "";

      // Si no tiene cliente, saltamos esta fila
      if (!tieneCliente) continue;

      // Si está anulado, saltamos esta fila para todas las hojas
      if (esAnulado) continue;

      // Columna M es el índice 12
      const valorColumnaM = fila[12];

      // Columna R es el índice 17
      const valorColumnaR = fila[17];

      // Columna S es el índice 18
      const valorColumnaS = fila[18];

      // Calcular la división S/R si ambos valores existen y son números
      let division = null;
      if (typeof valorColumnaR === 'number' && typeof valorColumnaS === 'number' && valorColumnaR !== 0) {
        division = valorColumnaS / valorColumnaR;
      }

      // Verificar si tiene comisión igual a 0
      const comisionCero = typeof valorColumnaS === 'number' && valorColumnaS === 0;

      // Variables para controlar si la fila fue asignada a alguna categoría
      let asignadaALince = false;
      let asignadaABateaLince = false;
      let asignadaATerceros = false;

      // Criterios para la hoja LINCE:
      // 1. El valor en columna M contiene "LINCE" O
      // 2. Comisión (columna S) es igual a 0
      if (
        (valorColumnaM && String(valorColumnaM).toUpperCase().includes("LINCE")) ||
        comisionCero
      ) {
        filasLince.push(fila);
        asignadaALince = true;
      }
      // Criterios para la hoja Batea_lince:
      // La división de columna S / columna R está entre 0.24 y 0.26
      else if (division !== null && division >= 0.24 && division <= 0.269) {
        filasBateaLince.push(fila);
        asignadaABateaLince = true;
      }
      // Criterios para la hoja Terceros:
      // La división de columna S / columna R está entre 0.06 y 0.12
      else if (division !== null && division >= 0.059 && division <= 0.129) {
        filasTerceros.push(fila);
        asignadaATerceros = true;
      }

      // Si no fue asignada a ninguna de las categorías anteriores, va a OTRAS
      if (!asignadaALince && !asignadaABateaLince && !asignadaATerceros) {
        filasOtras.push(fila);
      }
    }

    // Función para verificar si una columna está vacía en todas las filas
    const esColumnaVacia = (datos, indiceColumna) => {
      // Empezamos desde 1 para ignorar los encabezados
      for (let i = 1; i < datos.length; i++) {
        const fila = datos[i];
        if (fila && fila[indiceColumna] !== null && fila[indiceColumna] !== undefined && fila[indiceColumna] !== "") {
          return false;
        }
      }
      return true;
    };

    // Columnas a verificar y potencialmente eliminar (D, E, F, H, K, L, N y O)
    // Convertimos las letras de columna a índices basados en 0
    const columnasARevisar = [
      { letra: 'D', indice: 3 },
      { letra: 'E', indice: 4 },
      { letra: 'F', indice: 5 },
      { letra: 'H', indice: 7 },
      { letra: 'K', indice: 10 },
      { letra: 'L', indice: 11 },
      { letra: 'N', indice: 13 },
      { letra: 'O', indice: 14 }
    ];

    // Función para agrupar datos por columna H y sumar columnas D, J, K
    const agruparDatos = (datos) => {
      const grupos = {};

      // Índices de las columnas a sumar
      const indiceColumnaH = 7; // Columna H (agrupación)
      const indiceColumnaD = 3; // Columna D (distancia)
      const indiceColumnaJ = 9; // Columna J (flete)
      const indiceColumnaK = 10; // Columna K (comisión)

      // Procesar cada fila (empezando desde 1 para omitir encabezados)
      for (let i = 1; i < datos.length; i++) {
        const fila = datos[i];
        if (!fila || fila.length === 0) continue;

        const claveAgrupacion = fila[indiceColumnaH] || 'SIN_CLASIFICAR';
        const valorD = typeof fila[indiceColumnaD] === 'number' ? fila[indiceColumnaD] : 0;
        const valorJ = typeof fila[indiceColumnaJ] === 'number' ? fila[indiceColumnaJ] : 0;
        const valorK = typeof fila[indiceColumnaK] === 'number' ? fila[indiceColumnaK] : 0;

        if (!grupos[claveAgrupacion]) {
          grupos[claveAgrupacion] = {
            clave: claveAgrupacion,
            totalD: 0,
            totalJ: 0,
            totalK: 0,
            conteoViajes: 0 // Inicializamos el contador
          };
        }

        grupos[claveAgrupacion].totalD += valorD;
        grupos[claveAgrupacion].totalJ += valorJ;
        grupos[claveAgrupacion].totalK += valorK;
        grupos[claveAgrupacion].conteoViajes += 1; // Incrementamos el contador
      }

      // Convertir a array y calcular división K/J
      return Object.values(grupos).map(item => {
        const division = item.totalJ !== 0 ? item.totalK / item.totalJ : null;
        return {
          ...item,
          division
        };
      });
    };

    // Procesar todas las hojas
    const hojasProcesadas = [];
    const hojasAgrupadas = [];

    try {
      const hojasConfig = [
        { nombre: "LINCE", datos: filasLince },
        { nombre: "Batea_lince", datos: filasBateaLince },
        { nombre: "Terceros", datos: filasTerceros },
        { nombre: "OTRAS", datos: filasOtras }
      ];

      // Primero procesamos las hojas originales
      for (const { nombre, datos } of hojasConfig) {
        try {
          // Crear o reemplazar la hoja
          let hoja = workbook.sheet(nombre);
          if (!hoja) {
            hoja = workbook.addSheet(nombre);
          } else {
            // Si la hoja ya existe, limpiamos su contenido
            hoja.usedRange().clear();
          }

          // Encontrar columnas vacías
          const columnasVacias = columnasARevisar
            .filter(col => esColumnaVacia(datos, col.indice))
            .map(col => col.indice)
            .sort((a, b) => b - a); // Ordenar de manera descendente para no afectar los índices al eliminar

          console.log(`📊 Columnas vacías encontradas en ${nombre}:`,
            columnasVacias.map(i => String.fromCharCode(65 + i)).join(", ") || "Ninguna");

          // Crear una copia de los datos sin las columnas vacías
          const datosFiltrados = datos.map(fila => {
            if (!fila) return [];

            const filaFiltrada = [...fila];
            // Eliminar columnas vacías de derecha a izquierda para no afectar los índices
            columnasVacias.forEach(indice => {
              filaFiltrada.splice(indice, 1);
            });
            return filaFiltrada;
          });

          // Rellenar la hoja con los datos filtrados
          for (let i = 0; i < datosFiltrados.length; i++) {
            const fila = datosFiltrados[i];
            for (let j = 0; j < fila.length; j++) {
              hoja.cell(i + 1, j + 1).value(fila[j]);
            }
          }

          hojasProcesadas.push(nombre);

          // Ahora creamos la hoja agrupada correspondiente
          if (datos.length > 1) { // Solo si hay datos (más allá del encabezado)
            const nombreAgrupado = `${nombre}_agrupados`;
            const datosAgrupados = agruparDatos(datosFiltrados);

            // Crear hoja agrupada
            let hojaAgrupada = workbook.sheet(nombreAgrupado);
            if (!hojaAgrupada) {
              hojaAgrupada = workbook.addSheet(nombreAgrupado);
            } else {
              hojaAgrupada.usedRange().clear();
            }

            // Escribir encabezados
            hojaAgrupada.cell(1, 1).value("Clave");
            hojaAgrupada.cell(1, 2).value("Viajes Totales"); // Nueva columna
            hojaAgrupada.cell(1, 3).value("Total Distancia (D)");
            hojaAgrupada.cell(1, 4).value("Total Flete (J)");
            hojaAgrupada.cell(1, 5).value("Total Comisión (K)");
            hojaAgrupada.cell(1, 6).value("División K/J");

            // Escribir datos agrupados
            datosAgrupados.forEach((item, index) => {
              const row = index + 2; // +2 porque la fila 1 es el encabezado
              hojaAgrupada.cell(row, 1).value(item.clave);
              hojaAgrupada.cell(row, 2).value(item.conteoViajes); // Nueva columna
              hojaAgrupada.cell(row, 3).value(item.totalD);
              hojaAgrupada.cell(row, 4).value(item.totalJ);
              hojaAgrupada.cell(row, 5).value(item.totalK);
              hojaAgrupada.cell(row, 6).value(item.division);
            });

            hojasAgrupadas.push(nombreAgrupado);
          }
        } catch (err) {
          console.error(`Error al procesar la hoja ${nombre}:`, err);
          throw new Error(`Error al procesar la hoja ${nombre}: ${err.message}`);
        }
      }
    } catch (err) {
      const error = new Error(`Error al procesar las hojas: ${err.message}`);
      error.code = 'SHEET_PROCESSING_ERROR';
      error.processedSheets = hojasProcesadas;
      throw error;
    }

    // Función para generar un nombre de archivo único
    const generarNombreUnico = (rutaBase) => {
      const dir = path.dirname(rutaBase);
      const ext = path.extname(rutaBase);
      const base = path.basename(rutaBase, ext);
      const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');

      return path.join(dir, `${base}_${timestamp}${ext}`);
    };

    // Función para verificar si un archivo está bloqueado
    const estaArchivoDisponible = (ruta) => {
      try {
        // Intenta abrir y cerrar inmediatamente el archivo
        const fd = fs.openSync(ruta, 'r+');
        fs.closeSync(fd);
        return true;
      } catch (error) {
        return false;
      }
    };

    // Guardar el archivo modificado
    let rutaDestino = path.join(process.cwd(), "excel2", "Archivo_procesado.xlsx");

    // Verificar si el archivo está bloqueado
    if (fs.existsSync(rutaDestino) && !estaArchivoDisponible(rutaDestino)) {
      console.log(`⚠️ El archivo '${rutaDestino}' está bloqueado. Generando nombre alternativo...`);
      rutaDestino = generarNombreUnico(rutaDestino);
      console.log(`🔄 Se utilizará el nombre alternativo: ${rutaDestino}`);
    }

    try {
      await workbook.toFileAsync(rutaDestino);
    } catch (err) {
      // Si hay un error al guardar, intentar con un nombre alternativo
      if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
        console.log(`⚠️ Error al guardar (${err.code}). Intentando con nombre alternativo...`);
        rutaDestino = generarNombreUnico(rutaDestino);
        console.log(`🔄 Intentando guardar como: ${rutaDestino}`);
        await workbook.toFileAsync(rutaDestino);
      } else {
        throw err;
      }
    }

    console.log(`✅ Archivo procesado guardado en: ${rutaDestino}`);
    console.log(`   - Filas en hoja LINCE: ${filasLince.length - 1}`);
    console.log(`   - Filas en hoja Batea_lince: ${filasBateaLince.length - 1}`);
    console.log(`   - Filas en hoja Terceros: ${filasTerceros.length - 1}`);
    console.log(`   - Filas en hoja OTRAS: ${filasOtras.length - 1}`);
    console.log(`   - Hojas agrupadas creadas: ${hojasAgrupadas.join(', ')}`);

    return {
      success: true,
      rutaDestino,
      estadisticas: {
        totalFilasLince: filasLince.length - 1,
        totalFilasBateaLince: filasBateaLince.length - 1,
        totalFilasTerceros: filasTerceros.length - 1,
        totalFilasOtras: filasOtras.length - 1,
        hojasAgrupadas: hojasAgrupadas.length
      }
    };

  } catch (error) {
    console.error("❌ ERROR AL PROCESAR EL ARCHIVO:", error);

    // Convertimos el error a un objeto serializable para Electron
    return {
      success: false,
      error: {
        message: error.message || 'Error desconocido',
        code: error.code || 'UNKNOWN_ERROR',
        stack: error.stack || '',
        details: JSON.stringify(error, Object.getOwnPropertyNames(error))
      }
    };
  }
};

// Si estamos ejecutando este archivo directamente (no como un módulo)
if (require.main === module) {
  procesarExcelTransporte()
    .then(resultado => {
      if (resultado.success) {
        console.log("Proceso completado exitosamente.");
        process.exit(0);
      } else {
        console.error("El proceso falló:", resultado.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error("Error inesperado:", error);
      process.exit(1);
    });
}

// Exportamos la función para que pueda ser usada por Electron
module.exports = procesarExcelTransporte;