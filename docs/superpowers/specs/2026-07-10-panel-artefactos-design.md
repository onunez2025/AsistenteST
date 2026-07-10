# Diseño: Panel de artefactos (gráficos, Excel, PDF y reportes largos)

**Fecha:** 2026-07-10
**Origen:** Oscar quiere que los archivos generados (Excel, gráficos, PDF) y los reportes/tablas largas se muestren como una tarjeta compacta en el chat que, al hacer clic, abre una vista previa en un panel lateral derecho — con opciones de exportar/copiar/descargar desde ahí — igual al patrón de "artifacts" de Claude.ai.

---

## Objetivo

Sacar del cuerpo del mensaje todo lo que hoy lo hace largo o pesado de leer (gráficos incrustados con iframe, tablas grandes de markdown, reportes de texto extensos) y reemplazarlo por una tarjeta corta y clickeable. El contenido completo vive en un panel lateral que no tapa la conversación, con acciones de exportación propias de cada tipo de contenido.

No es un rediseño de cómo se genera el contenido — los gráficos, Excel y PDF se siguen generando exactamente igual que hoy (mismas herramientas, mismas URLs). Lo que cambia es **dónde y cómo se muestran**.

---

## Arquitectura

**Enfoque elegido: bloque marcado dentro del mensaje, sin cambios de base de datos.**

Reutiliza el mismo patrón que ya funciona en producción para `preguntar_usuario`: el contenido se guarda como texto plano dentro de `KIRA.Messages.Content` (cero migraciones), y el frontend lo extrae con una expresión regular para decidir qué renderizar.

Dos fuentes de artefactos, tratadas distinto:

1. **Reportes y tablas largas** (contenido que la IA redacta): se envuelven en un bloque marcado ` ```artefacto `, con una primera línea de metadatos JSON y el resto como contenido markdown normal. La IA decide cuándo usarlo según una regla nueva del system prompt (ver sección 5).
2. **Archivos generados** (Excel, gráfico, PDF): la IA no cambia nada — sigue emitiendo los mismos marcadores de siempre (`[Descargar Reporte Excel](...)`, `[EmbedChart:...]`, `[EmbedPDF:...]`). Lo único que cambia es el frontend: en vez de incrustarlos inline, los convierte en tarjeta. Esto significa que **las conversaciones viejas también se benefician** automáticamente, sin reprocesar nada.

```
Mensaje de la IA llega con:
  - marcador [EmbedChart:...] / [Descargar Reporte Excel](...) / [EmbedPDF:...]  → tarjeta de archivo
  - bloque ```artefacto { "tipo": "reporte", "titulo": "..." } ...contenido...```  → tarjeta de reporte/tabla
        │
        ▼
Frontend extrae cada uno con regex, los saca del texto visible del mensaje
        │
        ▼
Renderiza una tarjeta compacta por cada artefacto encontrado (icono + título + contexto)
        │
        ▼
Usuario hace clic en una tarjeta
        │
        ▼
Se abre/actualiza el panel lateral derecho con ese contenido
        │
        ▼
Panel trae sus propias acciones (copiar, descargar, abrir) según el tipo
```

---

## 1. El bloque `artefacto` (reportes y tablas)

Cuando la IA decide que una respuesta es un reporte largo o una tabla grande, la envuelve así:

````
Encontré 42 fugas de gas confirmadas en junio 2026, cruzando el comentario
técnico con la categoría de producto. Detalle completo abajo.

```artefacto
{"tipo": "reporte", "titulo": "Fugas de gas confirmadas — junio 2026"}
## Resumen ejecutivo
...todo el contenido markdown completo del reporte...
| CAS | Fugas confirmadas |
|-----|---|
| ... | ... |
```
````

- La primera línea dentro del bloque es siempre un JSON de una sola línea: `{"tipo": "reporte"|"tabla", "titulo": "..."}`.
- El resto del bloque es markdown normal (se renderiza igual que el resto del mensaje, solo que dentro del panel en vez de en el chat).
- El texto **fuera** del bloque (antes o después) es el resumen corto que se lee en el chat — la IA siempre debe dejar 2-3 líneas ahí.
- `tipo: "tabla"` vs `"reporte"` solo cambia el ícono de la tarjeta (📈 vs 📄); el renderizado es el mismo (markdown, la tabla ya se ve bien con el estilo actual de tablas).

## 2. Detección durante streaming

Mientras el mensaje se está generando token por token, el frontend detecta cuándo se abrió un bloque ` ```artefacto ` que todavía no se cerró, y en ese tramo muestra una tarjeta de estado:

> ⏳ Generando: *Fugas de gas confirmadas — junio 2026...*

