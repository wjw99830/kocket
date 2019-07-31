import { Kocket } from './lib/server';

export { Kocket } from './lib/server';

const server = new Kocket();
server
  .use(async (ctx, n) => {
    const json = ctx.getJson();
    if (json) {
      ctx.name(json.name);
      server.broadcast(json);
    }
    await n();
  })
  .listen(7007, () => console.log('Server listening on 7007'));
