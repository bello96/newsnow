// 阿里云 RPC API V1 签名（HMAC-SHA1），用于邮件推送 SingleSendMail
// 参考：https://help.aliyun.com/document_detail/29442.html

export function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~")
}

export function buildCanonicalizedQuery(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  return sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&")
}

export function buildStringToSign(method: string, params: Record<string, string>): string {
  const canonical = buildCanonicalizedQuery(params)
  return `${method}&${percentEncode("/")}&${percentEncode(canonical)}`
}

async function hmacSha1Base64(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg))
  const bytes = new Uint8Array(sigBuf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 返回签名后的完整 application/x-www-form-urlencoded body
export async function buildSignedBody(
  params: Record<string, string>,
  accessKeySecret: string,
  method = "POST",
): Promise<string> {
  const stringToSign = buildStringToSign(method, params)
  const signature = await hmacSha1Base64(`${accessKeySecret}&`, stringToSign)
  const canonical = buildCanonicalizedQuery(params)
  return `${canonical}&Signature=${percentEncode(signature)}`
}
