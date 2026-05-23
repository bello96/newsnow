async function loadPrompt(name: string): Promise<string> {
  const content = await useStorage("assets:server").getItem<string>(`prompts/${name}`)
  if (!content) {
    throw new Error(`缺少 prompt 资源 ${name}，请确认 server/assets/prompts/${name} 已部署`)
  }
  return content
}

// 写稿 prompt：基于已选定的主线 + 呼应新闻及正文，产出口播稿
export function getDouyinWritePrompt(): Promise<string> {
  return loadPrompt("douyin.md")
}

// 选题 prompt：从今日标题列表选出主线 + 呼应新闻，输出 JSON
export function getDouyinSelectPrompt(): Promise<string> {
  return loadPrompt("douyin-select.md")
}

// 初筛 prompt：把今日全部标题去重 + 过滤，保留最多 50 条候选，输出 JSON 序号
export function getDouyinShortlistPrompt(): Promise<string> {
  return loadPrompt("douyin-shortlist.md")
}
