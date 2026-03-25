import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { dashboard } from './routes/dashboard'
import { api } from './routes/api'
import { auth } from './routes/auth'
import { crud } from './routes/crud'

type Bindings = { DB: D1Database }
type Variables = { user: any }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('/api/*', cors())

// Public auth routes
app.route('/api/auth', auth)

// Public read-only KPI (for dashboard without auth — or protect if needed)
app.route('/api', api)

// Protected CRUD routes
app.route('/api/crud', crud)

// Pages
app.route('/', dashboard)

export default app
