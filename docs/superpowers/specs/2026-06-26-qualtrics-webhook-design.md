# Diseño: Webhook Qualtrics → Azure SQL Server

**Fecha:** 2026-06-26
**Survey objetivo:** Servicio Técnico (`SV_abEHkdGNsG9a3EG`)
**Tabla destino:** `APPGAC.EncuestasServicioTecnico`

---

## Objetivo

Capturar automáticamente cada respuesta completada de la encuesta NPS de Servicio Técnico de Qualtrics y persistirla en Azure SQL Server para análisis sin depender de exportaciones manuales.

---

## Arquitectura

Flujo **Enfoque A — Webhook ligero + fetch**:

1. Qualtrics detecta una respuesta completada en `SV_abEHkdGNsG9a3EG`.
2. Qualtrics hace `POST /webhook/qualtrics?secret=TOKEN` al backend FastAPI.
3. El backend valida el secret. Si es inválido → `401`.
4. El backend llama a `GET /API/v3/surveys/{surveyId}/responses/{responseId}` en Qualtrics.
5. Parsea todos los campos (QID9, embedded data, etc.).
6. Inserta una fila en `APPGAC.EncuestasServicioTecnico`.
7. Responde `200 OK` a Qualtrics.

El endpoint **no usa JWT** — usa su propio secret via query param, ya que Qualtrics Event Subscriptions no soporta headers personalizados.

---

## Tabla SQL Server

```sql
CREATE TABLE [APPGAC].[EncuestasServicioTecnico] (
    Id                    INT IDENTITY(1,1) PRIMARY KEY,
    FechaRecepcion        DATETIME2        NOT NULL DEFAULT GETDATE(),
    ResponseId            VARCHAR(50)      NOT NULL,
    SurveyId              VARCHAR(50)      NOT NULL,
    RecordedDate          DATETIME2        NULL,
    CalificacionNPS       TINYINT          NULL,
    GrupoNPS              VARCHAR(20)      NULL,
    AspectosBien          NVARCHAR(500)    NULL,
    ComentarioCliente     NVARCHAR(MAX)    NULL,
    OrdenDeServicio       VARCHAR(50)      NULL,
    FechaDeVisita         VARCHAR(20)      NULL,
    Anio                  SMALLINT         NULL,
    Mes                   TINYINT          NULL,
    Tienda                NVARCHAR(200)    NULL,
    Producto              NVARCHAR(300)    NULL,
    GrupoMaterial         NVARCHAR(200)    NULL,
    Servicio              VARCHAR(100)     NULL,
    SegmentoAsignado      VARCHAR(200)     NULL,
    Distrito              VARCHAR(100)     NULL,
    CodTecnico            VARCHAR(50)      NULL,
    Tecnico               NVARCHAR(200)    NULL,
    Empresa               VARCHAR(100)     NULL,
    Estado                VARCHAR(50)      NULL,
    VisitaRealizada       VARCHAR(5)       NULL,
    TrabajoEfectuado      VARCHAR(5)       NULL,
    Resultado             VARCHAR(50)      NULL,
    NuevaVisita           VARCHAR(20)      NULL,
    ObservacionTecnico    NVARCHAR(MAX)    NULL,
    MotivoCancelacion     VARCHAR(200)     NULL,
    RecipientEmail        VARCHAR(200)     NULL,
    ExternalDataReference VARCHAR(100)     NULL
);
```

**Política de duplicados:** INSERT siempre — si el mismo `ResponseId` llega dos veces, se insertan dos filas con `FechaRecepcion` distinta. No hay UPSERT.

---

## Endpoint

**Ruta:** `POST /webhook/qualtrics`
**Auth:** Query param `?secret=QUALTRICS_WEBHOOK_SECRET`
**Body Qualtrics (mínimo esperado):**
```json
{ "SurveyID": "SV_abEHkdGNsG9a3EG", "ResponseID": "R_xxx" }
```

