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
