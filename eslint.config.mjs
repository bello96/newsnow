import { ourongxing, react } from "@ourongxing/eslint-config"

export default ourongxing({
  type: "app",
  // 貌似不能 ./ 开头，
  ignores: ["src/routeTree.gen.ts", "imports.app.d.ts", "public/", ".vscode", "**/*.json"],
}).append(react({
  files: ["src/**"],
})).append({
  rules: {
    // 以下均为格式化类规则，与项目所用 Prettier 冲突（编辑器保存时来回打架），统一交给 Prettier 处理
    "style/arrow-parens": "off",
    "style/member-delimiter-style": "off",
    "style/operator-linebreak": "off",
    "style/multiline-ternary": "off",
    "style/jsx-one-expression-per-line": "off",
    "style/jsx-curly-newline": "off",
  },
})
