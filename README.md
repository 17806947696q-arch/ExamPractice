# 📚 刷题助手

一个简洁、稳定、本地运行的期末刷题网页应用。

## 🚀 使用方法

1. 直接双击打开 `index.html`
2. 浏览器会自动加载 `questions.json` 中的题目
3. 选择刷题模式，开始练习

> 由于浏览器的安全策略，部分浏览器直接打开可能无法加载 JSON。推荐使用本地服务器：
> ```bash
> # 方法一：Python
> python -m http.server 8080
>
> # 方法二：VS Code Live Server 插件
> # 右键 index.html → Open with Live Server
> ```

## 📂 项目结构

```
ExamPractice/
├── index.html       # 主页面
├── style.css        # 样式文件
├── app.js           # 核心逻辑
├── questions.json   # 题库文件（可直接编辑替换）
└── README.md        # 本文件
```

## ✨ 功能

- **三种刷题模式**：顺序刷题、随机刷题、错题练习
- **错题自动记录**：答错自动保存到 localStorage，刷新不丢失
- **学习统计**：实时显示进度、正确率、错题数
- **答案解析**：提交后显示正确答案和解析
- **键盘快捷键**：数字键 1-4 选选项，← → 切换题目
- **响应式设计**：适配手机和电脑

## 📝 题库格式

编辑 `questions.json` 即可更换题库：

```json
[
  {
    "id": 1,
    "type": "single",
    "question": "题目内容？",
    "options": [
      "A. 选项A",
      "B. 选项B",
      "C. 选项C",
      "D. 选项D"
    ],
    "answer": "A",
    "analysis": "答案解析"
  }
]
```

| 字段 | 说明 |
|------|------|
| id | 唯一编号 |
| type | 题型，固定为 "single" |
| question | 题目内容 |
| options | 四个选项的数组 |
| answer | 正确答案（A/B/C/D） |
| analysis | 答案解析 |

## 🛠️ 技术栈

- 纯 HTML + CSS + JavaScript
- 无框架、无后端、无数据库
- localStorage 存储错题数据
