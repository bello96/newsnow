export async function getDouyinSystemPrompt(): Promise<string> {
  const content = await useStorage("assets:server").getItem<string>("prompts/douyin.md")
  if (!content) {
    throw new Error("缺少 douyin prompt 资源，请确认 server/assets/prompts/douyin.md 已部署")
  }
  return content
}
