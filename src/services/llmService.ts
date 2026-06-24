import { useSettings } from '../composables/useSettings'

export interface ParsedTask {
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  color: string // 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan'
}

export async function parseVoiceCommand(text: string): Promise<ParsedTask> {
  const { settings } = useSettings()
  
  if (!settings.value.apiKey) {
    throw new Error('API Key is not configured. Please check your settings.')
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const todayDay = weekDays[today.getDay()]

  const prompt = `你是一个强大的日程管理助手。当前系统日期是：${todayStr} (${todayDay})。
用户通过语音输入了一段新建日程的指令。请提取关键信息，并严格按照以下 JSON 格式返回，不要包含任何多余的解释文字或 Markdown 标记。

{
  "title": "任务的标题",
  "date": "YYYY-MM-DD (推断出的具体日期)",
  "startTime": "HH:MM (24小时制)",
  "endTime": "HH:MM (24小时制，如果没有指明结束时间，请根据情景估算，默认时长1小时)",
  "color": "从 violet, blue, emerald, amber, rose, cyan 中选择一个符合任务氛围的颜色"
}

用户的语音指令是："${text}"`

  const response = await fetch(`${settings.value.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.value.apiKey}`
    },
    body: JSON.stringify({
      model: settings.value.modelName,
      messages: [
        { role: 'system', content: 'You are a JSON-only API. You must strictly return a valid JSON object without markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`API Request Failed: ${response.status} ${response.statusText}. ${errorData?.error?.message || ''}`)
  }

  const data = await response.json()
  let content = data.choices?.[0]?.message?.content || ''
  
  // Clean up potential markdown formatting
  content = content.trim()
  if (content.startsWith('```json')) {
    content = content.replace(/^```json/, '').replace(/```$/, '').trim()
  } else if (content.startsWith('```')) {
    content = content.replace(/^```/, '').replace(/```$/, '').trim()
  }

  try {
    const parsed = JSON.parse(content) as ParsedTask
    
    // Basic validation
    if (!parsed.title || !parsed.date || !parsed.startTime || !parsed.endTime) {
      throw new Error('Incomplete data returned by LLM')
    }
    
    return parsed
  } catch (e) {
    console.error('Failed to parse LLM response', content)
    throw new Error('无法解析 AI 返回的数据，请重试')
  }
}
