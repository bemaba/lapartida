# La Partida

Portal web para operaciones de cocina, desarrollado con Next.js, TypeScript y Supabase.

Esta guía es la referencia operativa para entender los workflows de GitHub Actions y saber cuál usar en cada situación. No necesitas usar un terminal para los procedimientos habituales: las tareas se lanzan desde el navegador.

## Enlaces rápidos

- [GitHub Actions](https://github.com/bemaba/lapartida/actions)
- [Migraciones SQL](./supabase/migrations/)
- [Configuración de Storage para fotos de recetas](./supabase/migrations/20261013150000_recipe_photo_storage.sql)

## Regla más importante

**No ejecutes workflows de base de datos sin saber qué cambian.** Los workflows de este repositorio apuntan al proyecto Supabase configurado en sus archivos. Algunos solo consultan información; otros cambian el historial de migraciones o el esquema real de producción.

Antes de ejecutar un workflow, abre el archivo YAML correspondiente y revisa este documento. Si aparece `Failure`, consulta los logs del run; no repitas el workflow sin entender la causa.

## Workflows disponibles

Todos los workflows descritos abajo son manuales: ve a **Actions**, elige el nombre y pulsa **Run workflow**. Los nombres de los workflows son los que verás en GitHub.

| Workflow | Qué hace | Cuándo usarlo |
|---|---|---|
| **Supabase migration preflight** | Conecta con Supabase y muestra las migraciones locales y remotas. No ejecuta SQL ni cambia el esquema. | Para consultar el historial antes de planificar cambios o investigar una discrepancia. Es la opción de inspección. |
| **Supabase schema baseline review** | Exporta una fotografía del esquema público remoto a un archivo SQL, la sube como artefacto y abre/actualiza un PR para revisarlo. | Solo si necesitas volver a documentar el esquema que ya existe. Revisa cuidadosamente el SQL generado y el PR. No es un workflow de despliegue. |
| **Register Supabase baseline** | Marca la migración baseline `20261012000000` como aplicada en el historial de Supabase, sin ejecutar el SQL del archivo. | Fue una tarea de configuración inicial y ya se ejecutó correctamente. No la ejecutes como parte del trabajo habitual ni para registrar migraciones nuevas. |
| **Apply recipes migration** | Comprueba que el baseline está registrado y que la migración de recetas está pendiente; después ejecuta `supabase db push --linked` y verifica el historial. | Fue la instalación inicial del módulo de recetas. Ya se ejecutó correctamente. No volver a ejecutarla para cambios nuevos: prepara una migración nueva con una versión nueva. |
| **Apply recipe photo storage migration** | Comprueba que el baseline y recetas ya están aplicados; crea/configura el bucket de fotos de recetas y las políticas de acceso; verifica el historial. | Fue la configuración inicial para poder subir fotos de recetas. Ya se ejecutó correctamente. No es necesario repetirla rutinariamente. |
| **Import Una fuerza del pasado recipes** | Verifica las migraciones existentes y ejecuta una migración idempotente que añade dos recetas como borradores. | Importación inicial del menú temático. Ejecutar una sola vez; el workflow se detiene si la migración ya está aplicada o falta el usuario administrador esperado. |

### Estado conocido del proyecto (13 de octubre de 2026)

La configuración inicial se realizó y estos tres pasos se verificaron en GitHub Actions:

1. Baseline `20261012000000`: registrado como aplicado, sin ejecutar su SQL en producción.
2. Recetas `20261013090000`: aplicada.
3. Almacenamiento de fotos `20261013150000`: aplicada.
4. Importación de recetas `20261013170000`: pendiente de ejecutar desde GitHub Actions; añade carrillera y postre de chocolate como borradores con la etiqueta `Una fuerza del pasado`.

El workflow de fotos terminó correctamente en [esta ejecución](https://github.com/bemaba/lapartida/actions/runs/38402582496).

El baseline describe la estructura que existía antes de empezar a versionar el esquema. **No lo apliques con `db push` al proyecto actual**: está registrado para que Supabase lo trate como ya aplicado, no para recrear las tablas existentes.

## Importar las recetas del menú «Una fuerza del pasado»

El workflow **Import Una fuerza del pasado recipes** incorpora las dos recetas de las últimas pestañas del Excel como borradores en el módulo Recetas:

- **Carrillera de ternera, castañas glaseadas, jugo reducido al vino tinto y parmentier de patata trufada** — categoría Principal.
- **Texturas de chocolate, aceite de oliva y sal** — categoría Postre.

Las dos llevan la etiqueta «Una fuerza del pasado». La categoría del plato y la etiqueta del menú son campos distintos: la categoría permite clasificar el plato y la etiqueta identifica el menú temático. Así se podrán reutilizar recetas en menús futuros sin duplicarlas. El constructor formal de menús todavía sería una funcionalidad aparte.

La importación conserva cantidades, rendimiento y pasos presentes en el Excel. Los tiempos de preparación/cocción no se completan cuando no se pueden representar fielmente con un único valor. Las recetas quedan en borrador para revisión. Los alérgenos se han inferido de ingredientes explícitos y las fichas técnicas de productos comerciales deben verificarse antes de publicar.

Para ejecutar la importación, abre [GitHub Actions](https://github.com/bemaba/lapartida/actions), selecciona **Import Una fuerza del pasado recipes** y pulsa **Run workflow** en la rama `main`. No ejecutes otra vez el workflow después de que la migración `20261013170000` figure como aplicada.

## Cómo añadir un cambio nuevo a la base de datos

Usa este proceso cuando una funcionalidad nueva requiera tablas, columnas, índices, funciones, políticas RLS o configuración adicional de Storage.

1. **Crea un nuevo archivo SQL** dentro de `supabase/migrations/`, con nombre que empiece por una marca temporal única y descriptiva, por ejemplo `20261014120000_add_recipe_field.sql`. No reutilices un número ya usado.
2. **Revisa el SQL antes de ejecutarlo.** Comprueba si elimina o modifica datos, tablas, permisos o políticas de seguridad. Evita operaciones destructivas que no sean necesarias.
3. **Guarda el archivo en GitHub** mediante un commit o PR. El archivo de migración debe estar versionado antes de desplegarlo.
4. **Consulta el historial** con **Supabase migration preflight** si hay dudas de qué está aplicado y qué sigue pendiente.
5. **Aplica el cambio** con un workflow de despliegue adecuado. Los workflows actuales `Apply recipes migration` y `Apply recipe photo storage migration` son específicos de sus migraciones iniciales y contienen comprobaciones con esos números; no sirven para aplicar cualquier archivo futuro. Antes de la próxima migración, habrá que preparar un workflow de despliegue general que valide el baseline y aplique únicamente las migraciones pendientes.
6. **Verifica** que GitHub Actions termina en `Success`, que la nueva migración aparece en el historial remoto y que la funcionalidad funciona en la aplicación.

No edites una migración ya aplicada para cambiar el estado de la base de datos. Añade otra migración que haga el cambio siguiente. Así el historial representa lo que realmente se ha ido aplicando.

## Entender las migraciones

Una migración es un archivo SQL versionado que explica un cambio en la base de datos. Supabase mantiene un historial de las versiones aplicadas. Al comparar los archivos del repositorio con ese historial se puede saber qué cambios quedan pendientes.

- **Archivo local**: una migración SQL guardada en GitHub.
- **Aplicada remotamente**: la versión ya figura en el historial del proyecto Supabase.
- **Pendiente**: está en el repositorio, pero aún no figura como aplicada en el historial remoto.
- **Baseline**: fotografía de la estructura preexistente, que se registra como aplicada para empezar a versionar sin volver a crear los objetos existentes.

El historial de migraciones no demuestra por sí solo que todas las pantallas de la aplicación funcionen: la aplicación también necesita código correcto, variables de entorno y permisos adecuados.

## Secrets y seguridad

Los workflows usan los siguientes **repository secrets** en GitHub:

- `SUPABASE_ACCESS_TOKEN`: token de acceso para el CLI de Supabase.
- `SUPABASE_DB_PASSWORD`: contraseña de la base de datos del proyecto.

Gestiona los valores en **Settings → Secrets and variables → Actions**. No los escribas en el código, en commits, en issues ni en mensajes. No hace falta compartirlos conmigo.

Las fotos de recetas se almacenan en Supabase Storage en un bucket público para que se puedan visualizar en las fichas. Las políticas de escritura limitan la subida a usuarios autenticados con perfil activo y a su carpeta de usuario. Una URL pública significa que quien tenga esa URL puede ver la imagen; no subas imágenes confidenciales.

## Limpieza de datos y usuarios de prueba

La limpieza de usuarios y datos de prueba es una tarea separada de las migraciones de esquema. **No uses el baseline ni los workflows de recetas para borrar usuarios.** Antes de limpiar producción, confirma qué cuentas y registros existen, preserva la cuenta administradora acordada y prepara una operación explícita con revisión. La eliminación de usuarios de autenticación puede ser irreversible y afectar registros relacionados.

## Solución de problemas

- **El workflow falla al conectar con Supabase**: comprueba que los dos repository secrets existen y son válidos. No copies sus valores a los logs ni los publiques.
- **El workflow se detiene porque no coincide el historial**: no fuerces el despliegue ni ejecutes `db push` manualmente; revisa el resultado de **Supabase migration preflight**.
- **Una migración ya aparece aplicada**: no intentes volver a aplicarla ni reutilices su número de versión.
- **Una foto no sube**: confirma que el workflow de almacenamiento de fotos terminó correctamente, que el usuario tiene perfil activo y que la imagen es JPG, PNG o WebP y pesa como máximo 5 MB.
- **El workflow da `Success` pero una pantalla no funciona**: prueba la funcionalidad en la aplicación y consulta los logs del navegador o los mensajes de error de la propia pantalla. Un workflow correcto no sustituye la prueba funcional.

## Referencia de archivos

- `.github/workflows/supabase-migrations.yml` — inspección del historial, solo lectura.
- `.github/workflows/supabase-schema-baseline.yml` — exportación del esquema para revisión.
- `.github/workflows/supabase-register-baseline.yml` — registro inicial del baseline.
- `.github/workflows/supabase-apply-recipes.yml` — despliegue de la migración inicial de recetas.
- `.github/workflows/supabase-apply-photo-storage.yml` — despliegue de la configuración inicial de fotos.
- `supabase/migrations/` — historial versionado de cambios SQL.

**Recomendación para el futuro:** mantener un único workflow genérico de despliegue de migraciones con controles de seguridad, en lugar de crear un workflow distinto para cada nueva funcionalidad. Hasta que exista y esté revisado, los workflows de recetas y fotos deben considerarse específicos de la configuración inicial.
