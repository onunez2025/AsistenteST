# Variables de entorno requeridas en EasyPanel

## NUEVA variable obligatoria — ALLOWED_ORIGINS

Agrega esta variable al servicio `backend` en EasyPanel con el dominio real de tu app:

```
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
```

Si el frontend y backend están en el mismo dominio (típico en EasyPanel), puede ser:
```
ALLOWED_ORIGINS=https://asistenteST.tu-dominio.com
```

## JWT_SECRET — ahora es OBLIGATORIA

Antes tenía un valor de fallback en el código. Ahora el servidor NO arranca si esta variable está vacía.
Asegúrate de que esté configurada en EasyPanel con un valor secreto fuerte (mínimo 32 caracteres aleatorios).

Ejemplo de generación (en cualquier terminal Linux/Mac):
```bash
openssl rand -hex 32
```

## Resumen de todas las variables requeridas

| Variable | Descripción |
|---|---|
| SQL_SERVER | Servidor Azure SQL |
| SQL_DATABASE | Nombre de la base de datos |
| SQL_USER | Usuario SQL |
| SQL_PASSWORD | Contraseña SQL |
| SAP_BASE_URL | URL base de SAP C4C OData |
| SAP_USER | Usuario SAP |
| SAP_PASSWORD | Contraseña SAP |
| DEEPSEEK_API_KEY | API key de DeepSeek |
| AZURE_STORAGE_CONNECTION_STRING | Cadena de conexión Azure Blob |
| AZURE_STORAGE_CONTAINER | Nombre del contenedor (default: stecnico) |
| JWT_SECRET | **OBLIGATORIA** — clave secreta JWT (min 32 chars) |
| ALLOWED_ORIGINS | **NUEVA** — dominios permitidos para CORS |
| QUALTRICS_BASE_URL | URL base de Qualtrics |
| QUALTRICS_API_TOKEN | Token API de Qualtrics |
| QUALTRICS_DIR_ID | ID de directorio Qualtrics |
