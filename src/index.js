import puppeteer from "puppeteer-core";
import dotenv from "dotenv"; 

dotenv.config({ path: "../.env" });

if (!process.env.TIKTOK_EMAIL || !process.env.TIKTOK_PASSWORD) {
  console.error("❌ ERRO: crie arquivo 'arquivo.env' com TIKTOK_EMAIL e TIKTOK_PASSWORD");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function typeLikeHuman(context, selector, text, delayMin = 40, delayMax = 110) {
  await context.waitForSelector(selector, { visible: true, timeout: 20000 });
  await context.focus(selector);
  try {
    await context.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }
    }, selector);
  } catch {}
  for (const ch of text) {
    await context.type(selector, ch);
    const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
    await sleep(delay);
  }
}

async function findGoogleContext(page, browser, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (page.url().includes("accounts.google.com")) return { ctx: page };
    } catch {}

    try {
      for (const f of page.frames()) {
        if (f.url().includes("accounts.google.com")) return { ctx: f };
      }
    } catch {}

    try {
      const pages = await browser.pages();
      for (const p of pages) {
        if (p !== page && p.url().includes("accounts.google.com")) return { ctx: p };
      }
    } catch {}

    await sleep(300);
  }
  return null;
}

async function fillGoogleLogin(googleCtx, email, password) {
  const c = googleCtx.ctx;

  // Detectar tela com contas salvas e clicar em "Usar outra conta"
  try {
    const optionSelector = '.AsY17b';
    const exists = await c.$(optionSelector);

    if (exists) {
      console.log("➡️ Clicando em 'Usar outra conta'...");
      await c.click(optionSelector);
      await sleep(2000);
    }
  } catch {
    console.log("⚠️ Falha ao clicar em 'Usar outra conta'");
  }

  // Campo de email
  try {
    await c.waitForSelector('input[type="email"], input[name="identifier"]', { visible: true, timeout: 20000 });
    await typeLikeHuman(c, 'input[type="email"], input[name="identifier"]', email, 50, 120);
    await c.keyboard.press("Enter");
  } catch {
    throw new Error("Campo de e-mail não encontrado.");
  }

  await sleep(2000);

  // Campo de senha
  try {
    await c.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
    await typeLikeHuman(c, 'input[type="password"]', password, 50, 120);
    await c.keyboard.press("Enter");
  } catch {
    throw new Error("Campo de senha não encontrado.");
  }
}

async function run() {
  console.log("🚀 Conectando ao Chrome em http://localhost:9222 ...");
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: "http://localhost:9222", defaultViewport: null });
  } catch {
    console.error("❌ Falha ao conectar ao Chrome.");
    process.exit(1);
  }

  const pages = await browser.pages();
  let page = pages.length ? pages[0] : await browser.newPage();
  await page.bringToFront();

  console.log("🔗 Abrindo TikTok login...");
  await page.goto("https://www.tiktok.com/login", { waitUntil: "networkidle2" });
  console.log("✅ TikTok carregado.");

  await sleep(2000);

  console.log("⚠️ Forçando OAuth...");
  await page.goto("https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount?platform=google&client_id=1096011445005-sdea0nf5jvj14eia93icpttv27cidkvk.apps.googleusercontent.com&response_type=token&redirect_uri=https%3A%2F%2Fwww.tiktok.com%2Flogin%2F&scope=openid%20profile&prompt=consent", { waitUntil: "networkidle2" });

  const googleCtx = await findGoogleContext(page, browser, 10000);
  if (!googleCtx) {
    console.error("❌ Não foi possível se logar");
    process.exit(1);
  }

  console.log("🌐 Preenchendo login Google...");
  await fillGoogleLogin(googleCtx, process.env.TIKTOK_EMAIL, process.env.TIKTOK_PASSWORD);

  console.log("⏳ Aguardando retorno ao TikTok...");
  await sleep(7000);

  console.log("✅ Finalizado.");

  //Parte final 
try {
  // aguarda a URL de validação do OAuth
  await page.waitForFunction(
    () => window.location.href.includes('signin/oauth/id'),
    { timeout: 15000 }
  );

  console.log("⚠️ Tela de validação OAuth detectada, aguardando botão 'Continuar'...");

  // espera até que o botão com o texto "Continuar" esteja visível
  const botao = await page.waitForFunction(() => {
    const botoes = Array.from(document.querySelectorAll('button, div[role="button"]'));
    return botoes.find(b => b.innerText.trim() === 'Continuar') || null;
  }, { timeout: 15000 });

  if (botao) {
    await page.evaluate(() => {
      const botoes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const btn = botoes.find(b => b.innerText.trim() === 'Continuar');
      if (btn) btn.click();
    });

    console.log("✅ Botão 'Continuar' clicado com sucesso.");
    // aguarda a próxima navegação do OAuth
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  } else {
    console.log("⚠️ Botão 'Continuar' não encontrado, seguindo fluxo...");
  }
} catch (err) {
  console.log("⚠️ Erro ao tentar clicar no botão 'Continuar' na tela OAuth:", err.message);
}}

run().catch(err => {
  console.error("ERRO FATAL:", err);
});
