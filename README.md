# 德扑 PK

一个独立的多人房间制德扑 PK 游戏。玩家可以创建/加入房间、选择座位，并进行 2-6 人的德扑换牌对局。

## 核心玩法

- 支持 2-6 名玩家。
- 房主可设置 1-5 次连续游戏。
- 每局使用 52 张无大小王扑克牌。
- 每名玩家 2 张私密手牌，桌面 5 张公共牌。
- 换牌阶段共 5 轮，每轮抽 1 张进入暂存区，再选择不操作、置换手牌或置换公共牌。
- 最终按标准德州扑克 `2 张手牌 + 5 张公共牌，7 选 5` 判定牌型。
- 并列第一时，并列玩家都获得胜场。

## 技术栈

- 前端：React、TypeScript、Vite、Socket.IO Client
- 后端：NestJS、Socket.IO、TypeScript
- 部署建议：Vercel 前端 + Railway 后端

## 本地运行

后端：

```bash
cd server
npm install
npm run build
npm start
```

前端：

```bash
cd client
npm install
npm run dev
```

默认本地地址：

- 前端：http://127.0.0.1:5173/
- 后端：http://localhost:3000

## 验证

```bash
server\node_modules\.bin\tsc.cmd -p server\tsconfig.json
node --test server/test/*.test.js
client\node_modules\.bin\tsc.cmd -p client\tsconfig.json --noEmit
node --test --experimental-strip-types client/test/showdown-reveal.test.ts
```

前端生产构建：

```bash
cd client
node_modules\.bin\vite.cmd build
```
