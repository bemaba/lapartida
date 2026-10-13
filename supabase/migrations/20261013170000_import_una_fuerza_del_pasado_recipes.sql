-- Importación inicial de las recetas del menú temático "Una fuerza del pasado".
-- Se guardan como borradores para que una administradora revise alérgenos y fichas técnicas.
-- Es idempotente: no duplica recetas por título y añade la etiqueta de menú si ya existían.

do $$
begin
  if not exists (
    select 1 from auth.users
    where lower(email) = lower('adminlapartida@gmail.com')
  ) then
    raise exception 'No existe adminlapartida@gmail.com en auth.users. No se han importado recetas.';
  end if;
end;
$$;

update public.recipes
set tags = array_append(tags, 'Una fuerza del pasado')
where lower(trim(title)) in (
  lower('Carrillera de ternera, castañas glaseadas, jugo reducido al vino tinto y parmentier de patata trufada'),
  lower('Texturas de chocolate, aceite de oliva y sal')
)
and not ('Una fuerza del pasado' = any(tags));

insert into public.recipes (
  title, description, photo_url, cuisine_type, category, tags, servings,
  prep_minutes, cook_minutes, difficulty, ingredients, steps, allergens,
  dietary_tags, storage_notes, status, created_by
)
select
  'Carrillera de ternera, castañas glaseadas, jugo reducido al vino tinto y parmentier de patata trufada',
  'Menú temático: Una fuerza del pasado. Rendimiento original: 15 raciones. Peso final objetivo: 245–260 g por ración. Componentes: carrillera de ternera, castañas glaseadas, jugo reducido al vino tinto y parmentier de patata trufada.',
  null,
  'Otra',
  'Principal',
  array['Una fuerza del pasado']::text[],
  15,
  null,
  null,
  'Alta',
  $ingredients$
  [
    {"name":"Carrillera de ternera limpia","quantity":"3,5 kg","note":"Componente: carrillera"},
    {"name":"Cebolla","quantity":"700 g","note":"Componente: carrillera"},
    {"name":"Zanahoria","quantity":"400 g","note":"Componente: carrillera"},
    {"name":"Puerro","quantity":"300 g","note":"Componente: carrillera"},
    {"name":"Ajo","quantity":"60 g","note":"Componente: carrillera"},
    {"name":"Vino tinto","quantity":"2,5 L","note":"Componente: carrillera"},
    {"name":"Fondo oscuro de ternera / caldo vegetal","quantity":"1,5–2 L","note":"Componente: carrillera"},
    {"name":"Laurel","quantity":"3 hojas","note":"Componente: carrillera"},
    {"name":"Tomillo","quantity":"10 g","note":"Componente: carrillera"},
    {"name":"Pimienta negra","quantity":"8 g","note":"Componente: carrillera"},
    {"name":"Aceite de oliva suave","quantity":"120 ml","note":"Componente: carrillera"},
    {"name":"Sal","quantity":"c/s","note":"Componente: carrillera"},
    {"name":"Brotes de guisantes","quantity":"c/s","note":"Decoración; se piden por email a Guzmán"},
    {"name":"Castañas peladas congeladas","quantity":"45 unidades","note":"Componente: castañas glaseadas"},
    {"name":"Fondo oscuro de ternera","quantity":"500 ml","note":"Componente: castañas glaseadas"},
    {"name":"Mantequilla","quantity":"30 g","note":"Componente: castañas glaseadas"},
    {"name":"Miel","quantity":"10 g","note":"Componente: castañas glaseadas"},
    {"name":"Sal","quantity":"2 g","note":"Componente: castañas glaseadas"},
    {"name":"Patata","quantity":"2,5 kg","note":"Componente: parmentier trufada"},
    {"name":"Mantequilla","quantity":"250 g","note":"Componente: parmentier trufada"},
    {"name":"Leche entera","quantity":"500 ml","note":"Componente: parmentier trufada"},
    {"name":"Nata","quantity":"250 ml","note":"Componente: parmentier trufada"},
    {"name":"Pasta de trufa negra","quantity":"45 g","note":"Componente: parmentier trufada"},
    {"name":"Sal","quantity":"c/s","note":"Componente: parmentier trufada"},
    {"name":"Pimienta blanca","quantity":"c/s","note":"Componente: parmentier trufada"},
    {"name":"Nuez moscada","quantity":"c/s","note":"Componente: parmentier trufada"}
  ]
  $ingredients$::jsonb,
  $steps$
  [
    {"instruction":"[Carrillera] Limpiar las carrilleras, retirando el exceso de grasa y el tejido conjuntivo superficial. Secar muy bien.","minutes":"","temperature":""},
    {"instruction":"[Carrillera] Salpimentar y marcar en aceite en una olla limpia hasta conseguir una buena caramelización por todas las caras. Retirar.","minutes":"","temperature":""},
    {"instruction":"[Carrillera] En la misma olla, añadir cebolla, zanahoria y puerro cortados en mirepoix. Sofreír lentamente hasta conseguir una coloración tostada.","minutes":"","temperature":""},
    {"instruction":"[Carrillera] Incorporar el ajo y cocinar.","minutes":"2–3","temperature":""},
    {"instruction":"[Carrillera] Desglasar con el vino tinto y reducir a la mitad.","minutes":"","temperature":""},
    {"instruction":"[Carrillera] Colocar las carrilleras en un gastronorm profundo, cubrir con la bresa de verduras y el fondo caliente, y tapar con papel de aluminio.","minutes":"","temperature":""},
    {"instruction":"[Carrillera] Cocinar hasta que estén bien tiernas.","minutes":"300–360","temperature":"150 °C · horno mixto 50 % vapor / 50 % convección"},
    {"instruction":"[Carrillera] Retirar las carrilleras del jugo de cocción, desmenuzar en caliente y formar cilindros envueltos en film. Dejar enfriar 24 horas y cortar en rodajas de unos 140 g.","minutes":"","temperature":"Enfriado en frío: 24 h"},
    {"instruction":"[Carrillera] Reducir el fondo de cocción y texturizar.","minutes":"","temperature":""},
    {"instruction":"[Castañas] Colocar las castañas en una cazuela amplia.","minutes":"","temperature":""},
    {"instruction":"[Castañas] Añadir el fondo de ternera hasta cubrir aproximadamente tres cuartas partes de la altura de las castañas.","minutes":"","temperature":""},
    {"instruction":"[Castañas] Añadir la miel y la sal.","minutes":"","temperature":""},
    {"instruction":"[Castañas] Cocinar a fuego suave, sin hervor fuerte, dependiendo del tamaño.","minutes":"20–25","temperature":""},
    {"instruction":"[Castañas] Cuando quede aproximadamente 1 cm de líquido en la cazuela, añadir la mantequilla.","minutes":"","temperature":""},
    {"instruction":"[Castañas] Mover suavemente la cazuela para emulsionar el líquido reducido con la mantequilla.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Cocer las patatas enteras y con piel hasta que estén completamente tiernas.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Pelar las patatas mientras estén calientes.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Pasar las patatas por pasapurés. No utilizar túrmix ni Thermomix.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Calentar la leche y la nata.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Llevar el puré a una olla y, a fuego muy bajo, incorporar progresivamente los líquidos trabajando con espátula.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Añadir la mantequilla poco a poco y retirar del fuego.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Pasar el puré por un tamiz para lograr una textura muy fina.","minutes":"","temperature":""},
    {"instruction":"[Parmentier trufada] Incorporar la pasta de trufa y rectificar de sal, pimienta y nuez moscada.","minutes":"","temperature":""}
  ]
  $steps$::jsonb,
  array['Leche']::text[],
  array[]::text[],
  'Producción anticipada indicada en la ficha: los cilindros de carrillera reposan 24 h en frío antes de cortarlos. Revisar las fichas técnicas del vino, los fondos y los productos utilizados para confirmar si procede declarar sulfitos u otros alérgenos. Alérgenos pendientes de validación profesional.',
  'draft',
  u.id
