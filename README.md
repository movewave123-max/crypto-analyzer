# Análisis de Movimiento Direccional - ETHUSDT

Aplicación web que mide cuánto se mueve el precio de ETH/USDT en una dirección antes de retroceder un 0.4%, evaluando tanto movimientos alcistas como bajistas de forma continua.

## 🚀 Características

- **Medición continua**: No depende de timeframes, mide en tiempo real
- **Umbral de retroceso**: 0.4% (configurable en el servidor)
- **Estadísticas completas**: Promedio, máximo, mínimo y duración de movimientos
- **Persistencia en servidor**: Los datos se guardan y persisten entre recargas
- **Multi-dispositivo**: Todos los clientes ven los mismos datos
- **Tiempo real**: Actualización cada segundo vía WebSocket

## 📦 Instalación

### 1. Instalar dependencias del servidor

```bash
npm install express ws cors
```

### 2. Compilar el frontend

```bash
npm run build
```

### 3. Iniciar el servidor

```bash
node server.cjs
```

El servidor se iniciará en el puerto 3000 por defecto.

## 🌐 Uso

1. Abre tu navegador en `http://localhost:3000`
2. La aplicación comenzará a medir los movimientos direccionales
3. Los datos se sincronizan en tiempo real para todos los clientes conectados
4. Puedes ver:
   - Movimiento actual en progreso
   - Estadísticas de movimientos alcistas y bajistas
   - Historial de los últimos 10 movimientos
   - Tiempo transcurrido desde el inicio

## 🔄 Persistencia de datos

- Los datos se guardan automáticamente en `server-data.json` cada 10 segundos
- Al reiniciar el servidor, los datos se cargan desde el archivo
- Al recargar la página, los datos persisten porque están en el servidor
- Todos los clientes ven los mismos datos (sincronización vía WebSocket)

## 🎯 Cómo funciona

1. **Detección de dirección**: Cuando el precio se mueve 0.01% o más desde el inicio, se establece una dirección (alcista o bajista)

2. **Seguimiento del extremo**: Se trackea el precio más alto (en movimientos alcistas) o más bajo (en movimientos bajistas) alcanzado

3. **Detección de reversa**: Cuando el precio retrocede 0.4% desde el extremo, se considera que el movimiento ha terminado

4. **Registro**: Se guarda cuánto se movió el precio, la duración, y se actualizan las estadísticas

5. **Nuevo ciclo**: Inmediatamente comienza a trackear en la dirección contraria

## 📊 Ejemplo

```
MOVIMIENTO ALCISTA:
1. Precio en $2,500 → comienza a subir
2. Sube a $2,510, $2,520, $2,530 (+1.2%)
3. Retrocede a $2,520 (-0.4% desde $2,530)
4. ✅ Registra: Movimiento alcista de +1.2%
5. Comienza a trackear en dirección bajista

MOVIMIENTO BAJISTA:
1. Precio en $2,520 → comienza a bajar
2. Baja a $2,510, $2,500, $2,490 (-1.2%)
3. Retrocede a $2,500 (+0.4% desde $2,490)
4. ✅ Registra: Movimiento bajista de -1.2%
5. Comienza a trackear en dirección alcista
```

## 🛠️ Configuración

### Cambiar el umbral de retroceso

Edita `server.cjs` y modifica la línea:

```javascript
const REVERSAL_THRESHOLD = 0.4; // Cambia este valor (en porcentaje)
```

### Cambiar el puerto

```bash
PORT=8080 node server.cjs
```

## 📁 Estructura del proyecto

```
├── server.cjs                    # Servidor backend (Express + WebSocket)
├── server-data.json              # Datos persistentes (se crea automáticamente)
├── package.json                  # Dependencias del frontend
├── package.server.json           # Dependencias del servidor
├── src/
│   ├── App.tsx                   # Componente principal
│   ├── main.tsx                  # Punto de entrada
│   ├── index.css                 # Estilos Tailwind
│   ├── hooks/
│   │   └── useBinanceData.ts    # Hook para WebSocket
│   ├── utils/
│   │   └── directionalMovement.ts # Lógica de cálculo
│   └── components/
│       ├── PriceHeader.tsx       # Header con precio
│       └── DirectionalDisplay.tsx # Display principal
└── dist/                         # Build del frontend
```

## 🔄 APIs del servidor

- `GET /api/state` - Obtener estado actual
- `POST /api/reset` - Resetear todos los datos

## 💡 Casos de uso para trading

Esta métrica te ayuda a entender:

1. **Fuerza de los movimientos**: Cuánto suele moverse el precio antes de retroceder
2. **Asimetría del mercado**: Si los movimientos alcistas son más fuertes que los bajistas (o viceversa)
3. **Duración típica**: Cuánto tiempo duran los movimientos en cada dirección
4. **Detección de tendencias**: Si hay más movimientos en una dirección que en otra

## 📝 Notas

- Los datos se guardan en el servidor, no en el navegador
- Todos los clientes ven los mismos datos
- El tiempo de inicio se establece cuando arranca el servidor
- El umbral de retroceso es configurable
- La aplicación está optimizada para funcionar 24/7

## 🐛 Troubleshooting

### El servidor no inicia
- Verifica que las dependencias estén instaladas: `npm install express ws cors`
- Verifica que el puerto 3000 no esté en uso

### Los datos se reinician al recargar
- Verifica que el servidor esté corriendo
- Verifica que el archivo `server-data.json` tenga permisos de escritura

### WebSocket no conecta
- Verifica que el servidor esté corriendo
- Revisa la consola del navegador para ver errores

## 📄 Licencia

MIT
