// ================================================================
// WORKFLOW ROUTES — /api/workflows
// ================================================================
import { Hono } from 'hono'
import type { Env } from '../lib/agents'
import type { Workflow, AgentName, IntentType } from '../types/core'
import { runAgent } from '../lib/agents'
import { WorkflowStore, IntentStore, AgentStore, AgentLogStore, genId } from '../lib/store'

const router = new Hono<{ Bindings: Env }>()

router.get('/', (c) => {
  return c.json({ success: true, data: WorkflowStore.all(), timestamp: new Date().toISOString() })
})

router.get('/:id', (c) => {
  const wf = WorkflowStore.get(c.req.param('id'))
  if (!wf) return c.json({ success: false, error: 'Workflow not found' }, 404)
  const intents = IntentStore.all().filter(i => i.workflowId === c.req.param('id'))
  return c.json({ success: true, data: { workflow: wf, intents }, timestamp: new Date().toISOString() })
})

router.post('/', async (c) => {
  const body = await c.req.json() as Partial<Workflow>
  if (!body.name) return c.json({ success: false, error: 'name required' }, 400)
  const wf: Workflow = {
    id: genId('wf'),
    name: body.name,
    description: body.description ?? '',
    triggerType: body.triggerType ?? 'manual',
    status: 'draft',
    steps: body.steps ?? [],
    currentStepIndex: 0,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agentsInvolved: body.agentsInvolved ?? [],
    totalIntents: body.steps?.length ?? 0,
    approvedIntents: 0,
    tags: body.tags ?? []
  }
  WorkflowStore.save(wf)
  return c.json({ success: true, data: wf, timestamp: new Date().toISOString() })
})

router.patch('/:id', async (c) => {
  const body = await c.req.json()
  const updated = WorkflowStore.update(c.req.param('id'), body)
  if (!updated) return c.json({ success: false, error: 'Workflow not found' }, 404)
  return c.json({ success: true, data: updated, timestamp: new Date().toISOString() })
})

router.delete('/:id', (c) => {
  const deleted = WorkflowStore.delete(c.req.param('id'))
  if (!deleted) return c.json({ success: false, error: 'Workflow not found' }, 404)
  return c.json({ success: true, message: 'Workflow deleted', timestamp: new Date().toISOString() })
})

// POST /api/workflows/:id/run — Run next step of a workflow
router.post('/:id/run-step', async (c) => {
  const wf = WorkflowStore.get(c.req.param('id'))
  if (!wf) return c.json({ success: false, error: 'Workflow not found' }, 404)
  if (wf.status === 'completed') return c.json({ success: false, error: 'Workflow already completed' }, 400)

  const currentStep = wf.steps[wf.currentStepIndex]
  if (!currentStep) return c.json({ success: false, error: 'No steps remaining' }, 400)

  try {
    // Determine intent type from step
    const intentType = getIntentTypeForStep(currentStep.agentName)
    const intent = await runAgent(currentStep.agentName as AgentName, intentType, {}, c.env, undefined, wf.id)

    IntentStore.save(intent)
    AgentStore.incrementIntents(currentStep.agentName as AgentName)

    // Update step status
    const updatedSteps = wf.steps.map((s, idx) => ({
      ...s,
      status: idx === wf.currentStepIndex ? 'in_progress' as const : s.status,
      intentId: idx === wf.currentStepIndex ? intent.id : s.intentId
    }))

    const nextIdx = wf.currentStepIndex + 1
    const progress = Math.round((nextIdx / wf.steps.length) * 100)
    const isComplete = nextIdx >= wf.steps.length

    WorkflowStore.update(wf.id, {
      steps: updatedSteps,
      currentStepIndex: isComplete ? wf.currentStepIndex : nextIdx,
      progress,
      status: isComplete ? 'completed' : 'active',
      completedAt: isComplete ? new Date().toISOString() : undefined
    })

    AgentLogStore.push({
      id: genId('log'), agentName: currentStep.agentName as AgentName,
      action: 'workflow_step', intentId: intent.id, status: 'success',
      message: `Executed step "${currentStep.label}" in workflow "${wf.name}"`,
      timestamp: new Date().toISOString()
    })

    return c.json({
      success: true,
      data: { intent, step: currentStep, progress, isComplete },
      message: isComplete
        ? `✅ Workflow "${wf.name}" completed!`
        : `✅ Step "${currentStep.label}" complete. ${wf.steps.length - nextIdx} steps remaining.`,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : 'Step failed' }, 500)
  }
})

function getIntentTypeForStep(agentName: string): IntentType {
  const map: Record<string, IntentType> = {
    MarketResearchAgent: 'market_trend',
    PricingAgent: 'pricing_adjust',
    InventoryAgent: 'inventory_restock',
    EmailMarketingAgent: 'email_campaign',
    ProductCreationAgent: 'product_create',
    BusinessHealthAgent: 'business_health',
    StrategyAgent: 'strategy_review'
  }
  return map[agentName] ?? 'business_health'
}

export default router
