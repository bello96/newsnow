import { getDouyinSelectPrompt, getDouyinWritePrompt } from "#/prompts/douyin"

// 返回口播稿生成的两份约束文档（选题 prompt + 写稿规范），供前端查看。
export default defineEventHandler(async () => {
  try {
    const [select, write] = await Promise.all([
      getDouyinSelectPrompt(),
      getDouyinWritePrompt(),
    ])
    return { select, write }
  } catch (e: any) {
    throw createError({ statusCode: 500, message: e?.message || "读取约束文档失败" })
  }
})
