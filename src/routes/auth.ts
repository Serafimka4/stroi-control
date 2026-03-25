import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context, Next } from 'hono'

type Bindings = { DB: D1Database }
type Variables = { user: any }
type Env = { Bindings: Bindings; Variables: Variables }

export const auth = new Hono<Env>()

// ============ HELPERS ============

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============ LOGIN ============

auth.post('/login', async (c) => {
  const db = c.env.DB
  const { login, password } = await c.req.json()
  
  if (!login || !password) {
    return c.json({ error: 'Login and password required' }, 400)
  }

  const passwordHash = await sha256(password)
  
  const user = await db.prepare(
    'SELECT id, login, name, role, engineer_id FROM users WHERE login = ? AND password_hash = ? AND active = 1'
  ).bind(login, passwordHash).first()

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // Create session (7 days)
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  
  await db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, (user as any).id, expiresAt).run()

  // Cleanup old sessions
  await db.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")').run()

  setCookie(c, 'sk_token', token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
  })

  return c.json({ 
    ok: true, 
    user: { id: (user as any).id, login: (user as any).login, name: (user as any).name, role: (user as any).role },
    token 
  })
})

// ============ LOGOUT ============

auth.post('/logout', async (c) => {
  const db = c.env.DB
  const token = getCookie(c, 'sk_token') || c.req.header('Authorization')?.replace('Bearer ', '')
  
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  }
  
  deleteCookie(c, 'sk_token', { path: '/' })
  return c.json({ ok: true })
})

// ============ ME ============

auth.get('/me', async (c) => {
  const db = c.env.DB
  const token = getCookie(c, 'sk_token') || c.req.header('Authorization')?.replace('Bearer ', '')
  
  if (!token) return c.json({ error: 'Not authenticated' }, 401)

  const session = await db.prepare(`
    SELECT u.id, u.login, u.name, u.role, u.engineer_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1
  `).bind(token).first()

  if (!session) return c.json({ error: 'Session expired' }, 401)

  return c.json({ user: session })
})


// ============ AUTH MIDDLEWARE ============

export async function authMiddleware(c: Context<Env>, next: Next) {
  const db = c.env.DB
  const token = getCookie(c, 'sk_token') || c.req.header('Authorization')?.replace('Bearer ', '')
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const session = await db.prepare(`
    SELECT u.id, u.login, u.name, u.role, u.engineer_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1
  `).bind(token).first()

  if (!session) {
    return c.json({ error: 'Session expired' }, 401)
  }

  c.set('user', session)
  await next()
}

// ============ ROLE CHECK HELPERS ============

export function requireRole(...roles: string[]) {
  return async (c: Context<Env>, next: Next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
