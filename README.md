# Puppeteer OAuth Automation

Script para automação de autenticação OAuth usando Puppeteer.
O foco é o fluxo de login, não a plataforma em si. O código demonstra:

- Conexão com Chrome via debugging remoto
- Tratamento de pop-ups, abas e iframes usados no OAuth
- Entrada de texto com intervalo variável
- Esperas baseadas em estado da página (selectors / URL / navegação)

---

## Dependências

- Node.js
- Google Chrome instalado
- Puppeteer (versão core)
- dotenv

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz:

TIKTOK_EMAIL=seu_email
TIKTOK_PASSWORD=sua_senha

---

## Inicializando o Chrome

Windows:
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeBotProfile"