from auth.users u
where lower(u.email) = lower('adminlapartida@gmail.com')
  and not exists (
    select 1 from public.recipes r
    where lower(trim(r.title)) = lower('Carrillera de ternera, castañas glaseadas, jugo reducido al vino tinto y parmentier de patata trufada')
  );

insert into public.recipes (
  title, description, photo_url, cuisine_type, category, tags, servings,
  prep_minutes, cook_minutes, difficulty, ingredients, steps, allergens,
  dietary_tags, storage_notes, status, created_by
)
select
  'Texturas de chocolate, aceite de oliva y sal',
  'Menú temático: Una fuerza del pasado. Rendimiento original: 15 raciones. Peso final objetivo: 140–155 g por ración. Postre compuesto por cremoso de chocolate, brownie, crumble de cacao, helado de chocolate y topping de Caviaroli y pétalos de flores.',
  null,
  'Otra',
  'Postre',
  array['Una fuerza del pasado']::text[],
  15,
  null,
  null,
  'Media',
  $ingredients$
  [
    {"name":"Chocolate de cobertura","quantity":"515 g","note":"Componente: cremoso de chocolate"},
    {"name":"Nata 35 %","quantity":"960 g","note":"Componente: cremoso de chocolate"},
    {"name":"Leche entera","quantity":"400 ml","note":"Componente: cremoso de chocolate"},
    {"name":"Azúcar","quantity":"125 g","note":"Componente: cremoso de chocolate"},
    {"name":"Yema pasteurizada","quantity":"280 g","note":"Componente: cremoso de chocolate"},
    {"name":"Hojas de gelatina","quantity":"5 unidades","note":"Componente: cremoso de chocolate"},
    {"name":"Brownie de Panamar Bakery","quantity":"11,25 unidades","note":"Componente: brownie; proveedor indicado en la ficha"},
    {"name":"Harina","quantity":"130 g","note":"Componente: crumble de cacao"},
    {"name":"Cacao puro en polvo","quantity":"45 g","note":"Componente: crumble de cacao"},
    {"name":"Azúcar moreno","quantity":"90 g","note":"Componente: crumble de cacao"},
    {"name":"Almendra molida","quantity":"55 g","note":"Componente: crumble de cacao"},
    {"name":"Mantequilla fría","quantity":"80 g","note":"Componente: crumble de cacao"},
    {"name":"Sal","quantity":"2 g","note":"Componente: crumble de cacao"},
    {"name":"Helado de chocolate","quantity":"525 g","note":"Componente: helado de chocolate"},
    {"name":"Caviaroli","quantity":"70–80 g aprox.","note":"Componente: topping para emplatado"},
    {"name":"Pétalos de flores","quantity":"c/n","note":"Componente: topping para emplatado"}
  ]
  $ingredients$::jsonb,
  $steps$
  [
    {"instruction":"[Cremoso de chocolate] Llevar a hervor la leche junto con la nata.","minutes":"","temperature":""},
    {"instruction":"[Cremoso de chocolate] Blanquear el azúcar con la yema.","minutes":"","temperature":""},
    {"instruction":"[Cremoso de chocolate] Verter los líquidos sobre las yemas blanqueadas y cocer, sin dejar de remover, hasta alcanzar 85 °C.","minutes":"","temperature":"85 °C"},
    {"instruction":"[Cremoso de chocolate] Fuera del fuego, incorporar la gelatina previamente hidratada durante 5 minutos y remover hasta integrarla.","minutes":"5","temperature":""},
    {"instruction":"[Cremoso de chocolate] Verter la crema inglesa, pasada por un chino de malla fina, sobre el chocolate de cobertura. Emulsionar con túrmix, integrar bien y tapar con film a piel.","minutes":"","temperature":""},
    {"instruction":"[Cremoso de chocolate] Dejar reposar en nevera un mínimo de 12 horas y después colocar en mangas.","minutes":"","temperature":"Reposo en nevera: mínimo 12 h"},
    {"instruction":"[Brownie] Quitar la parte superior de los brownies (la parte del chocolate) y cortar cada bizcocho en cuatro. Cada plato lleva tres cubos.","minutes":"","temperature":""},
    {"instruction":"[Crumble de cacao] Mezclar harina, cacao, almendra molida, azúcar moreno y sal. Triturar en Thermomix para integrar bien.","minutes":"","temperature":""},
    {"instruction":"[Crumble de cacao] Añadir la mantequilla fría en dados y trabajar con las manos hasta conseguir una textura arenosa.","minutes":"","temperature":""},
    {"instruction":"[Crumble de cacao] Extender sobre una bandeja con papel de horno, formando una capa muy fina para conseguir una cocción uniforme.","minutes":"","temperature":""},
    {"instruction":"[Crumble de cacao] Hornear, removiendo ligeramente a mitad de cocción.","minutes":"12–15","temperature":"160 °C · ventilador en tres líneas"},
    {"instruction":"[Emplatado] Servir el cremoso, tres cubos de brownie por plato, crumble de cacao, helado de chocolate, Caviaroli y pétalos de flores. La ficha original no especifica cantidades por componente para el emplatado, salvo los tres cubos de brownie.","minutes":"","temperature":""}
  ]
  $steps$::jsonb,
  array['Gluten','Huevos','Leche','Frutos de cáscara']::text[],
  array[]::text[],
  'El cremoso requiere un reposo mínimo de 12 h en nevera. Revisar las fichas técnicas del brownie de Panamar Bakery, chocolate de cobertura, helado y Caviaroli para confirmar la declaración completa de alérgenos, incluidos posibles derivados de soja u otros ingredientes. Alérgenos pendientes de validación profesional.',
  'draft',
  u.id
from auth.users u
where lower(u.email) = lower('adminlapartida@gmail.com')
  and not exists (
    select 1 from public.recipes r
    where lower(trim(r.title)) = lower('Texturas de chocolate, aceite de oliva y sal')
  );
