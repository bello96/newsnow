import { getDouyinSelectPrompt, getDouyinShortlistPrompt, getDouyinWritePrompt } from "#/prompts/douyin"

// 返回口播稿生成的约束文档（初筛 + 选题 + 写稿规范），供前端查看。
export default defineEventHandler(async () => {
  try {
    const [shortlist, select, write] = await Promise.all([
      getDouyinShortlistPrompt(),
      getDouyinSelectPrompt(),
      getDouyinWritePrompt(),
    ])
    return { shortlist, select, write }
  } catch (e: any) {
    throw createError({ statusCode: 500, message: e?.message || "读取约束文档失败" })
  }
})
