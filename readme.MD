# 🦇 Bot Black - Dead by Daylight Clan Manager

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Discloud](https://img.shields.io/badge/Discloud-Hosting-blue?style=for-the-badge)

O **Bot Black** é um bot multifuncional para Discord focado em gerenciar comunidades de Dead by Daylight. Ele organiza filas de jogadores (Squads), gerencia o histórico de vitórias (Streaks) da comunidade com sistema de aprovação de moderação, e atua como uma API (Web Server) para se conectar diretamente ao site oficial da comunidade, entregando cargos e anúncios automáticos (Sistema P100).

---

## 🚀 Funcionalidades Principais

### 1. 🏕️ Sistema de Fogueira (Squads Dinâmicos)
* Criação de "PTs" (Parties) através do comando `/fogueira`.
* Monitoramento automático de entrada e saída de membros em canais de voz.
* Anúncios visuais no chat mostrando quem está no squad.
* Geração automática de relatórios (Logs) de tempo jogado e participantes quando o canal de voz esvazia.

### 2. 🏆 Sistema de Streaks (Sequência de Vitórias)
* Registro de sequências como Sobrevivente ou Assassino (`/streak_iniciar`).
* Envio de prints de partida (`/streak_enviar`) que vão direto para um painel de moderação.
* Sistema de aprovação/recusa via botões (Moderação).
* Funções para pausar, continuar, finalizar ou excluir streaks, mantendo um ranking atualizado no servidor.

### 3. 🌐 Integração Web API (Galeria P100)
* O bot roda um servidor **Express.js** interno.
* Recebe requisições HTTP (Webhooks) do frontend do site da comunidade.
* Quando um jogador solicita o cargo P100 pelo site e o Admin aprova, o bot recebe a notificação instantaneamente, **aplica o cargo no Discord** e **envia um Embed estilizado** com a foto do personagem, print de tela inteira e mensagem do jogador.

---

## 🛠️ Tecnologias Utilizadas

* **[Node.js](https://nodejs.org/):** Ambiente de execução.
* **[Discord.js (v14)](https://discord.js.org/):** Biblioteca principal para interação com a API do Discord.
* **[Express](https://expressjs.com/):** Framework web utilizado para criar a API que escuta o site.
* **[Cors](https://www.npmjs.com/package/cors):** Middleware para permitir requisições seguras entre o site e o bot.
* **FS (File System):** Módulo nativo do Node para salvar o banco de dados local (`streaks.json`).

---

## 📁 Estrutura de Diretórios

A estrutura do projeto está organizada da seguinte forma:

```text
bot-black/
│
├── node_modules/         # Dependências do projeto (não suba pro GitHub/Discloud)
├── .env                  # Variáveis de ambiente (Token do bot)
├── .gitignore            # Arquivos ignorados pelo Git
├── discloud.config       # Configurações de hospedagem da Discloud
├── index.js              # Código principal do bot e da Web API
├── package-lock.json     # Árvore de dependências travada
├── package.json          # Configuração do projeto e scripts
└── readme.MD             # Documentação do projeto
```

---

## ⚙️ Como Configurar o Bot no Discord (Developer Portal)

Para que o bot funcione corretamente, você precisa configurá-lo no portal de desenvolvedores do Discord:

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Crie uma nova aplicação e vá na aba **Bot**.
3. **Pegue o Token:** Clique em `Reset Token` e copie a chave gerada (ela irá para o arquivo `.env`).
4. **Ative os Privileged Gateway Intents:** É OBRIGATÓRIO ativar as opções abaixo para o bot ler canais de voz e mensagens:
   * `Presence Intent`
   * `Server Members Intent`
   * `Message Content Intent`
5. **Convide o bot:** Vá em **OAuth2 > URL Generator**, selecione `bot` e `applications.commands`. Dê permissão de Administrador e use o link gerado para colocar o bot no seu servidor.

---

## 💻 Instalação e Configuração Local

1. Clone ou baixe este repositório.
2. Abra o terminal na pasta do projeto (`bot-black`) e instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo chamado `.env` na raiz do projeto e insira o seu token do Discord:
   ```env
   TOKEN=COLE_SEU_TOKEN_AQUI
   ```
4. **Configuração de IDs:** Abra o arquivo `index.js` e altere as variáveis de ID de Canais, Servidor e Cargos para os IDs correspondentes ao seu servidor do Discord:
   * *Exemplo: `CANAL_CONVITES_ID`, `CANAL_LOG_ID`, `GUILD_ID`, `CARGO_P100_ID`, etc.*
5. Inicie o bot:
   ```bash
   node index.js
   ```

---

## 🔗 Entendendo a Integração com o Site (P100)

O bot não é apenas um bot do Discord, ele também é uma **API REST**.

Ao final do arquivo `index.js`, o **Express.js** abre uma porta (ex: 8080) e cria a rota `POST /api/p100-aprovado`. 

**O Fluxo funciona assim:**
1. O usuário entra no site, preenche o formulário e envia o print.
2. O Administrador aprova no site.
3. O site (`p100.js`) faz um `fetch(POST)` enviando um JSON com Nome, Discord ID, Foto e Mensagem para a URL do Bot.
4. O bot recebe esses dados, procura o membro pelo ID no servidor, adiciona o cargo de P100 e manda a mensagem no canal da Galeria de Honra. Tudo em frações de segundo.

---

## ☁️ Hospedagem na Discloud

Para que a integração com o site funcione 24/7 sem erros, o bot precisa estar na Discloud configurado como um **Site** (para ter uma URL pública).

1. O seu arquivo `discloud.config` deve estar exatamente assim:
   ```text
   NAME=EntidadeFogueira
   TYPE=site
   MAIN=index.js
   RAM=100
   AUTORESTART=true
   VERSION=latest
   APT=tools
   ```
   *(Atenção especial para o `TYPE=site`. Isso é o que libera a URL pública).*
   
2. Compacte os arquivos (`index.js`, `package.json`, `.env`, etc.) em um arquivo `.zip` **(Não inclua a pasta `node_modules`)**.
3. Faça o upload no painel da Discloud.
4. Após o bot iniciar, copie o link que a Discloud gerar (ex: `https://botblack.discloud.app`) e adicione a rota `/api/p100-aprovado` no final. Cole essa URL completa no código do frontend (`p100.js`).

---

## 📜 Lista de Comandos Slash (/)

* `/fogueira` - Inicia um squad baseado no canal de voz atual do líder.
* `/fogueira_manual` - Exibe o tutorial de como usar as fogueiras.
* `/streak_iniciar` - Inicia uma contagem de vitórias (Sobrevivente ou Assassino).
* `/streak_enviar` - Envia print da vitória para a moderação aprovar.
* `/streak_pausar` - Pausa o progresso atual.
* `/streak_continuar` - Retoma uma streak pausada.
* `/streak_finalizar` - Encerra a streak e salva no mural do histórico.
* `/streak_excluir` - Cancela tudo sem salvar nada.
* `/streak_manual` - Exibe o tutorial do sistema de streaks.

---
*Desenvolvido pela administração do Clan DbD.*