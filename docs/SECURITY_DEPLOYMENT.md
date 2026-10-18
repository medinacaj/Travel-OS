# Verificación P1 de seguridad y despliegue

## Alcance de las pruebas
El workflow `quality.yml` comprueba que el esquema SQL incluya RLS de tablas administrativas y políticas de escritura, y ejecuta `npm run build`. **No es una prueba real de RLS**: solo el proyecto de base de datos con el esquema desplegado puede probar autorizaciones.

## Criterios para producción
- Aplicar `supabase/schema.sql` en el proyecto autorizado; ejecutar consultas como visitante y admin, y comprobar que gastos, reservas y documentos jamás sean visibles a visitantes.
- Deshabilitar registro público de cuentas y crear explícitamente una persona administradora.
- Definir URL y clave publicable de Supabase en variables de despliegue; nunca service_role.
- Elegir una única URL HTTPS canónica, verificar `SITE_URL`, canonical y sitemap. No considerar que un build local a la URL de ejemplo equivale a publicar.
- Verificar GitHub Pages, sincronización entre dos dispositivos, backup/restauración, cierre de sesión y un enlace compartido sin permisos de edición.
- Revisar la sesión de navegador y exposición a XSS antes de guardar contenido sensible.

**Bloqueos no resueltos:** el único proyecto Supabase visible en la cuenta conectada está inactivo y no existe prueba independiente de que pertenezca a Travel-OS. No se ha modificado ninguna base de datos de producción.

## Comprobación continua de interfaz P1 (18-10-2026)
El workflow `quality.yml` ejecuta ahora las suites Playwright completas en Chromium: navegación, pantallas móviles (390 px), permisos y sincronización simulados mediante `tests/e2e.py` y `tests/e2e_cloud.py`. Todas las dependencias de mapas y clima de prueba son interceptadas/servicios ficticios; no se hacen pruebas sobre cuentas ni reservas reales.

**Limitación:** pasar E2E con servidor Supabase simulado **no certifica** las políticas de seguridad de una base real, copias de respaldo, ni disponibilidad del despliegue. Esos controles requieren entorno autorizado y evidencia adicional.
