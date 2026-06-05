USE eatgo;

START TRANSACTION;

INSERT INTO estabelecimentos (
  nome,
  cnpj,
  logo_url,
  email,
  telefone,
  endereco,
  categoria,
  horario_abertura,
  horario_fechamento,
  possui_entrega,
  taxa_entrega,
  descricao,
  nitrogo_ativo,
  nitrogo_cupom_valor,
  nitrogo_frete_gratis,
  ativo
) VALUES
  (
    'Seed Demo 01 - Bella Massa',
    '11.111.111/0001-01',
    NULL,
    'seed.demo.01@eatgo.local',
    '(11) 90000-0001',
    'Rua das Flores, 101 - Centro',
    'Massas',
    '11:00:00',
    '23:00:00',
    1,
    6.50,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 01.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 02 - Burger House',
    '11.111.111/0001-02',
    NULL,
    'seed.demo.02@eatgo.local',
    '(11) 90000-0002',
    'Avenida Brasil, 202 - Jardim',
    'Hamburgueria',
    '18:00:00',
    '02:00:00',
    1,
    7.90,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 02.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 03 - Sushi Prime',
    '11.111.111/0001-03',
    NULL,
    'seed.demo.03@eatgo.local',
    '(11) 90000-0003',
    'Rua do Comercio, 303 - Centro',
    'Japonesa',
    '12:00:00',
    '22:30:00',
    1,
    9.90,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 03.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 04 - Pizzaria Forno',
    '11.111.111/0001-04',
    NULL,
    'seed.demo.04@eatgo.local',
    '(11) 90000-0004',
    'Rua das Palmeiras, 404 - Vila Nova',
    'Pizzaria',
    '17:30:00',
    '00:30:00',
    1,
    8.50,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 04.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 05 - Cafe Aurora',
    '11.111.111/0001-05',
    NULL,
    'seed.demo.05@eatgo.local',
    '(11) 90000-0005',
    'Praca Central, 505 - Centro',
    'Cafeteria',
    '08:00:00',
    '20:00:00',
    1,
    5.00,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 05.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 06 - Churras Express',
    '11.111.111/0001-06',
    NULL,
    'seed.demo.06@eatgo.local',
    '(11) 90000-0006',
    'Avenida Sul, 606 - Industrial',
    'Churrasco',
    '11:30:00',
    '23:30:00',
    1,
    10.00,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 06.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 07 - Verde Leve',
    '11.111.111/0001-07',
    NULL,
    'seed.demo.07@eatgo.local',
    '(11) 90000-0007',
    'Rua das Acacias, 707 - Bosque',
    'Saudavel',
    '10:00:00',
    '21:00:00',
    1,
    6.00,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 07.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 08 - Tempero da Vovo',
    '11.111.111/0001-08',
    NULL,
    'seed.demo.08@eatgo.local',
    '(11) 90000-0008',
    'Rua Sete, 808 - Vila Esperanca',
    'Caseira',
    '10:30:00',
    '15:30:00',
    1,
    4.50,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 08.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 09 - Doces Sonhos',
    '11.111.111/0001-09',
    NULL,
    'seed.demo.09@eatgo.local',
    '(11) 90000-0009',
    'Alameda Norte, 909 - Planalto',
    'Sobremesas',
    '13:00:00',
    '23:59:00',
    1,
    5.50,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 09.',
    0,
    NULL,
    0,
    1
  ),
  (
    'Seed Demo 10 - Oriental Wok',
    '11.111.111/0001-10',
    NULL,
    'seed.demo.10@eatgo.local',
    '(11) 90000-0010',
    'Rua do Lago, 1001 - Mirante',
    'Asiatica',
    '18:30:00',
    '01:30:00',
    1,
    8.90,
    'SEED_TEMP_2026_05_11 estabelecimento demonstracao 10.',
    0,
    NULL,
    0,
    1
  );

