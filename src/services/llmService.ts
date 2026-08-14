import { useSettings } from '../composables/useSettings'
import { EVENT_COLOR_KEYS } from '../constants/colors'
import { useUsage } from '../composables/useUsage'

/** 语音解析出的操作载荷（add/edit event 或 add todo） */
export interface VoicePayload {
  title?: string
  date?: string         // YYYY-MM-DD
  startTime?: string    // HH:MM
  endTime?: string      // HH:MM
  color?: string        // EventColor key（violet/blue/...）
  todoText?: string
}

export interface VoiceIntent {
  action: 'add' | 'edit' | 'delete' | 'unknown'
  target: 'event' | 'todo' | 'unknown'
  targetId?: string
  searchQuery?: string
  payload?: VoicePayload
}

export interface ContextData {
  events: Array<{ id: string, title: string, date: string }>
  todos: Array<{ id: string, text: string }>
}

export async function parseVoiceCommand(text: string, forceCloud: boolean = false, contextData?: ContextData): Promise<VoiceIntent> {
  const { settings } = useSettings()
  const mode = forceCloud ? 'cloud' : settings.value.aiMode
  
  if (mode === 'cloud' && !settings.value.apiKey) {
    throw new Error('API Key is not configured for Cloud mode. Please check your settings.')
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const todayDay = weekDays[today.getDay()]

  let contextStr = ''
  if (contextData) {
    contextStr = `\n\n注意：用户的日程本中目前有以下可能相关的记录作为参考（用户的语音可能有口音或识别谐音错误，请结合此列表进行智能推断）：\n`
    if (contextData.events.length > 0) {
      contextStr += `【现有日程】\n`
      contextData.events.forEach(e => contextStr += `- ID: ${e.id}, 标题: "${e.title}", 日期: ${e.date}\n`)
    }
    if (contextData.todos.length > 0) {
      contextStr += `【现有待办】\n`
      contextData.todos.forEach(t => contextStr += `- ID: ${t.id}, 内容: "${t.text}"\n`)
    }
  }

  const prompt = `你是一个强大的日程与待办管理大脑。当前系统日期是：${todayStr} (${todayDay})。${contextStr}
用户通过语音输入了一段指令。请提取核心意图，并严格按照以下 JSON 格式返回，不要包含任何多余的解释文字或 Markdown 标记。

{
  "action": "add" | "edit" | "delete" | "unknown",
  "target": "event" | "todo" | "unknown",
  "targetId": "如果 action 是 edit 或 delete，且你推断用户的意图对应了上方列表中的某一项（即使语音识别出现谐音或错别字，例如把'日程'识别成'日照'），请直接返回该项的确切 ID。如果无法确定，请留空。",
  "searchQuery": "如果 action 是 edit 或 delete 且无法确定 targetId，这里提取关键词，如果是 add 则留空",
  "payload": {
    "title": "任务的标题 (仅 add 或 edit event 时需要)",
    "date": "YYYY-MM-DD (推断出的具体日期, 仅 add 或 edit event 时需要)",
    "startTime": "HH:MM (24小时制, 仅 add 或 edit event 时需要)",
    "endTime": "HH:MM (24小时制，如果没有指明结束时间，默认时长1小时, 仅 add 或 edit event 时需要)",
    "color": "从 ${EVENT_COLOR_KEYS} 中选择一个符合氛围的颜色 (仅 add 或 edit event 时需要)",
    "todoText": "待办事项的具体内容 (仅 add 或 edit todo 时需要)"
  }
}

用户的语音指令是："${text}"`

  const messages = [
    { role: 'system', content: 'You are a JSON-only API. You must strictly return a valid JSON object without markdown formatting.' },
    { role: 'user', content: prompt }
  ]

  let content = ''

  if (mode === 'local') {
    // Lazy load WebLLM only if selected
    const { getLocalEngine } = await import('./webLlmManager')
    const engine = await getLocalEngine()
    
    // Convert messages to right format for WebLLM
    const reply = await engine.chat.completions.create({
      messages: messages as any,
      temperature: 0.1
    })
    content = reply.choices[0].message.content || ''
  } else {
    const baseUrl = settings.value.apiBaseUrl.replace(/\/+$/, '')
    // 安全校验：API Key 会以 Bearer 发往该地址，仅允许 https（本地开发可用 http://localhost），
    // 防止用户误填或被篡改后把 key 明文发往任意 HTTP 域名。
    if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/localhost/i.test(baseUrl)) {
      throw new Error('API 地址必须使用 https://（本地调试可用 http://localhost），请检查设置中的 API 地址。')
    }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.value.apiKey}`
      },
      body: JSON.stringify({
        model: settings.value.modelName,
        messages,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`API Request Failed: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`)
    }

    const data = await response.json()
    content = data.choices?.[0]?.message?.content || ''
    
    if (data.usage) {
      const { addRecord } = useUsage()
      addRecord({
        model: settings.value.modelName,
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
        requestContent: text,
        responseContent: content,
        rawPrompt: prompt
      })
    }
  }
  
  // Use regex to robustly extract the JSON object
  let jsonString = content
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonString = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonString) as VoiceIntent
    
    if (parsed.action === 'unknown' || parsed.target === 'unknown') {
      throw new Error('无法识别您的操作意图，请说得更具体一点。')
    }
    
    return parsed
  } catch (e: any) {
    console.error('Failed to parse LLM response', content)
    throw new Error(e.message || '无法解析 AI 返回的数据，请重试')
  }
}
