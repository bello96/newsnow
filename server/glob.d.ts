/* eslint-disable */

declare module 'glob:./sources/{*.ts,**/index.ts}' {
  export const aihot: typeof import('./sources/aihot')
  export const cls: typeof import('./sources/cls/index')
  export const coolapk: typeof import('./sources/coolapk/index')
  export const douyin: typeof import('./sources/douyin')
  export const ifeng: typeof import('./sources/ifeng')
  export const sspai: typeof import('./sources/sspai')
  export const tencent: typeof import('./sources/tencent')
  export const thepaper: typeof import('./sources/thepaper')
  export const toutiao: typeof import('./sources/toutiao')
  export const wallstreetcn: typeof import('./sources/wallstreetcn')
  export const weibo: typeof import('./sources/weibo')
  export const zhihu: typeof import('./sources/zhihu')
}
