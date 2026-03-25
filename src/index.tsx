import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { dashboard } from './routes/dashboard'
import { api } from './routes/api'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// API routes
app.route('/api', api)

// Dashboard page
app.route('/', dashboard)

export default app
