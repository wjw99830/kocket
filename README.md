# kocket
Websocket server side framework, like koa.

# Usage
```javascript
const server = new Koacket();
server
  .use(async (ctx, n) => {
    const json = ctx.getJson();
    if (json !== null) {
      ctx.send({
        msg: `I know.`,
        name: 'server',
      });
    }
    await n();
  })
  .listen(7001);
```
