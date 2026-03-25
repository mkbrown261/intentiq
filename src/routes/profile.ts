// ============================================================
// PROFILE API ROUTES
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../lib/aiService'
import { getUserProfile, updateUserProfile } from '../lib/store'

const profile = new Hono<{ Bindings: Env }>()

profile.get('/', (c) => {
  return c.json({
    success: true,
    data: getUserProfile(),
    timestamp: new Date().toISOString()
  })
})

profile.patch('/', async (c) => {
  const body = await c.req.json()
  const updated = updateUserProfile(body)
  return c.json({
    success: true,
    data: updated,
    message: 'Profile updated. AI will now personalize intents based on your new settings.',
    timestamp: new Date().toISOString()
  })
})

export default profile
