# Mi Dulce Tesoro · Semana 18

Prototipo integrador de Herramientas de Desarrollo Profesional TIC. El portal de la cafetería reúne un tablero de marzo de 2026, Dulce IA, monitoreo ambiental, cierre mensual y una ronda de capacitación. Los datos administrativos del TA4 son ficticios. Los cierres aprobados y las últimas 20 rondas se guardan por navegador y origen.

## Ejecutar

Desde esta carpeta con Node.js 22:

```sh
cp -n .env.example .env
npm start
```

Abrir http://localhost:4188. La API de salud está en `/health`. Se puede seleccionar otro puerto con `PORT=4190 npm start`.

### Dulce IA

En el archivo local `.env`, completar `DEEPSEEK_API_KEY=` y reiniciar el servidor. La clave se usa en el servidor y `.env` está excluido de Git. El modelo predeterminado es `deepseek-flash`. El contexto incluye los agregados de marzo y la lectura seleccionada. La respuesta indica su origen. Cuando la clave está vacía o el proveedor falla, el chat responde mediante reglas del prototipo y conserva disponibles el tablero y la aprobación. [API oficial de DeepSeek](https://api-docs.deepseek.com/api/create-chat-completion/)

El servicio web usa sus propias variables de entorno. Para activar allí DeepSeek, guardar la misma variable como secreto del entorno del sitio y volver a desplegar la versión. La copia local de `.env` solo se carga con `npm start`.

### Sensor y sala

- El tablero inicia con las muestras didácticas de Apertura y Tarde. Para leer el ESP32 real, añadir `ESP32_URL` con el origen HTTP del ESP32 en el `.env` del servidor que pueda alcanzarlo. La opción «ESP32 en vivo» consulta `/datos` y muestra su origen y hora de consulta. Los límites de 28 °C y 65 % HR son didácticos y requieren validación operativa.
- El servidor Node permite abrir una sala temporal con `/ronda/?sala=1`. El estado compartido se guarda en memoria. En el despliegue web están disponibles la ronda 3D individual y el recorrido guiado. La ronda 3D usa teclado y mouse, con WebGL cuando está disponible.

## Demostración

1. Confirmar S/ 113.00 de ventas, S/ 35.00 de gastos, S/ 78.00 de saldo y 4 tickets. Seleccionar **Tarde** y esperar **Solicitar inspección**.
2. Pulsar «Estado del almacén» en Dulce IA. La respuesta usa 29,4 °C, 71 % HR y el origen de la muestra.
3. Generar el borrador de marzo, revisar cifras y aprobar con una observación. Descargar el CSV y comprobar el bloqueo de otro cierre para el mismo mes. Para ensayar rechazo o entradas inválidas, usarlos antes de la aprobación o abrir un contexto privado del navegador.
4. En la ronda, elegir turno, probar el calentador y el humidificador, recoger la muestra, confirmar tres cajas y firmar. La decisión y los intentos aparecen en la bitácora del portal.

## Arquitectura y vínculo con la rúbrica

```mermaid
flowchart LR
    TA4["TA4 · Ventas y gastos ficticios"] --> API["API · resumen, validación y lectura"]
    SIM["Muestras de turnos"] --> API
    ESP["ESP32 · DHT11/PIR · /datos opcional"] --> API
    API --> TAB["Tablero"]
    API --> CHAT["Dulce IA"]
    CHAT <--> DS["DeepSeek con contexto del servidor"]
    API --> BOR["Borrador"]
    CHAT --> BOR
    BOR --> REV{"Revisión humana"}
    REV -->|Aprueba| CSV["CSV y cierre guardado"]
    REV -->|Rechaza| FIN["Fin sin exportación"]
    SIM --> XR["Ronda Three.js / recorrido guiado"]
    XR --> BIT["Bitácora del portal"]
    GH["GitHub privado"] --> CI["Actions · pruebas y paquete web"]
```

| Criterio final | Evidencia |
| --- | --- |
| Diagnóstico (10 %) | PDF 2–3. Cierre repetitivo, trazabilidad de versiones y decisión de almacén. |
| Arquitectura (15 %) | PDF 4 y diagrama. Una API vincula fuentes, tablero, asistente y reporte. |
| Integración (20 %) | PDF 5–9. DevOps, IA generativa, ingeniería de prompts, IoT, automatización de cierre y XR. El flujo web adapta las validaciones del OpenRPA de TA4. |
| Prototipo (20 %) | PDF 10, pasos de demostración y pruebas de aceptación del código. |
| Innovación (10 %) | El contexto ambiental se comparte con Dulce IA y la decisión se practica en 3D. El análisis de cierre y la aprobación quedan ligados al período. |
| Impacto (5 %) | PDF 11. Línea base académica y metas por medir en piloto. |
| Sustentación (10 %) | PDF 5–10: tecnologías, justificación, límites, demostración de tres minutos. |
| Informe final (10 %) | Entregable independiente de la presentación y el prototipo. |

## Verificación y entrega técnica

```sh
npm ci
npm test
npm run build:site
```

Las pruebas verifican aritmética en céntimos, validación de cierre, aprobación y duplicados, límites ambientales, adaptación al ESP32, chat por reglas, contrato de DeepSeek con un proveedor simulado y sincronización de sala. GitHub Actions ejecuta estas pruebas y genera el artefacto de despliegue. El paquete para Sites se compila como un Worker y usa la misma lógica de la API que Node. `/health` comprueba la disponibilidad del servidor. La demostración funcional comprueba el recorrido completo.

Fuentes académicas: TA1 (DevOps), TA2 (Dulce IA), documentación del ESP32 y flujo IoT, TA4 (OpenRPA, datos de prueba y proceso de cierre), Avance 5 (entorno y recorrido Three.js), y evaluación integradora de semana 18.
