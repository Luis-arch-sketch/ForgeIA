# ForgeAI

ForgeAI é um construtor de sites com IA que transforma instruções em HTML, CSS e JavaScript usando a API da OpenAI.

## Funcionalidades

- Geração e alteração de sites por prompt.
- Preview do site em tempo real.
- Visualização do código gerado.
- Exportação do site para um arquivo HTML.
- Backend Express para manter a chave da OpenAI fora do navegador.
- Suporte a projetos novos.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Node.js
- Express
- OpenAI API
- dotenv

## Estrutura

```text
ForgeAI/
├── README.md
├── index.html
├── style.css
├── app.js
├── server.js
├── package.json
├── .env.example
└── .gitignore
```

## Requisitos

- Node.js instalado.
- Uma chave de API da OpenAI.

## Instalação

1. Entre na pasta do projeto:

```bash
cd ForgeAI
```

2. Instale as dependências:

```bash
npm install
```

3. Crie um arquivo chamado `.env` na raiz do projeto, baseado em `.env.example`:

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5
PORT=3000
```

**Nunca publique o arquivo `.env` no GitHub.** Ele já está protegido pelo `.gitignore`.

4. Inicie o ForgeAI:

```bash
npm start
```

5. Abra no navegador:

```text
http://localhost:3000
```

## Como usar

Digite no campo de prompt algo como:

```text
Crie uma landing page moderna para uma loja de tênis, com seção de produtos, preços, botão de compra e design responsivo.
```

O ForgeAI envia o pedido ao backend, que chama a OpenAI. A resposta deve conter HTML, CSS e JavaScript, que são carregados no preview.

Você também pode pedir alterações, por exemplo:

```text
Deixe o fundo escuro e adicione uma seção de depoimentos.
```

## API

### `POST /api/generate`

Recebe:

```json
{
  "prompt": "Crie uma página de login moderna",
  "files": {
    "html": "",
    "css": "",
    "javascript": ""
  }
}
```

Retorna os arquivos gerados:

```json
{
  "success": true,
  "files": {
    "html": "...",
    "css": "...",
    "javascript": "..."
  }
}
```

## Segurança

A chave da OpenAI deve ficar somente no servidor, dentro do `.env`.

Não coloque:

```env
OPENAI_API_KEY=...
```

dentro de `index.html`, `app.js` ou qualquer arquivo enviado ao navegador.

Também não publique sua chave no GitHub.

## Exportação

O botão **Exportar** gera um arquivo `forgeai-site.html` contendo o HTML, CSS e JavaScript do projeto atual.

## Publicação

O botão **Publicar** é apenas um aviso no estado atual do projeto. Para publicar o ForgeAI em produção, é necessário hospedar o backend Node.js e configurar a variável `OPENAI_API_KEY` no ambiente do servidor.

## Desenvolvimento

Para alterar a interface, edite:

- `index.html` — estrutura.
- `style.css` — aparência.
- `app.js` — comportamento do frontend.
- `server.js` — backend e integração com a OpenAI.

## Licença

Este projeto ainda não possui uma licença definida.


## 💳 Sistema de créditos

O ForgeAI usa créditos equivalentes aos tokens consumidos pela API.

- O saldo inicial é de **1.000.000.000 créditos**.
- Cada geração desconta o uso real de tokens retornado pela API.
- **Os créditos não expiram**.
- Um novo pacote de 1.000.000.000 só é liberado quando o saldo anterior estiver **zerado** e começar um novo dia.
- O saldo é mantido por um cookie assinado pelo servidor para sobreviver a recarregamentos e reinícios do serviço sem usar um banco de dados.
- `FORGEAI_CREDIT_SECRET` deve ser configurado no ambiente de produção.
- O fuso padrão para a virada do dia é `America/Sao_Paulo`.

> Observação: como o projeto atual não possui autenticação e banco de dados, o saldo é associado ao navegador por cookie assinado. Para contas individuais e controle contra uso em vários navegadores/dispositivos, será necessário adicionar login e banco de dados.

## 🔐 Contas e créditos persistentes

O sistema agora usa PostgreSQL para manter contas e saldo por usuário. Cada conta começa com 1.000.000.000 créditos. O saldo não expira. Se o saldo estiver zerado e chegar um novo dia, a conta recebe 1.000.000.000 novamente. Se ainda houver saldo, ele permanece e não recebe crédito extra.

No Render, configure `DATABASE_URL` apontando para um PostgreSQL e `FORGEAI_SESSION_SECRET` com um segredo longo. A chave da OpenAI nunca vai para o navegador.