INSERT INTO cardapio (
  id_estabelecimento,
  nome,
  descricao,
  preco,
  preco_promocional,
  imagem,
  categoria,
  ativo
)
SELECT e.id_estabelecimento, 'Bruschetta Bella', 'Entrada italiana com tomate e manjericao.', 19.90, NULL, NULL, 'Entradas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Lasanha da Casa', 'Lasanha de bolonhesa gratinada.', 34.90, 31.90, NULL, 'Massas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Nhoque ao Sugo', 'Nhoque artesanal com molho de tomate.', 29.90, NULL, NULL, 'Massas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Fettuccine Alfredo', 'Massa cremosa com parmesao.', 32.50, NULL, NULL, 'Massas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Ravioli de Queijo', 'Ravioli recheado ao molho branco.', 35.90, NULL, NULL, 'Massas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Parmegiana de Frango', 'File com molho e queijo gratinado.', 36.90, 33.90, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Risoto de Funghi', 'Risoto cremoso de cogumelos.', 38.90, NULL, NULL, 'Risotos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Salada Caprese', 'Tomate, mussarela e pesto.', 22.90, NULL, NULL, 'Saladas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Tiramisu', 'Sobremesa classica italiana.', 17.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Soda Italiana', 'Bebida gaseificada de frutas.', 11.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.01@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Burger Classico', 'Pao, carne, queijo e salada.', 24.90, NULL, NULL, 'Burgers', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Burger Bacon', 'Hamburguer com bacon crocante.', 28.90, 25.90, NULL, 'Burgers', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Burger Smash Duplo', 'Dois discos com cheddar.', 31.90, NULL, NULL, 'Burgers', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Batata Frita', 'Porcao crocante tradicional.', 15.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Batata com Cheddar', 'Batata com cheddar e bacon.', 19.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Onion Rings', 'Aneis de cebola empanados.', 17.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Milkshake Chocolate', 'Milkshake cremoso de chocolate.', 18.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Refrigerante Lata', 'Lata 350ml gelada.', 6.50, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Burger House', 'Burger, fritas e refri.', 36.90, 33.90, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Cookie Recheado', 'Cookie artesanal da casa.', 9.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.02@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Sushi 12', 'Selecao com 12 unidades.', 32.90, NULL, NULL, 'Combinados', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Sushi 20', 'Selecao premium 20 unidades.', 54.90, 49.90, NULL, 'Combinados', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Hot Roll 8', 'Rolinho empanado com salmao.', 26.90, NULL, NULL, 'Hot Rolls', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Temaki Salmao', 'Temaki grande de salmao.', 24.90, NULL, NULL, 'Temakis', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Temaki Philadelfia', 'Temaki com cream cheese.', 26.50, NULL, NULL, 'Temakis', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Gyoza Suino', 'Guioza grelhado da casa.', 21.90, NULL, NULL, 'Entradas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Sunomono', 'Salada japonesa agridoce.', 15.90, NULL, NULL, 'Entradas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Yakissoba Frango', 'Macarrao oriental com legumes.', 29.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Mochi Sorvete', 'Sobremesa japonesa gelada.', 14.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Cha Gelado', 'Cha gelado sabor limao.', 8.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.03@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pizza Margherita', 'Molho, queijo e manjericao.', 42.90, NULL, NULL, 'Pizzas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pizza Calabresa', 'Calabresa com cebola.', 45.90, 41.90, NULL, 'Pizzas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pizza Quatro Queijos', 'Mistura especial de queijos.', 48.90, NULL, NULL, 'Pizzas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pizza Frango Catupiry', 'Frango desfiado com catupiry.', 49.90, NULL, NULL, 'Pizzas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Broto Portuguesa', 'Versao broto da portuguesa.', 29.90, NULL, NULL, 'Pizzas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Esfiha Carne', 'Esfiha aberta de carne.', 7.50, NULL, NULL, 'Esfihas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Esfiha Queijo', 'Esfiha aberta de queijo.', 7.50, NULL, NULL, 'Esfihas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Refrigerante 2L', 'Garrafa 2 litros.', 12.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Brownie com Sorvete', 'Brownie aquecido com sorvete.', 18.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Familia', 'Pizza grande, broto doce e refri.', 89.90, 79.90, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.04@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Expresso Curto', 'Cafe expresso intenso.', 6.50, NULL, NULL, 'Cafes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Capuccino', 'Cafe cremoso com canela.', 11.90, NULL, NULL, 'Cafes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Mocha Gelado', 'Cafe gelado com chocolate.', 14.90, NULL, NULL, 'Cafes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pao de Queijo 6un', 'Porcao tradicional mineira.', 12.90, NULL, NULL, 'Salgados', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Croissant Presunto', 'Croissant recheado.', 15.90, NULL, NULL, 'Salgados', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Torta de Frango', 'Fatia generosa da casa.', 13.90, NULL, NULL, 'Salgados', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Cheesecake Frutas', 'Cheesecake com calda vermelha.', 16.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Bolo de Cenoura', 'Fatia com cobertura de chocolate.', 10.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Suco Natural', 'Suco de laranja 400ml.', 9.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Brunch Aurora', 'Cafe, salgado e sobremesa.', 29.90, 26.90, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.05@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Picanha 400g', 'Picanha grelhada ao ponto.', 64.90, 59.90, NULL, 'Carnes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Contra File 350g', 'Corte nobre com farofa.', 52.90, NULL, NULL, 'Carnes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Costela BBQ', 'Costela assada com molho.', 58.90, NULL, NULL, 'Carnes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Frango na Brasa', 'Meio frango com ervas.', 36.90, NULL, NULL, 'Carnes', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Arroz Biro Biro', 'Arroz soltinho especial.', 17.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Farofa da Casa', 'Farofa crocante temperada.', 11.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Vinagrete', 'Porcao de vinagrete fresco.', 8.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Linguica Acebolada', 'Linguica artesanal grelhada.', 24.90, NULL, NULL, 'Petiscos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pudim', 'Pudim de leite condensado.', 12.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Guarana 1L', 'Refrigerante bem gelado.', 9.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.06@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Salada Caesar', 'Alface, frango e parmesao.', 24.90, NULL, NULL, 'Saladas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Bowl de Quinoa', 'Quinoa com legumes e graos.', 28.90, NULL, NULL, 'Bowls', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Wrap de Frango', 'Wrap integral com molho leve.', 23.90, NULL, NULL, 'Wraps', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Sanduiche Natural', 'Pao integral com recheio fresco.', 18.90, NULL, NULL, 'Lanches', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Sopa Detox', 'Creme verde nutritivo.', 19.90, NULL, NULL, 'Sopas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Suco Verde', 'Couve, maca e limao.', 11.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Smoothie Morango', 'Smoothie cremoso sem acucar.', 14.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Omelete Fit', 'Omelete com legumes.', 21.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Panqueca de Banana', 'Panqueca doce proteica.', 17.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Verde', 'Bowl e suco natural.', 34.90, 31.90, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.07@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Prato Feito Bife', 'Arroz, feijao, bife e salada.', 24.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Frango Ensopado', 'Frango caseiro com arroz.', 22.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Feijoada Individual', 'Feijoada completa individual.', 27.90, 24.90, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Macarrao Caseiro', 'Macarrao com molho da casa.', 21.90, NULL, NULL, 'Massas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Escondidinho', 'Escondidinho de carne seca.', 26.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Tutu com Linguica', 'Tutu mineiro tradicional.', 25.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Salada Simples', 'Folhas e tomate fresco.', 12.90, NULL, NULL, 'Saladas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Suco de Maracuja', 'Suco natural gelado.', 8.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Pudim Caseiro', 'Pudim de leite da vovo.', 11.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Almoco', 'Prato feito com bebida.', 29.90, 27.90, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.08@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Brownie Recheado', 'Brownie com recheio cremoso.', 13.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Torta Holandesa', 'Fatia gelada especial.', 16.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Bolo Red Velvet', 'Fatia com cream cheese.', 15.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Churros 6un', 'Churros com doce de leite.', 18.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Petit Gateau', 'Bolo quente com sorvete.', 19.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Acai 500ml', 'Acai com complementos.', 22.90, 19.90, NULL, 'Gelados', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Milkshake Morango', 'Milkshake artesanal.', 17.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Cafe Gelado', 'Cafe doce com gelo.', 9.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Waffle com Nutella', 'Waffle crocante recheado.', 21.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Festa', 'Duas sobremesas e bebida.', 34.90, NULL, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.09@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Yakissoba Carne', 'Macarrao oriental com carne.', 31.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Frango Xadrez', 'Cubos de frango com legumes.', 29.90, NULL, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Lamen Especial', 'Caldo encorpado com massa.', 33.90, 30.90, NULL, 'Pratos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Rolinho Primavera', 'Porcao com 6 unidades.', 16.90, NULL, NULL, 'Entradas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Guioza Frango', 'Guioza no vapor.', 18.90, NULL, NULL, 'Entradas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Arroz Chop Suey', 'Arroz oriental com legumes.', 17.90, NULL, NULL, 'Acompanhamentos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Tempura de Legumes', 'Legumes empanados crocantes.', 19.90, NULL, NULL, 'Entradas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Cha de Jasmim', 'Cha aromatico quente.', 7.90, NULL, NULL, 'Bebidas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Mousse de Lichia', 'Sobremesa leve da casa.', 13.90, NULL, NULL, 'Sobremesas', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local'
UNION ALL
SELECT e.id_estabelecimento, 'Combo Wok', 'Prato principal com bebida.', 39.90, 35.90, NULL, 'Combos', 1
FROM estabelecimentos e WHERE e.email = 'seed.demo.10@eatgo.local';

COMMIT;
