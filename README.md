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
      server.broadcast({
        type: 'broadcast',
        from: json.name,
        msg: json.msg,
      });
    }
    await n();
  })
  .listen(7001);
```

# Note
every connection uses **only one** context instance until closed.
