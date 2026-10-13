# La Partida

Portal web modular para operaciones de cocina, construido con Next.js, TypeScript y Supabase.

## Desarrollo local (opcional)

La ejecución local sirve para desarrollar la aplicación, pero no es necesaria para gestionar la base de datos de producción.

```bash
npm install
npm run dev
```

## Configuración

Consulta `.env.example` para las variables de entorno de la aplicación. Nunca subas contraseñas, tokens ni claves secretas al repositorio.

## Base de datos como código

Las migraciones SQL se versionan en `supabase/migrations/`. La base de datos de producción se gestiona desde GitHub Actions; no es necesario instalar Supabase CLI en el ordenador para el flujo habitual.

### Configurar los secretos de GitHub

En el repositorio, abre **Settings → Secrets and variables → Actions → New repository secret** y crea estos dos secretos:

- `SUPABASE_ACCESS_TOKEN`: token de acceso personal de Supabase, creado desde la configuración de tu cuenta de Supabase.
- `SUPABASE_DB_PASSWORD`: contraseña de la base de datos del proyecto.

No compartas estos valores en chats, issues, commits ni archivos del repositorio. No uses la clave pública de la aplicación como sustituto de la contraseña de base de datos.

### Ejecutar una migración

1. Revisa los archivos SQL de `supabase/migrations/` en GitHub.
2. Abre **Actions → Supabase migrations → Run workflow**.
3. Ejecuta el flujo contra el proyecto vinculado `ebtdksftgrtfwikpmzqt` y revisa el resultado del job.

El workflow está configurado inicialmente para ejecución manual, para evitar que se modifique producción antes de comprobar el historial de migraciones existente. Una vez establecido el baseline, se puede habilitar la ejecución automática al integrar nuevas migraciones en `main`.

### Estado inicial y precauciones

La base de datos ya tenía tablas de fichajes creadas antes de versionar las migraciones. Antes de activar despliegues automáticos en cada cambio, hay que registrar correctamente el esquema existente como baseline y verificar el historial remoto. No se debe aplicar un baseline generado a ciegas ni borrar tablas para resolver discrepancias.

La limpieza inicial de usuarios y datos de prueba debe hacerse en una migración separada, revisada y explícita, preservando la cuenta administradora acordada. Las migraciones de esquema no deben incluir contraseñas ni tokens.
