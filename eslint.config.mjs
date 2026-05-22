import { ourongxing, react } from "@ourongxing/eslint-config"

export default ourongxing({
  type: "app",
  // 貌似不能 ./ 开头，
  ignores: ["src/routeTree.gen.ts", "imports.app.d.ts", "public/", ".vscode", "**/*.json"],
}).append(react({
  files: ["src/**"],
})).append({
  rules: {
    // 关闭单参数箭头函数括号校验：与 Prettier 默认 arrowParens:"always" 冲突，保存时来回打架
    "style/arrow-parens": "off",
  },
})