**Respuestas:**
| Condición | HTTP | Acción |
|---|---|---|
| Secret inválido | 401 | Rechaza |
| SurveyID != ST survey | 200 | Log warning, no inserta |
| Fetch Qualtrics falla | 200 | Log error, no inserta |
| Insert SQL falla | 200 | Log error, no inserta |
| Éxito | 200 | Inserta fila |

Qualtrics requiere `200` para no reintentar; por eso los errores internos también devuelven 200.

---

## Archivos

| Archivo | Rol |
|---|---|
| `backend/webhook_qualtrics.py` | Módulo nuevo: lógica fetch + parse + insert |
| `backend/main.py` | Añadir ruta `POST /webhook/qualtrics` y llamar al módulo |
| `backend/.env` | Añadir `QUALTRICS_WEBHOOK_SECRET` y `QUALTRICS_SURVEY_ST` |
| `backend/registro_webhook.py` | Script one-shot para registrar/listar/eliminar la suscripción en Qualtrics |

---

## Variables de entorno

```env
QUALTRICS_BASE_URL=https://sole.yul1.qualtrics.com
QUALTRICS_API_TOKEN=u6lL6bS164amdvqFeqLv2l6TD5DYRtdLFSBtNovU
QUALTRICS_DIR_ID=POOL_1CsDYTWRqHFTxD3
QUALTRICS_WEBHOOK_SECRET=<uuid-generado-en-implementacion>
QUALTRICS_SURVEY_ST=SV_abEHkdGNsG9a3EG
```

---

## Mapeo de campos Qualtrics → SQL

| Campo Qualtrics | Columna SQL |
|---|---|
| `responseId` | `ResponseId` |
| `surveyId` | `SurveyId` |
| `values.recordedDate` | `RecordedDate` |
| `values.QID9` | `CalificacionNPS` |
| `labels.QID9_NPS_GROUP` | `GrupoNPS` |
| `labels.QID12` (join ", ") | `AspectosBien` |
| `values.QID24_TEXT` | `ComentarioCliente` |
| `values.ORDENDESERVICIO` | `OrdenDeServicio` |
| `values.FECHA_DE_VISITA` | `FechaDeVisita` |
| `values.ANIO` | `Anio` |
| `values.MESN` | `Mes` |
| `values.TIENDA` | `Tienda` |
| `values.PRODUCTO` | `Producto` |
| `values.GRUPO_MATERIAL_1` | `GrupoMaterial` |
| `values.SERVICIO` | `Servicio` |
| `values.SEGMENTO_ASIGNADO` | `SegmentoAsignado` |
| `values.DISTRITO` | `Distrito` |
| `values.COD_TECNICO` | `CodTecnico` |
| `values.TECNICO` | `Tecnico` |
| `values.EMPRESA` | `Empresa` |
| `values.ESTADO` | `Estado` |
| `values.VISITA_REALIZADA` | `VisitaRealizada` |
| `values.TRABAJO_EFECTUADO` | `TrabajoEfectuado` |
| `values.RESULTADO` | `Resultado` |
| `values.NUEVA_VISITA` | `NuevaVisita` |
| `values.OBSERVACION_TECNICO` | `ObservacionTecnico` |
| `values.MOTIVO_DE_DESINSTALACION` | `MotivoCancelacion` |
| `values.recipientEmail` | `RecipientEmail` |
| `values.externalDataReference` | `ExternalDataReference` |

---

## Script de registro (`registro_webhook.py`)

Soporta tres modos vía argumento CLI:
- `python registro_webhook.py --register` — crea la suscripción en Qualtrics
- `python registro_webhook.py --list` — lista suscripciones activas
- `python registro_webhook.py --delete <id>` — elimina una suscripción
- `python registro_webhook.py --test <responseId>` — dispara un POST local de prueba

---

## Limitaciones conocidas (v1)

- Si el insert SQL falla, el dato se pierde (no hay retry queue). Aceptable en v1.
- El endpoint requiere que el backend esté expuesto públicamente con HTTPS para que Qualtrics pueda llamarlo (EasyPanel / Nginx ya lo provee en producción).
- Qualtrics puede tardar hasta 60 segundos en disparar el webhook tras completar una respuesta.
