import pactum from 'pactum';
import { eachLike, int, like, regex, string } from 'pactum-matchers';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { SimpleReporter } from '../simple-reporter';

/**
 * Testes de integração da Platzi Fake Store API.
 * Documentação: https://fakeapi.platzi.com/en/rest/introduction
 *
 * A API é pública e compartilhada, então cada execução cria os próprios
 * dados (usuário, categoria e produto) com o Faker e remove o que criou,
 * sem depender de registros que outras pessoas podem alterar.
 */
describe('Platzi Fake Store API', () => {
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://api.escuelajs.co/api/v1';
  const jwtPattern = /^[\w-]+\.[\w-]+\.[\w-]+$/;
  const imageUrl = 'https://placehold.co/600x400';

  const user = {
    name: faker.person.fullName(),
    email: faker.internet.email({ provider: 'qa-satc.com' }).toLowerCase(),
    password: faker.internet.password({ length: 10 }),
    avatar: imageUrl
  };

  const productSchema = {
    type: 'object',
    properties: {
      id: { type: 'number' },
      title: { type: 'string' },
      slug: { type: 'string' },
      price: { type: 'number' },
      description: { type: 'string' },
      category: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' }
        },
        required: ['id', 'name']
      },
      images: { type: 'array', items: { type: 'string' } }
    },
    required: ['id', 'title', 'price', 'description', 'category', 'images']
  };

  p.request.setBaseUrl(baseUrl);
  p.request.setDefaultTimeout(30000);

  beforeAll(() => p.reporter.add(rep));
  afterAll(() => p.reporter.end());

  describe('Usuários e autenticação', () => {
    it('Cadastra um novo usuário com perfil customer', async () => {
      await p
        .spec()
        .post('/users')
        .withJson(user)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonMatch({
          id: int(),
          name: user.name,
          email: user.email,
          role: 'customer',
          avatar: user.avatar
        })
        .stores('userId', 'id');
    });

    it('Informa que o e-mail recém-cadastrado não está mais disponível', async () => {
      await p
        .spec()
        .post('/users/is-available')
        .withJson({ email: user.email })
        .expectStatus(StatusCodes.CREATED)
        .expectJson({ isAvailable: false });
    });

    it('Rejeita cadastro de usuário com e-mail, senha e avatar inválidos', async () => {
      await p
        .spec()
        .post('/users')
        .withJson({
          name: user.name,
          email: 'email-invalido',
          password: '123',
          avatar: 'nao-e-url'
        })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          error: 'Bad Request',
          message: [
            'email must be an email',
            'password must be longer than or equal to 4 characters',
            'avatar must be a URL address'
          ]
        });
    });

    it('Autentica com credenciais válidas e retorna tokens JWT', async () => {
      await p
        .spec()
        .post('/auth/login')
        .withJson({ email: user.email, password: user.password })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonMatch({
          access_token: regex('header.payload.signature', jwtPattern),
          refresh_token: regex('header.payload.signature', jwtPattern)
        })
        .stores('accessToken', 'access_token');
    });

    it('Recusa login com senha incorreta', async () => {
      await p
        .spec()
        .post('/auth/login')
        .withJson({ email: user.email, password: 'senha-errada' })
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({
          message: 'Unauthorized',
          statusCode: StatusCodes.UNAUTHORIZED
        });
    });

    it('Retorna o perfil do usuário autenticado pelo token Bearer', async () => {
      await p
        .spec()
        .get('/auth/profile')
        .withBearerToken('$S{accessToken}')
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          id: '$S{userId}',
          email: user.email,
          name: user.name
        });
    });

    it('Nega acesso ao perfil quando o token não é enviado', async () => {
      await p
        .spec()
        .get('/auth/profile')
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJsonLike({ message: 'Unauthorized' });
    });
  });

  describe('Categorias', () => {
    const categoryName = `QA Categoria ${faker.string.alphanumeric(8)}`;
    const updatedName = `${categoryName} Atualizada`;

    it('Cria uma nova categoria', async () => {
      await p
        .spec()
        .post('/categories')
        .withJson({ name: categoryName, image: imageUrl })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonMatch({
          id: int(),
          name: categoryName,
          slug: string(),
          image: imageUrl
        })
        .stores('categoryId', 'id');
    });

    it('Atualiza o nome da categoria criada', async () => {
      await p
        .spec()
        .put('/categories/{id}')
        .withPathParams('id', '$S{categoryId}')
        .withJson({ name: updatedName })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ id: '$S{categoryId}', name: updatedName });
    });

    it('Exclui a categoria e confirma que ela não existe mais', async () => {
      await p
        .spec()
        .delete('/categories/{id}')
        .withPathParams('id', '$S{categoryId}')
        .expectStatus(StatusCodes.OK)
        // A API responde "true" com content-type text/html, então o corpo chega como texto.
        .expectBody('true');

      await p
        .spec()
        .get('/categories/{id}')
        .withPathParams('id', '$S{categoryId}')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ name: 'EntityNotFoundError' });
    });
  });

  describe('Produtos', () => {
    const product = {
      title: `QA Produto ${faker.string.alphanumeric(10)}`,
      price: faker.number.int({ min: 10, max: 500 }),
      description: faker.commerce.productDescription(),
      images: [imageUrl]
    };

    // Categoria exclusiva para os produtos deste bloco, removida no final.
    beforeAll(async () => {
      await p
        .spec()
        .post('/categories')
        .withJson({
          name: `QA Produtos ${faker.string.alphanumeric(8)}`,
          image: imageUrl
        })
        .expectStatus(StatusCodes.CREATED)
        .stores('productCategoryId', 'id');
    });

    afterAll(async () => {
      await p
        .spec()
        .delete('/categories/{id}')
        .withPathParams('id', '$S{productCategoryId}')
        .expectStatus(StatusCodes.OK);
    });

    it('Lista produtos com paginação respeitando o limite informado', async () => {
      await p
        .spec()
        .get('/products')
        .withQueryParams({ offset: 0, limit: 5 })
        .expectStatus(StatusCodes.OK)
        .expectJsonLength(5)
        .expectJsonSchema({ type: 'array', items: productSchema })
        .expectResponseTime(10000);
    });

    it('Filtra produtos por faixa de preço', async () => {
      const priceMin = 50;
      const priceMax = 100;

      await p
        .spec()
        .get('/products')
        .withQueryParams({ price_min: priceMin, price_max: priceMax })
        .expectStatus(StatusCodes.OK)
        .expect(ctx => {
          const products: { price: number }[] = ctx.res.json as never;
          expect(products.length).toBeGreaterThan(0);
          products.forEach(({ price }) => {
            expect(price).toBeGreaterThanOrEqual(priceMin);
            expect(price).toBeLessThanOrEqual(priceMax);
          });
        });
    });

    it('Cadastra um novo produto na categoria de teste', async () => {
      await p
        .spec()
        .post('/products')
        .withJson({ ...product, categoryId: '$S{productCategoryId}' })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonSchema(productSchema)
        .expectJsonLike({
          ...product,
          category: { id: '$S{productCategoryId}' }
        })
        .stores('productId', 'id');
    });

    it('Busca o produto cadastrado pelo id', async () => {
      await p
        .spec()
        .get('/products/{id}')
        .withPathParams('id', '$S{productId}')
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          id: '$S{productId}',
          title: product.title,
          price: product.price
        });
    });

    it('Lista os produtos da categoria e encontra apenas o produto cadastrado', async () => {
      await p
        .spec()
        .get('/categories/{id}/products')
        .withPathParams('id', '$S{productCategoryId}')
        .expectStatus(StatusCodes.OK)
        .expectJsonLength(1)
        .expectJsonMatch(
          eachLike({
            id: like(1),
            title: product.title,
            category: { id: int() }
          })
        );
    });

    it('Rejeita cadastro de produto sem imagens', async () => {
      await p
        .spec()
        .post('/products')
        .withJson({
          title: product.title,
          price: product.price,
          description: product.description,
          categoryId: '$S{productCategoryId}'
        })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          error: 'Bad Request',
          message: ['images should not be empty']
        });
    });

    it('Rejeita busca de produto com id não numérico', async () => {
      await p
        .spec()
        .get('/products/{id}')
        .withPathParams('id', 'abc')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJson({
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
          statusCode: StatusCodes.BAD_REQUEST
        });
    });

    it('Exclui o produto e confirma que ele não é mais encontrado', async () => {
      await p
        .spec()
        .delete('/products/{id}')
        .withPathParams('id', '$S{productId}')
        .expectStatus(StatusCodes.OK)
        .expectBody('true');

      await p
        .spec()
        .get('/products/{id}')
        .withPathParams('id', '$S{productId}')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ name: 'EntityNotFoundError' });
    });
  });
});
