import puppeteer from "puppeteer-core";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

if (!process.env.TIKTOK_EMAIL || !process.env.TIKTOK_PASSWORD) {
  console.error("❌ ERRO: crie arquivo '.env' com TIKTOK_EMAIL e TIKTOK_PASSWORD");
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
      if (el) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, selector);
  } catch {}
  for (const ch of text) {
    await context.type(selector, ch);
    const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
    await sleep(delay);
  }
}

// --- encontra aba ou frame do Google depois do clique
async function findGoogleContextAfterClick(browser, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pages = await browser.pages();
    for (const page of pages) {
      if (page.url().includes("accounts.google.com")) {
        return { ctx: page };
      }
      try {
        for (const frame of page.frames()) {
          if (frame.url().includes("accounts.google.com")) return { ctx: frame };
        }
      } catch {}
    }
    await sleep(300);
  }
  return null;
}

async function fillGoogleLogin(googleCtx, email, password) {
  const c = googleCtx.ctx;

  // Aguardar a tela carregar completamente 
  console.log("⏳ Aguardando tela do Google carregar...");
  try {
    await c.waitForSelector('input[type="email"], input[name="identifier"], .AsY17b', { visible: true, timeout: 15000 });
    console.log("✅ Tela do Google carregada.");
  } catch {
    console.log("⚠️ Tela do Google não carregou completamente, continuando...");
  }
  await sleep(3000); // Pausa para renderização

  // "Usar outra conta" 
  try {
    const optionSelector = ".AsY17b";  // Seletor específico, pode variar 
    const exists = await c.$(optionSelector);
    if (exists) {
      console.log("➡️ Clicando em 'Usar outra conta'...");
      await exists.click();
      await sleep(2000);
    } else {
      console.log("ℹ️ Botão 'Usar outra conta' não encontrado.");
    }
  } catch {
    console.log("⚠️ Falha ao clicar em 'Usar outra conta'");
  }

  // Campo de email
  await c.waitForSelector('input[type="email"], input[name="identifier"]', { visible: true, timeout: 20000 });
  await typeLikeHuman(c, 'input[type="email"], input[name="identifier"]', email, 50, 120);
  await c.keyboard.press("Enter");
  await sleep(2000);

  // Campo de senha
  await c.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });
  await typeLikeHuman(c, 'input[type="password"]', password, 50, 120);
  await c.keyboard.press("Enter");
  await sleep(2000);

  // --- Clicar no botão "Continuar" 
  console.log("⏳ Aguardando botão 'Continuar' na página do Google...");
  try {
    const botao = await c.waitForFunction(() => {
      const botoes = Array.from(document.querySelectorAll('button, div[role="button"]'));
      return botoes.find(b => b.innerText.trim() === 'Continuar') || null;
    }, { timeout: 15000 });

    if (botao) {
      await c.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const btn = botoes.find(b => b.innerText.trim() === 'Continuar');
        if (btn) btn.click();
      });
      console.log("✅ Botão 'Continuar' clicado com sucesso na página do Google.");
      // Aguarda a navegação de volta ao TikTok
      await c.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    } else {
      console.log("⚠️ Botão 'Continuar' não encontrado na página do Google.");
    }
  } catch (err) {
    console.log("⚠️ Erro ao clicar no botão 'Continuar' na página do Google:", err.message);
  }
}

async function run() {
  console.log("🚀 Conectando ao Chrome...");
  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222", defaultViewport: null });

  const pages = await browser.pages();
  const page = pages.length ? pages[0] : await browser.newPage();
  await page.bringToFront();

  console.log("🔗 Abrindo TikTok login...");
  await page.goto("https://www.tiktok.com/login", { waitUntil: "networkidle2" });
  await sleep(2000);

  // --- clicar no botão do Google
  await page.waitForSelector(".tiktok-1cp64nz-DivTextContainer.e1cgu1qo3", { visible: true, timeout: 10000 });
  const buttons = await page.$$(".tiktok-1cp64nz-DivTextContainer.e1cgu1qo3");
  if (buttons.length >= 4) {
    await buttons[3].click();
    console.log("✅ Botão do Google clicado.");
  } else {
    console.log("⚠️ Botão do Google não encontrado");
    process.exit(1);
  }

  // --- detectar aba ou frame do Google após clique
  const googleCtx = await findGoogleContextAfterClick(browser, 15000);
  if (!googleCtx) {
    console.error("❌ Não foi possível detectar aba/frame do Google após clique");
    process.exit(1);
  }

  console.log("🌐 Preenchendo login Google...");
  await fillGoogleLogin(googleCtx, process.env.TIKTOK_EMAIL, process.env.TIKTOK_PASSWORD);

  console.log("✅ Login concluído!");
}

run().catch(err => console.error("ERRO FATAL:", err));