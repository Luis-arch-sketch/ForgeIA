# ForgeAI

ForgeAI é uma aplicação web que usa a API da OpenAI para gerar e modificar sites a partir de instruções em linguagem natural.

O usuário descreve o que deseja no chat e o ForgeAI solicita à IA uma atualização do projeto, recebendo HTML, CSS e JavaScript para atualizar o preview automaticamente.

## ✨ Funcionalidades

- Geração de sites por prompt.
- Alteração de sites existentes usando o código atual como contexto.
- Preview em tempo real dentro da aplicação.
- Visualização do código gerado.
- Exportação do site para um arquivo HTML único.
- Criação de um novo projeto.
- Backend protegido para comunicação com a API da OpenAI.
- Configuração do modelo e da porta por variáveis de ambiente.

## 🧱 Tecnologias

- **Node.js**
- **Express 5**
- **OpenAI API**
- **dotenv**
- HTML5
- CSS3
- JavaScript

## 📁 Estrutura do projeto

```text
ForgeAI/
├── index.html        # Interface principal da aplicação
├── style.css         # Estilos da interface
├── app.js            # Lógica do frontend e comunicação com o backend
├── server.js         # Servidor Express e integração com a OpenAI
├── package.json      # Dependências e scripts do projeto
├── .env.example      # Exemplo das variáveis de ambiente
├── .gitignore        # Arquivos ignorados pelo Git
└── README.md         # Documentação do projeto
```

## 🚀 Instalação

### 1. Pré-requisitos

Instale o **Node.js** em uma versão compatível com o projeto.

Também é necessária uma chave de API da OpenAI para utilizar a geração de sites.

### 2. Instale as dependências

No diretório do projeto, execute:

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
OPENAI_API_KEY=SUA_CHAVE_DA_OPENAI
OPENAI_MODEL=gpt-5
PORT=3000
```

Você pode usar `.env.example` como referência.

> **Importante:** nunca publique sua `OPENAI_API_KEY` no frontend, no GitHub ou em arquivos acessíveis pelo navegador. A chave deve permanecer somente no servidor.

### 4. Inicie o ForgeAI

```bash
npm start
```

O servidor será iniciado na porta configurada. Por padrão:

```text
http://localhost:3000
```

Abra esse endereço no navegador.

## 💬 Como usar

1. Abra o ForgeAI no navegador.
2. Digite no campo de prompt o que deseja criar.
3. Clique em **Gerar**.
4. A aplicação enviará o pedido para o backend.
5. O backend enviará o pedido para a OpenAI.
6. A resposta da IA será interpretada como JSON contendo `html`, `css` e `javascript`.
7. O preview será atualizado automaticamente.

### Exemplo de prompt

```text
Crie uma landing page moderna para uma empresa de tecnologia, com hero section, botão de chamada para ação, seção de benefícios e design responsivo.
```

Para alterar o site existente, basta descrever a mudança:

```text
Adicione uma seção de depoimentos abaixo dos benefícios e mantenha o estilo visual atual.
```

## 🧠 Funcionamento da IA

O endpoint principal da aplicação é:

```text
POST /api/generate
```

Ele recebe um objeto semelhante a:

```json
{
  "prompt": "Crie uma página de login moderna",
  "files": {
    "html": "...",
    "css": "...",
    "javascript": "..."
  }
}
```

O servidor envia para a OpenAI o prompt do usuário junto com o código atual do projeto. A IA é instruída a retornar somente um JSON contendo:

```json
{
  "html": "...",
  "css": "...",
  "javascript": "..."
}
```

Esse resultado é usado pelo frontend para atualizar o preview e o código exibido.

## 📤 Exportação

O botão **Exportar** gera um arquivo HTML único contendo:

- HTML do projeto;
- CSS incorporado em `<style>`;
- JavaScript incorporado em `<script>`.

O arquivo gerado pode ser aberto diretamente no navegador ou enviado para uma hospedagem de páginas estáticas, desde que o site não dependa de funcionalidades de backend.

## 🌐 Publicação

O botão **Publicar** atualmente exibe uma orientação para utilizar uma hospedagem com backend.

A publicação automática ainda não está implementada. Para colocar o ForgeAI em produção, é necessário hospedar o servidor Node.js e configurar a variável `OPENAI_API_KEY` no ambiente do servidor.

> Não coloque a chave da OpenAI dentro de `index.html`, `app.js`, `style.css` ou qualquer outro arquivo enviado ao navegador.

## 🔐 Segurança

Algumas boas práticas importantes para uma implantação real:

- Mantenha a `OPENAI_API_KEY` somente no backend.
- Não envie o arquivo `.env` para o Git.
- Configure limites de requisições (rate limiting) em produção.
- Valide e limite o tamanho dos prompts recebidos.
- Considere autenticação caso a aplicação seja disponibilizada publicamente.
- Adicione proteção contra abuso da API.
- Revise o HTML/JavaScript gerado antes de permitir publicação automática.

## 🛠️ Desenvolvimento

Para iniciar o projeto durante o desenvolvimento:

```bash
npm start
```

O script atualmente definido em `package.json` é:

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

## 📌 Observações

O ForgeAI é um construtor de sites baseado em prompts. A qualidade do resultado depende tanto da instrução fornecida quanto do modelo configurado em `OPENAI_MODEL`.

O projeto mantém o código atual no estado da aplicação durante a sessão. Persistência de projetos, contas de usuários, banco de dados, publicação automática e autenticação ainda não fazem parte da implementação atual.

## 📄 Licença

Este projeto não possui uma licença de código aberto definida neste momento.