sin mostrar el JSON ni el markdown crudo mientras llega. Cuando el bloque cierra (aparece el ` ``` ` de cierre), la tarjeta pasa a su estado final clickeable.

Esto reutiliza la misma idea que ya existe para el streaming normal (`renderStreamingBubble`), solo que ahora tiene que reconocer el bloque a medio construir, no solo texto plano.

## 3. La tarjeta en el chat

Reemplaza tanto el iframe/embed inline actual como el markdown crudo de reportes largos:

- Ícono según tipo: 📈 gráfico interactivo, 📄 reporte, 📊 tabla, 📗 Excel, 📕 PDF.
- Título (el de los metadatos del bloque, o el nombre del archivo para Excel/PDF/gráfico).
- Línea de contexto breve: "Generado ahora", tamaño del archivo, o cantidad de filas.
- Toda la tarjeta es un solo elemento clickeable (no hay que acertarle a un botón chiquito).
- Varios artefactos en un mismo mensaje = varias tarjetas apiladas, cada una independiente.
- Mientras el usuario no ha abierto el panel en la conversación actual, ninguna tarjeta aparece "activa" — el primer clic abre el panel; los clics siguientes cambian su contenido.

## 4. El panel lateral

- **Desktop:** se abre a la derecha empujando el área de chat hacia la izquierda (ambos conviven, ninguno tapa al otro) — igual que Claude.ai. Ancho fijo razonable (~420-480px), el chat se queda con el resto.
- **Mobile:** el panel ocupa toda la pantalla, con un botón "← Volver" en vez de convivir lado a lado (no hay espacio para los dos).
- **Header del panel:** título del artefacto + botón cerrar (X) + acciones según tipo:

  | Tipo | Acciones |
  |------|----------|
  | Reporte / Tabla | Copiar texto, Descargar PDF |
  | Excel | Descargar, Abrir en pestaña nueva |
  | Gráfico | Abrir en pestaña nueva, Exportar PNG (ya existe hoy), Descargar HTML |
  | PDF | Descargar, Abrir en pestaña nueva |

- **Un solo panel a la vez**: si el usuario hace clic en otra tarjeta (de este mensaje o de otro) mientras el panel está abierto, el contenido se reemplaza — no se apilan paneles ni pestañas dentro del panel.
- **Contenido según tipo:**
  - *Reporte/Tabla*: el markdown ya parseado, con tipografía más generosa que en el chat (es una vista de lectura, no una burbuja de conversación).
  - *Gráfico*: el mismo iframe que hoy se incrusta inline, ahora dentro del panel.
  - *PDF*: el mismo iframe que hoy se incrusta inline, ahora dentro del panel.
  - *Excel*: **vista previa real del contenido** (no solo ficha + descarga) — se parsea en el navegador con una librería liviana (SheetJS/`xlsx`, sin tocar el backend, reutilizando la URL del Excel que ya se genera hoy) y se muestra como tabla HTML, primeras ~100 filas.

## 5. Exportar desde el panel (reportes/tablas)

- **Copiar**: copia el texto markdown-a-texto-plano al portapapeles (igual que el botón "Copiar respuesta" que ya existe para mensajes).
- **Descargar PDF**: se genera en el momento — nuevo endpoint de backend que recibe el markdown del artefacto y lo convierte a PDF con formato limpio (títulos, tablas, listas).

  El proyecto ya usa `pymupdf` (`fitz`), pero solo para **leer** PDFs adjuntos — no hay ninguna librería de generación de PDF con formato desde markdown/HTML. Esto es una dependencia nueva. Dos caminos, a decidir en el plan:
  1. `pymupdf` ya trae una clase `Story` (desde 1.24) capaz de convertir HTML simple a un PDF con paginación — evaluar primero, porque no agrega ninguna dependencia nueva (el paquete ya está instalado).
  2. Si el formato que produce `Story` no alcanza (tablas complejas, estilos), agregar `weasyprint` (HTML/CSS → PDF, requiere librerías de sistema Pango/Cairo — hay que agregarlas al Dockerfile).

  El flujo en cualquier caso es: markdown del artefacto → HTML (reutilizando `parseMarkdown` del lado backend o una conversión equivalente en Python) → PDF.

## 6. Regla nueva del system prompt

Se agrega una regla (mismo lugar que las reglas de `preguntar_usuario` y `generar_reporte_excel`) indicando:

- Envolver en ` ```artefacto ` cuando la respuesta sea un reporte de más de ~200-300 palabras, o una tabla de más de 8 filas.
- Siempre dejar un resumen de 2-3 líneas fuera del bloque.
- No usarlo para respuestas cortas, confirmaciones, ni para las tarjetas de `preguntar_usuario` (mecanismo aparte, no se toca).

## 7. Explícitamente fuera de esta versión

- Sin edición del contenido de un artefacto desde el panel (solo lectura).
- Sin historial de versiones.
- Sin exportar reportes a Word — solo PDF.
- Vista previa de Excel de solo lectura (primeras ~100 filas, valores, sin fórmulas/filtros).
- Sin compartir/link directo a un artefacto puntual.
- Las imágenes adjuntas por el usuario (fotos) no cambian — esto aplica solo a archivos generados por la IA y a reportes/tablas largas.
- Sin panel para las tarjetas de `preguntar_usuario` (esas se quedan igual, inline en el chat).

---

## Riesgo conocido a validar en el plan

El proyecto ya tiene un anti-patrón identificado (CSS con reglas duplicadas causando bugs silenciosos — ver el bug del sidebar en móvil corregido esta semana). El plan de implementación debe evitar agregar más reglas CSS al `App.css` global existente para los componentes nuevos (tarjeta, panel) si es razonable aislarlos; si no es razonable dado el resto del proyecto, al menos no duplicar selectores ya existentes.
