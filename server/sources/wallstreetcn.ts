interface Item {
  uri: string
  id: number
  title?: string
  content_text: string
  content_short: string
  display_time: number
  type?: string
}

interface HotRes {
  data: {
    day_items: Item[]
  }
}

const hot = defineSource(async () => {
  const apiUrl = `https://api-one.wallstcn.com/apiv1/content/articles/hot?period=all`

  const res: HotRes = await myFetch(apiUrl)
  return res.data.day_items
    .map((h) => {
      return {
        id: h.id,
        title: h.title!,
        url: h.uri,
      }
    })
})

export default hot
