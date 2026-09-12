import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("."));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined });

const DAILY_CREDITS = 1_000_000_000;
const SESSION_COOKIE = "forgeai_session";
const SESSION_SECRET = process.env.FORGEAI_SESSION_SECRET || process.env.FORGEAI_CREDIT_SECRET || crypto.randomBytes(32).toString("hex");
const RESET_TIMEZONE = process.env.FORGEAI_TIMEZONE || "America/Sao_Paulo";

if (!SESSION_SECRET) console.warn("FORGEAI_SESSION_SECRET não configurado.");

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: RESET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function sign(v) { return crypto.createHmac("sha256", SESSION_SECRET || "dev").update(v).digest("base64url"); }
function makeToken(id) { const p = Buffer.from(id).toString("base64url"); return `${p}.${sign(p)}`; }
function readToken(v) {
  try {
    const [p, s] = String(v || "").split(".");
    if (!p || !s || s !== sign(p)) return null;
    return Buffer.from(p, "base64url").toString("utf8");
  } catch { return null; }
}
function cookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setCookie(req, res, name, value, maxAge = 60 * 60 * 24 * 30) {
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}
async function authUser(req) {
  const token = cookie(req, SESSION_COOKIE);
  if (!token) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await pool.query("SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at > NOW()", [hash]);
  return rows[0]?.user_id || null;
}
async function requireAuth(req, res, next) {
  try {
    const id = await authUser(req);
    if (!id) return res.status(401).json({ error: "Usuário não identificado. Entre na sua conta novamente." });
    req.userId = id; next();
  } catch (e) { console.error(e); res.status(500).json({ error: "Não foi possível verificar sua sessão." }); }
}
function issueSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')", [hash, userId]).then(() => setCookie(req,res,SESSION_COOKIE,token));
}

function estimateInputTokens(prompt, files) { return Math.ceil(`${prompt}\n${JSON.stringify(files || {})}`.length / 4); }

async function initDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurado no Render.");
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, credits BIGINT NOT NULL DEFAULT ${DAILY_CREDITS}, last_credit_day DATE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);`);
  console.log("Banco ForgeAI pronto");
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) return res.status(400).json({ error: "Use um e-mail válido e senha com pelo menos 6 caracteres." });
    const hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    await pool.query("INSERT INTO users(id,email,password_hash,last_credit_day) VALUES($1,$2,$3,$4)", [id, email, hash, today()]);
    await issueSession(req, res, id);
    res.json({ success: true, email, remaining: DAILY_CREDITS });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    console.error(e); res.status(500).json({ error: "Não foi possível criar a conta." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const { rows } = await pool.query("SELECT id,email,password_hash FROM users WHERE email=$1", [email]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: "E-mail ou senha incorretos." });
    await issueSession(req, res, rows[0].id);
    res.json({ success: true, email: rows[0].email });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao entrar." }); }
});

app.post("/api/auth/logout", async (req, res) => { try { const token=cookie(req,SESSION_COOKIE); if(token){ const hash=crypto.createHash("sha256").update(token).digest("hex"); await pool.query("DELETE FROM sessions WHERE token_hash=$1",[hash]); } } catch(e){ console.error(e); } setCookie(req,res,SESSION_COOKIE,"",0); res.json({success:true}); });

app.get("/api/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT email,credits,last_credit_day FROM users WHERE id=$1", [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: "Conta não encontrada." });
  const current = today();
  let credits = Number(rows[0].credits);
  if (rows[0].last_credit_day !== current && credits === 0) {
    await pool.query("UPDATE users SET credits=$1,last_credit_day=$2 WHERE id=$3", [DAILY_CREDITS, current, req.userId]);
    credits = DAILY_CREDITS;
  } else if (rows[0].last_credit_day !== current) {
    await pool.query("UPDATE users SET last_credit_day=$1 WHERE id=$2", [current, req.userId]);
  }
  res.json({ email: rows[0].email, remaining: credits, dailyCredits: DAILY_CREDITS, day: current, timezone: RESET_TIMEZONE });
});

app.post("/api/generate", requireAuth, async (req, res) => {
  const { prompt, files = {} } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt não informado." });
  const current = today();
  const estimatedInput = estimateInputTokens(prompt, files);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const q = await client.query("SELECT credits,last_credit_day FROM users WHERE id=$1 FOR UPDATE", [req.userId]);
    if (!q.rows[0]) { await client.query("ROLLBACK"); return res.status(401).json({ error: "Conta não encontrada." }); }
    let credits = Number(q.rows[0].credits);
    if (q.rows[0].last_credit_day !== current && credits === 0) credits = DAILY_CREDITS;
    if (credits < estimatedInput) { await client.query("ROLLBACK"); return res.status(402).json({ error: "Créditos insuficientes para esta geração.", remaining: credits }); }
    await client.query("UPDATE users SET credits=$1,last_credit_day=$2 WHERE id=$3", [credits, current, req.userId]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }

  try {
    const response = await openai.responses.create({ model: process.env.OPENAI_MODEL || "gpt-5", input: [
      { role: "system", content: `Você é o motor do ForgeAI, um construtor de sites. Crie ou altere o site conforme o pedido. Retorne SOMENTE JSON válido com html, css e javascript. Preserve funcionalidades existentes quando possível.\nHTML atual:${files.html || ""}\nCSS atual:${files.css || ""}\nJavaScript atual:${files.javascript || ""}` },
      { role: "user", content: prompt }
    ] });
    let result; try { result = JSON.parse(response.output_text); } catch { return res.status(500).json({ error: "A IA retornou JSON inválido." }); }
    const tokensUsed = Math.max(1, Math.ceil(Number(response.usage?.total_tokens || estimatedInput)));
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const q = await c.query("SELECT credits FROM users WHERE id=$1 FOR UPDATE", [req.userId]);
      const newBalance = Math.max(0, Number(q.rows[0].credits) - tokensUsed);
      await c.query("UPDATE users SET credits=$1,last_credit_day=$2 WHERE id=$3", [newBalance, current, req.userId]);
      await c.query("COMMIT");
      return res.json({ success: true, files: result, tokens: tokensUsed, remaining: newBalance });
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  } catch (e) { console.error(e); res.status(500).json({ error: e.message || "Erro ao chamar a OpenAI." }); }
});

initDb().then(() => app.listen(process.env.PORT || 3000, () => console.log("ForgeAI rodando"))).catch(e => { console.error(e); process.exit(1); });
