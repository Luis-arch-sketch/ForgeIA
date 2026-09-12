import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import pg from "pg";

const { Pool } = pg;

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("."));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Daily token quota configuration
const DAILY_TOKEN_QUOTA = 1000000000; // 1 billion tokens per day
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ESTIMATED_TOKENS_PER_REQUEST = 100; // baseline estimate, can be refined per request

// PostgreSQL connection pool (Railway provides DATABASE_URL via reference variable)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function initDb() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT UNIQUE NOT NULL,
      tokens_remaining BIGINT NOT NULL DEFAULT ${DAILY_TOKEN_QUOTA},
      last_reset TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("Users table ready.");
}

// Middleware: extract user ID from header or query param
function extractUserId(req, res, next) {
  const userId = req.header("X-User-ID") || req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "Usuário não identificado. Envie o header X-User-ID ou o parâmetro userId." });
  }
  req.userId = userId;
  next();
}

async function getOrCreateUser(userId) {
  const { rows } = await pool.query("SELECT * FROM users WHERE user_id = $1", [userId]);
  if (rows.length > 0) return rows[0];

  const inserted = await pool.query(
    `INSERT INTO users (user_id, tokens_remaining, last_reset)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId, DAILY_TOKEN_QUOTA]
  );
  return inserted.rows[0];
}

async function resetIfNeeded(user) {
  const lastReset = new Date(user.last_reset).getTime();
  const now = Date.now();
  if (now - lastReset >= RESET_INTERVAL_MS) {
    const { rows } = await pool.query(
      `UPDATE users SET tokens_remaining = $1, last_reset = NOW() WHERE user_id = $2 RETURNING *`,
      [DAILY_TOKEN_QUOTA, user.user_id]
    );
    return rows[0];
  }
  return user;
}

// Middleware: enforce daily token quota
async function tokenQuotaMiddleware(req, res, next) {
  try {
    let user = await getOrCreateUser(req.userId);
    user = await resetIfNeeded(user);

    const tokensNeeded = ESTIMATED_TOKENS_PER_REQUEST;

    if (user.tokens_remaining < tokensNeeded) {
      return res.status(402).json({
        error: "Cota diária de tokens esgotada. Novos tokens estarão disponíveis após 24 horas do último reset.",
        tokensRemaining: Number(user.tokens_remaining),
        lastReset: user.last_reset,
      });
    }

    const { rows } = await pool.query(
      `UPDATE users SET tokens_remaining = tokens_remaining - $1 WHERE user_id = $2 RETURNING *`,
      [tokensNeeded, req.userId]
    );

    req.tokenUser = rows[0];
    req.tokensCharged = tokensNeeded;
    next();
  } catch (e) {
    console.error("Token quota middleware error:", e);
    res.status(500).json({ error: "Erro ao verificar a cota de tokens." });
  }
}

app.post("/api/generate", extractUserId, tokenQuotaMiddleware, async (req, res) => {
  try {
    const { prompt, files = {} } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt não informado." });

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é o motor do ForgeAI, um construtor de sites. Crie ou altere o site conforme o pedido. Retorne SOMENTE JSON válido com html, css e javascript. Preserve funcionalidades existentes quando possível.
HTML atual:${files.html || ""}
CSS atual:${files.css || ""}
JavaScript atual:${files.javascript || ""}`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "A IA retornou JSON inválido." });
    }

    res.json({
      success: true,
      files: result,
      tokens: req.tokensCharged,
      tokensRemaining: Number(req.tokenUser.tokens_remaining),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Erro ao chamar a OpenAI." });
  }
});

initDb()
  .catch((e) => console.error("Erro ao inicializar o banco de dados:", e))
  .finally(() => {
    app.listen(process.env.PORT || 3000, () => console.log("ForgeAI rodando"));
  });
