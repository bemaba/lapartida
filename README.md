# La Partida

App web para gestionar fichajes, pausas y turnos de un equipo de cocina.

MVP inicial en Next.js + TypeScript. En esta fase utiliza datos ficticios; todavía no incluye autenticación real ni base de datos y no debe usarse para registrar jornadas reales.

## Desarrollo local

```bash
npm install
npm run dev
```

## Configuración

Consulta `.env.example` para las variables de entorno previstas para la integración futura con Supabase. No subas secretos ni datos reales de empleados al repositorio.


## Base de datos como código (Supabase)

Las migraciones versionadas se guardan en `supabase/migrations/`. No edites la base de datos de producción directamente sin crear una migración correspondiente.

### Preparación local
1. Instala Node.js y Git si todavía no los tienes.
2. Instala la Supabase CLI según la guía oficial: https://supabase.com/docs/guides/cli
3. Desde la raíz del proyecto, autentícate con `npx supabase login`.
4. Enlaza el proyecto existente con `npx supabase link --project-ref ebtdksftgrtfwikpmzqt`. La CLI pedirá la contraseña de la base de datos de Supabase; no la guardes en GitHub ni en variables públicas.
5. Comprueba el estado de las migraciones con `npm run db:status`.
6. Revisa cuidadosamente las migraciones pendientes antes de aplicar `npm run db:push`.

### Importante
La migración de recetas está versionada. El esquema previo de fichajes se creó antes de establecer este flujo, así que todavía hay que importar/registrar ese esquema existente como baseline antes de afirmar que toda la base de datos está bajo control de migraciones. No ejecutes una migración de baseline a ciegas sobre producción.
