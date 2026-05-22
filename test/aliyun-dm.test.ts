import { describe, expect, it } from "vitest"
import { buildSignedBody, buildStringToSign, percentEncode } from "#/utils/aliyun-dm"

describe("percentEncode", () => {
  it("空格编码为 %20", () => {
    expect(percentEncode("a b")).toBe("a%20b")
  })
  it("星号编码为 %2A", () => {
    expect(percentEncode("a*b")).toBe("a%2Ab")
  })
  it("波浪号不编码", () => {
    expect(percentEncode("a~b")).toBe("a~b")
  })
  it("冒号编码为 %3A", () => {
    expect(percentEncode("12:46:24")).toBe("12%3A46%3A24")
  })
})

describe("buildStringToSign", () => {
  it("符合阿里云官方示例的 StringToSign 结构", () => {
    const params = {
      AccessKeyId: "testid",
      Action: "DescribeRegions",
      Format: "XML",
      SignatureMethod: "HMAC-SHA1",
      SignatureNonce: "3ee8c1b8-83d3-44af-a94f-4e0ad82fd6cf",
      SignatureVersion: "1.0",
      Timestamp: "2016-02-23T12:46:24Z",
      Version: "2014-05-26",
    }
    const sts = buildStringToSign("GET", params)
    expect(sts).toBe(
      "GET&%2F&AccessKeyId%3Dtestid%26Action%3DDescribeRegions%26Format%3DXML"
      + "%26SignatureMethod%3DHMAC-SHA1%26SignatureNonce%3D3ee8c1b8-83d3-44af-a94f-4e0ad82fd6cf"
      + "%26SignatureVersion%3D1.0%26Timestamp%3D2016-02-23T12%253A46%253A24Z%26Version%3D2014-05-26",
    )
  })
})

describe("buildSignedBody", () => {
  it("阿里云官方测试向量：签名结果应为 OLeaidS1JvxuMvnyHOwuJ+uX5qY=", async () => {
    const params = {
      AccessKeyId: "testid",
      Action: "DescribeRegions",
      Format: "XML",
      SignatureMethod: "HMAC-SHA1",
      SignatureNonce: "3ee8c1b8-83d3-44af-a94f-4e0ad82fd6cf",
      SignatureVersion: "1.0",
      Timestamp: "2016-02-23T12:46:24Z",
      Version: "2014-05-26",
    }
    const body = await buildSignedBody(params, "testsecret", "GET")
    const m = body.match(/&Signature=(.+)$/)
    expect(m).not.toBeNull()
    const sig = decodeURIComponent(m![1])
    expect(sig).toBe("OLeaidS1JvxuMvnyHOwuJ+uX5qY=")
  })
})
