# 德扑 PK 部署指南：Vercel 前端 + Railway 后端

## 项目结构

```text
client/  React + Vite 前端
server/  NestJS + Socket.IO 后端
```

本项目是独立的德扑 PK 多人房间游戏，不接入 LLM，也不需要 DeepSeek 或其他 AI API Key。

## 1. 推送到 GitHub

```bash
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

如果仓库已有 remote：

```bash
git remote set-url origin https://github.com/<your-name>/<repo-name>.git
```

## 2. Railway 部署后端

1. 登录 Railway。
2. New Project -> Deploy from GitHub repo。
3. Root Directory 设置为 `server`。
4. Railway 会自动注入 `PORT`，无需手动添加。
5. 部署完成后，在 Networking 中生成公网域名，例如 `https://xxx.up.railway.app`。

后端常用命令：

```bash
npm install
npm run build
npm start
```

## 3. Vercel 部署前端

1. 登录 Vercel。
2. Add New Project -> Import Git Repository。
3. Root Directory 设置为 `client`。
4. Framework Preset 选择 Vite。
5. 添加环境变量：

```text
VITE_SOCKET_URL=https://xxx.up.railway.app
```

6. 点击 Deploy。

前端常用命令：

```bash
npm install
npm run build
```

## 验证清单

- Vercel 页面能正常加载。
- 浏览器控制台没有 WebSocket 连接错误。
- 两个浏览器窗口可以创建/加入同一房间。
- 玩家可以选座、开始游戏、抽牌、换手牌、换公共牌。
- 5 轮行动结束后按行动顺序逐个亮牌，再展示最终排名。
- 多局游戏需要所有在线玩家点击继续。
