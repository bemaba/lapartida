-- Catálogo inicial de referencias de cocina Singularis para La Partida.
-- Idempotente por título de referencia y título de menú. No publica recetas ni menús.
-- Las fichas técnicas se dejan deliberadamente vacías: no se inventan ingredientes,
-- cantidades, pasos, alérgenos, tiempos ni fotografías.
-- Bebidas y suplementos comerciales (cava, café, agua, etc.) quedan fuera.

do $$
declare
  v_admin uuid;
begin
  select p.user_id into v_admin
  from public.profiles p
  where p.active = true and p.role = 'admin'
  order by p.user_id
  limit 1;

  if v_admin is null then
    raise exception 'No se encontró ningún perfil activo con rol admin para importar el catálogo Singularis.';
  end if;

  with catalog(title, description, category, menu_title, course, sort_order) as (
    values
('Dados de fuet', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 1),
('Tostada de jamón ibérico', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 2),
('Dados de queso marinados', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 3),
('Oreo de guacamole', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 4),
('Banderilla de anchoa y aceituna', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 5),
('Planchadito de oliva con brie', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 1),
('Minicroquetas de jamón o minicroquetas de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 2),
('Miniburritos con chili', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 3),
('Botón de tortilla de patata con cebolla caramelizada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 4),
('Guacamole con chips vegetales', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 1),
('Jamón ibérico y pan con tomate', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 2),
('Cono de tomate con cremoso de brie, kalamata y concassé de tomate', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 3),
('Miniblinis de sobrasada, queso y miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 4),
('Vaso de tabulé con pico de gallo a la menta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 5),
('Gazpacho de sandía con perlas de limón o crema de setas con anacardos (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 6),
('Sam de endivia con membrillo, cremoso de queso y nueces', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 7),
('Tartaleta con cremoso de calabaza al parmesano', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 8),
('Croquetas de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 1),
('Minibrioche de cheddar y jalapeños', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 2),
('Cazón adobado', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 3),
('Croqueta de pollo con mayonesa a la mostaza', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 4),
('Minitortilla de patatas trufada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 5),
('Pan bao relleno de carne mechada y cebolla roja', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 6),
('Pan de pita relleno de mutabal y queso feta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 7),
('Minibrownie con nueces', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica I', 'Postre', 1),
('Minipastel de zanahoria', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica I', 'Postre', 2),
('Minipita con humus de berenjena y brotes', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 1),
('Tartar de tomate y remolacha con mayonesa de aceitunas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 2),
('Ensaladilla rusa con gamba', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 3),
('Surtido de quesos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 4),
('Chupitos de crema de verduras de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 5),
('Minibrioche de roast beef y salsa tártara', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 6),
('Vaso de brotes con fruta, panceta crujiente y vinagreta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 7),
('Patata parisina aliñada con ventresca de atún', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 8),
('Brocheta de melón con arena de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 9),
('Rock and roll de calamar con mayonesa de cítricos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 1),
('Minihamburguesa de ternera', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 2),
('Degustación de arroz cremoso de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 3),
('Minigofre con queso feta y calabacín', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 4),
('Pan de pita relleno de ragú de ternera', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 5),
('Croquetas de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 6),
('Minicanelón de pato con bechamel y parmesano', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 7),
('Gyoza de verduras con salsa teriyaki', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 8),
('Brocheta de fruta de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 1),
('Minimuffin de frutos rojos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 2),
('Trufas heladas de chocolate', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 3),
('Minitatin de manzana', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 4),
('Tartar de longaniza curada con mayonesa de wasabi', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 1),
('Lingote sólido de vermut', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 2),
('Minimollete de roast beef con salsa de mostaza-miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 3),
('Cono de cremoso de langostino y perlas de lima', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 4),
('Aire de brandada con miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 5),
('Rock and roll de guacamole con encurtidos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 6),
('Brocheta de queso con membrillo', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 7),
('Dados de salmón macerados', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 8),
('Airbag de jamón ibérico', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 9),
('Semiesfera de melón con arena de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 10),
('Salmorejo de mango o gazpacho de sandía (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 11),
('Focaccia mediterránea de calabacín y queso feta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 1),
('Minibrocheta thai de gamba', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 2),
('Brocheta de pollo yakitori', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 3),
('Fideuá de marisco', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 4),
('Crujiente vegetal con salsa romesco', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 5),
('Miniwrap de pollo salteado con mostaza-miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 6),
('Trigo tierno con calabaza y ternera al chimichurri', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 7),
('Bao de calamares y mayonesa de kimchi', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 8),
('Minicroquetas de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 9),
('Chupito de crema de limón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 1),
('Minibrownie', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 2),
('Brocheta de fruta de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 3),
('Surtido de minimacarons', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 4),
('Tartar de longaniza curada con mayonesa de wasabi', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 1),
('Lingote sólido de vermut', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 2),
('Minimollete de roast beef con salsa de mostaza-miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 3),
('Cono comestible de cremoso de langostino y perlas de lima', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 4),
('Aire de brandada con miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 5),
('Rock and roll de guacamole con encurtidos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 6),
('Brocheta de queso con membrillo', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 7),
('Dados de salmón macerados', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 8),
('Airbag de jamón ibérico', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 9),
('Semiesfera de melón con arena de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 10),
('Salmorejo de mango o gazpacho de sandía (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 11),
('Minipita de cordero con mayonesa cítrica', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 1),
('Minicanelón de setas con salsa trufada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 2),
('Brocheta de pollo con salsa teriyaki', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 3),
('Crujiente de carabinero', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 4),
('Minigofre con queso de cabra y cebolla caramelizada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 5),
('Smash brioche de lomo ibérico y queso comté', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 6),
('Miniburritos con cochinita pibil y olivada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 7),
('Miniburger de ternera con queso y cebolla caramelizada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 8),
('Pulpo a la feria con cremoso de patata', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 9),
('Taco de bacalao con muselina de mango', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 10),
('Crema de boletus con arena de anacardos o crema de calabaza con pipas a la lima (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 11),
('Carrot cake mini', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 1),
('Lemon pie mini', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 2),
('Choco 0,0 mini', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 3),
('Texturas de frutas de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 4),
('Rocas de chocolate blanco con curri o de chocolate negro con sal', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 5),
('Estación de fideuá — marisco', 'Estación de fideuá con opción de marisco.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 1),
('Estación de fideuá — setas', 'Estación de fideuá con opción de setas.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 2),
('Estación de arroces — arroz negro', 'Estación de arroces. Variedad: arroz negro.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 3),
('Estación de arroces — arroz de pescado', 'Estación de arroces. Variedad: arroz de pescado.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 4),
('Estación de arroces — arroz vegetal', 'Estación de arroces. Variedad: arroz vegetal.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 5),
('Estación de arroces — arroz de carne', 'Estación de arroces. Variedad: arroz de carne.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 6),
('Estación poke bowl', 'Estación poke bowl con referencias indicadas: salmón, aguacate, quinoa, arroz integral, lechuga, etc. Ficha técnica pendiente de completar.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 7)
  ),
  inserted_recipes as (
    insert into public.recipes
      (title, description, cuisine_type, category, tags, servings, ingredients, steps, allergens, status, created_by)
    select distinct c.title, c.description, 'Singularis', c.category,
           array['Singularis','ficha-tecnica-pendiente'], 10, '[]'::jsonb, '[]'::jsonb, '{}'::text[], 'draft', v_admin
    from catalog c
    where not exists (select 1 from public.recipes r where lower(trim(r.title)) = lower(trim(c.title)))
    returning id, title
  ),
  menu_data(title, description, theme_label, sort_order) as (
    values
('Light', 'Menú Light Singularis. Selección orientativa: 3 aperitivos fríos y 2 calientes.', 'Light', 1),
('Experiencia Gastronómica I', 'Menú Singularis I. Selección: 4 fríos, 4 calientes y 1 postre.', 'Experiencia Gastronómica I', 2),
('Experiencia Gastronómica II', 'Menú Singularis II. Selección: 5 fríos, 4 calientes y 2 postres.', 'Experiencia Gastronómica II', 3),
('Experiencia Gastronómica III', 'Menú Singularis III. Selección: 5 fríos, 5 calientes y 2 postres.', 'Experiencia Gastronómica III', 4),
('Experiencia Gastronómica IV', 'Menú Singularis IV. Selección: 5 fríos, 6 calientes y 2 postres.', 'Experiencia Gastronómica IV', 5),
('Estaciones temáticas Singularis', 'Referencias de cocina para estaciones en eventos. Fichas técnicas pendientes de completar.', 'Estaciones', 6)
  ),
  inserted_menus as (
    insert into public.menus (title, description, theme_label, status, created_by)
    select md.title, md.description, md.theme_label, 'draft', v_admin
    from menu_data md
    where not exists (select 1 from public.menus m where lower(trim(m.title)) = lower(trim(md.title)))
    returning id, title
  )
  select count(*) into strict v_admin from (select 1) one_row;
end $$;

-- Enlazar las referencias del catálogo a cada menú, incluyendo las ya existentes.
with catalog(title, description, category, menu_title, course, sort_order) as (
  values
('Dados de fuet', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 1),
('Tostada de jamón ibérico', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 2),
('Dados de queso marinados', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 3),
('Oreo de guacamole', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 4),
('Banderilla de anchoa y aceituna', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Light', 'Aperitivo', 5),
('Planchadito de oliva con brie', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 1),
('Minicroquetas de jamón o minicroquetas de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 2),
('Miniburritos con chili', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 3),
('Botón de tortilla de patata con cebolla caramelizada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Light', 'Aperitivo', 4),
('Guacamole con chips vegetales', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 1),
('Jamón ibérico y pan con tomate', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 2),
('Cono de tomate con cremoso de brie, kalamata y concassé de tomate', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 3),
('Miniblinis de sobrasada, queso y miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 4),
('Vaso de tabulé con pico de gallo a la menta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 5),
('Gazpacho de sandía con perlas de limón o crema de setas con anacardos (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 6),
('Sam de endivia con membrillo, cremoso de queso y nueces', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 7),
('Tartaleta con cremoso de calabaza al parmesano', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica I', 'Aperitivo', 8),
('Croquetas de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 1),
('Minibrioche de cheddar y jalapeños', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 2),
('Cazón adobado', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 3),
('Croqueta de pollo con mayonesa a la mostaza', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 4),
('Minitortilla de patatas trufada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 5),
('Pan bao relleno de carne mechada y cebolla roja', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 6),
('Pan de pita relleno de mutabal y queso feta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica I', 'Aperitivo', 7),
('Minibrownie con nueces', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica I', 'Postre', 1),
('Minipastel de zanahoria', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica I', 'Postre', 2),
('Minipita con humus de berenjena y brotes', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 1),
('Tartar de tomate y remolacha con mayonesa de aceitunas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 2),
('Ensaladilla rusa con gamba', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 3),
('Surtido de quesos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 4),
('Chupitos de crema de verduras de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 5),
('Minibrioche de roast beef y salsa tártara', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 6),
('Vaso de brotes con fruta, panceta crujiente y vinagreta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 7),
('Patata parisina aliñada con ventresca de atún', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 8),
('Brocheta de melón con arena de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica II', 'Aperitivo', 9),
('Rock and roll de calamar con mayonesa de cítricos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 1),
('Minihamburguesa de ternera', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 2),
('Degustación de arroz cremoso de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 3),
('Minigofre con queso feta y calabacín', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 4),
('Pan de pita relleno de ragú de ternera', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 5),
('Croquetas de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 6),
('Minicanelón de pato con bechamel y parmesano', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 7),
('Gyoza de verduras con salsa teriyaki', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica II', 'Aperitivo', 8),
('Brocheta de fruta de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 1),
('Minimuffin de frutos rojos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 2),
('Trufas heladas de chocolate', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 3),
('Minitatin de manzana', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica II', 'Postre', 4),
('Tartar de longaniza curada con mayonesa de wasabi', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 1),
('Lingote sólido de vermut', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 2),
('Minimollete de roast beef con salsa de mostaza-miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 3),
('Cono de cremoso de langostino y perlas de lima', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 4),
('Aire de brandada con miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 5),
('Rock and roll de guacamole con encurtidos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 6),
('Brocheta de queso con membrillo', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 7),
('Dados de salmón macerados', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 8),
('Airbag de jamón ibérico', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 9),
('Semiesfera de melón con arena de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 10),
('Salmorejo de mango o gazpacho de sandía (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica III', 'Aperitivo', 11),
('Focaccia mediterránea de calabacín y queso feta', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 1),
('Minibrocheta thai de gamba', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 2),
('Brocheta de pollo yakitori', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 3),
('Fideuá de marisco', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 4),
('Crujiente vegetal con salsa romesco', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 5),
('Miniwrap de pollo salteado con mostaza-miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 6),
('Trigo tierno con calabaza y ternera al chimichurri', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 7),
('Bao de calamares y mayonesa de kimchi', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 8),
('Minicroquetas de setas', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica III', 'Aperitivo', 9),
('Chupito de crema de limón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 1),
('Minibrownie', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 2),
('Brocheta de fruta de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 3),
('Surtido de minimacarons', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica III', 'Postre', 4),
('Tartar de longaniza curada con mayonesa de wasabi', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 1),
('Lingote sólido de vermut', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 2),
('Minimollete de roast beef con salsa de mostaza-miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 3),
('Cono comestible de cremoso de langostino y perlas de lima', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 4),
('Aire de brandada con miel', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 5),
('Rock and roll de guacamole con encurtidos', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 6),
('Brocheta de queso con membrillo', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 7),
('Dados de salmón macerados', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 8),
('Airbag de jamón ibérico', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 9),
('Semiesfera de melón con arena de jamón', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 10),
('Salmorejo de mango o gazpacho de sandía (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Frío', 'Experiencia Gastronómica IV', 'Aperitivo', 11),
('Minipita de cordero con mayonesa cítrica', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 1),
('Minicanelón de setas con salsa trufada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 2),
('Brocheta de pollo con salsa teriyaki', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 3),
('Crujiente de carabinero', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 4),
('Minigofre con queso de cabra y cebolla caramelizada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 5),
('Smash brioche de lomo ibérico y queso comté', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 6),
('Miniburritos con cochinita pibil y olivada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 7),
('Miniburger de ternera con queso y cebolla caramelizada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 8),
('Pulpo a la feria con cremoso de patata', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 9),
('Taco de bacalao con muselina de mango', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 10),
('Crema de boletus con arena de anacardos o crema de calabaza con pipas a la lima (según temporada)', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Caliente', 'Experiencia Gastronómica IV', 'Aperitivo', 11),
('Carrot cake mini', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 1),
('Lemon pie mini', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 2),
('Choco 0,0 mini', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 3),
('Texturas de frutas de temporada', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 4),
('Rocas de chocolate blanco con curri o de chocolate negro con sal', 'Referencia de cocina Singularis. Ficha técnica pendiente de completar.', 'Postre', 'Experiencia Gastronómica IV', 'Postre', 5),
('Estación de fideuá — marisco', 'Estación de fideuá con opción de marisco.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 1),
('Estación de fideuá — setas', 'Estación de fideuá con opción de setas.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 2),
('Estación de arroces — arroz negro', 'Estación de arroces. Variedad: arroz negro.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 3),
('Estación de arroces — arroz de pescado', 'Estación de arroces. Variedad: arroz de pescado.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 4),
('Estación de arroces — arroz vegetal', 'Estación de arroces. Variedad: arroz vegetal.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 5),
('Estación de arroces — arroz de carne', 'Estación de arroces. Variedad: arroz de carne.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 6),
('Estación poke bowl', 'Estación poke bowl con referencias indicadas: salmón, aguacate, quinoa, arroz integral, lechuga, etc. Ficha técnica pendiente de completar.', 'Estación', 'Estaciones temáticas Singularis', 'Otro', 7)
)
insert into public.menu_items (menu_id, recipe_id, course, sort_order)
select m.id, r.id, c.course, c.sort_order
from catalog c
join public.menus m on lower(trim(m.title)) = lower(trim(c.menu_title))
join public.recipes r on lower(trim(r.title)) = lower(trim(c.title))
where not exists (
  select 1 from public.menu_items mi
  where mi.menu_id = m.id and mi.recipe_id = r.id
);
