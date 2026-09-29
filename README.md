# API test automation with Jest and PactumJS

> Simple integration between JestJS and PactumJS.

## GitHub Actions

[![Node.js CI](https://github.com/gabrielpagnan/integration-tests-prova02-GabrielMatiolaPagnan/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/gabrielpagnan/integration-tests-prova02-GabrielMatiolaPagnan/actions/workflows/node.js.yml)

## SonarCloud

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gabrielpagnan_integration-test-jest&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gabrielpagnan_integration-test-jest)

# Prova 02 — Platzi Fake Store API

Testes de integração da [Platzi Fake Store API](https://fakeapi.platzi.com/en/rest/introduction) (`https://api.escuelajs.co/api/v1`), escritos com Jest e PactumJS em [test/platzi_fake_store.spec.ts](test/platzi_fake_store.spec.ts).

A API é pública e compartilhada entre muitos usuários. Por isso, cada execução cria os próprios dados com o Faker (usuário, categorias e produto) e exclui o que criou, sem depender de registros que outras pessoas podem alterar.

### Como rodar

```bash
npm install
npx jest platzi_fake_store --config ./jest.config.js
```

### Cenários de teste

**Usuários e autenticação**

| # | Cenário | Endpoint | Resultado esperado |
|---|---------|----------|--------------------|
| 1 | Cadastra um novo usuário com perfil customer | `POST /users` | `201`, corpo com `id` inteiro, dados enviados e `role: customer` |
| 2 | Informa que o e-mail recém-cadastrado não está mais disponível | `POST /users/is-available` | `201`, `{ "isAvailable": false }` |
| 3 | Rejeita cadastro com e-mail, senha e avatar inválidos | `POST /users` | `400` com as três mensagens de validação |
| 4 | Autentica com credenciais válidas e retorna tokens JWT | `POST /auth/login` | `201`, `access_token` e `refresh_token` no formato JWT |
| 5 | Recusa login com senha incorreta | `POST /auth/login` | `401 Unauthorized` |
| 6 | Retorna o perfil do usuário autenticado pelo token Bearer | `GET /auth/profile` | `200`, mesmo `id`, `email` e `name` do cadastro |
| 7 | Nega acesso ao perfil quando o token não é enviado | `GET /auth/profile` | `401 Unauthorized` |

**Categorias (CRUD)**

| # | Cenário | Endpoint | Resultado esperado |
|---|---------|----------|--------------------|
| 8 | Cria uma nova categoria | `POST /categories` | `201`, `id`, `name`, `slug` e `image` |
| 9 | Atualiza o nome da categoria criada | `PUT /categories/{id}` | `200`, nome atualizado |
| 10 | Exclui a categoria e confirma que ela não existe mais | `DELETE /categories/{id}` + `GET` | `200 true`, depois `400 EntityNotFoundError` |

**Produtos**

| # | Cenário | Endpoint | Resultado esperado |
|---|---------|----------|--------------------|
| 11 | Lista produtos com paginação | `GET /products?offset=0&limit=5` | `200`, exatamente 5 itens válidos no JSON Schema, resposta em menos de 10 s |
| 12 | Filtra produtos por faixa de preço | `GET /products?price_min=50&price_max=100` | `200`, todos os preços entre 50 e 100 |
| 13 | Cadastra um novo produto na categoria de teste | `POST /products` | `201`, corpo válido no JSON Schema e com os dados enviados |
| 14 | Busca o produto cadastrado pelo id | `GET /products/{id}` | `200`, mesmo `id`, `title` e `price` |
| 15 | Lista os produtos da categoria | `GET /categories/{id}/products` | `200`, somente o produto cadastrado |
| 16 | Rejeita cadastro de produto sem imagens | `POST /products` | `400`, `images should not be empty` |
| 17 | Rejeita busca com id não numérico | `GET /products/abc` | `400`, `Validation failed (numeric string is expected)` |
| 18 | Exclui o produto e confirma que ele não é mais encontrado | `DELETE /products/{id}` + `GET` | `200 true`, depois `400 EntityNotFoundError` |

### Recursos do PactumJS utilizados

- `request.setBaseUrl` e `request.setDefaultTimeout` para configuração global
- `withJson`, `withPathParams`, `withQueryParams` e `withBearerToken` para montar as requisições
- `stores` e data templates `$S{...}` para encadear dados entre cenários (ids e token)
- `expectStatus`, `expectJson`, `expectJsonLike`, `expectJsonMatch` (com `pactum-matchers`: `int`, `string`, `regex`, `like`, `eachLike`), `expectJsonSchema`, `expectJsonLength`, `expectBody`, `expectResponseTime` e asserção customizada com `expect(ctx => ...)`
- Reporter customizado ([simple-reporter.ts](simple-reporter.ts)) que anexa request e response ao relatório HTML

### Observação sobre a API

O endpoint `PUT /products/{id}` responde `500 Internal Server Error` para qualquer corpo, então a atualização foi testada em categorias (`PUT /categories/{id}`), onde funciona.

# Getting Started

### Pactum docs:
 - [PactumJS](https://pactumjs.github.io/)

### Prerequisites:
 - NodeJS `v22`

### How to run?

Inside of the project folder run:

 1. `npm install --save-dev`
 1. `npm run ci`

After that you should see a `./output` folder with some `HTML` reports.

### Docs to Api under tests: 
 - [Dummyjson](https://dummyjson.com/docs)
 - [Gorest](https://gorest.co.in/)
 - [Toolshop API](https://api.practicesoftwaretesting.com/api/documentation)
 - [Deck of Cards](https://deckofcardsapi.com/)
 - [JSON placeholder](https://jsonplaceholder.typicode.com/)
 - [http bin](http://httpbin.org/)
 - [rick and morty api](https://rickandmortyapi.com/documentation/#rest)
 - [Petstore](https://petstore.swagger.io/#/) 
 - [ServeRest](https://serverest.dev/#/)
 - [ServeRest - Datadog](https://p.datadoghq.eu/sb/421fcfee-35ec-11ee-b87f-da7ad0900005-2aaf85264a89d11b7001bcab452a266e?refresh_mode=sliding&theme=light&tpl_var_env%5B0%5D=serverest.dev&from_ts=1699931511294&to_ts=1699932411294&live=true)
 a