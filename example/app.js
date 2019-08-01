const Kocket = require('../dist/main');

const server = new Kocket();
server.use(async (ctx) => {
  console.log(ctx.getText());
}).listen(7007, () => console.log('Server listening on 7007'));
