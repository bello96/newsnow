import { getSearchParams } from "./utils"

interface Item {
  id: number
  title?: string
  brief: string
  shareurl: string
  ctime: number
  is_ad: number
}

interface Hot {
  data: Item[]
}

const hot = defineSource(async () => {
  const apiUrl = `https://www.cls.cn/v2/article/hot/list`
  const res: Hot = await myFetch(apiUrl, {
    query: Object.fromEntries(await getSearchParams()),
  })
  return res.data.map((k) => {
    return {
      id: k.id,
      title: k.title || k.brief,
      mobileUrl: k.shareurl,
      url: `https://www.cls.cn/detail/${k.id}`,
    }
  })
})

export default hot
