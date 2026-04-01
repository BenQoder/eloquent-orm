import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { Hono } from 'hono';
import { Eloquent } from '../src/index.ts';

const RAW_CONNECTION =
  'mysql://root:root@127.0.0.1?statusColor=686B6F&env=local&name=Local&tLSMode=0&usePrivateKey=false&safeModeLevel=0&advancedSafeModeLevel=0&driverVersion=0&lazyload=false';

const REQUEST_CONTEXT_SYMBOL = Symbol.for('eloquent.requestContext');

class User extends Eloquent {
  protected static table = 'test_eloquent.users';
}

class Post extends Eloquent {
  protected static table = 'test_eloquent.posts';
}

type DemoEnv = {
  Bindings: {
    BACKEND_DB: {
      connectionString: string;
    };
  };
};

async function main() {
  const originalFactory = (Eloquent as any).connectionFactory;
  const clientConfigs: any[] = [];
  const openedConnections: Array<{ end: () => Promise<any> }> = [];

  (Eloquent as any).connectionFactory = async (config: any) => {
    clientConfigs.push(config);
    const connection = await mysql.createConnection(config);
    openedConnections.push(connection);
    return connection;
  };

  let capturedRequestContext: any = null;

  const app = new Hono<DemoEnv>();

  app.use(
    '*',
    Eloquent.honoMiddleware(
      (c) => c.env.BACKEND_DB,
      undefined,
      { connectTimeout: 5000 }
    )
  );

  app.get('/verify', async (c) => {
    capturedRequestContext = (c as any)[REQUEST_CONTEXT_SYMBOL];

    const users = await User.query().select('id', 'name').limit(2).get();
    const posts = await Post.query().select('id', 'title').limit(2).get();
    const totalUsers = await User.query().count();

    return c.json({
      requestContextPresent: Boolean(capturedRequestContext),
      users: users.map((user: any) => ({ id: user.id, name: user.name })),
      posts: posts.map((post: any) => ({ id: post.id, title: post.title })),
      totalUsers,
    });
  });

  try {
    const env = {
      BACKEND_DB: {
        connectionString: RAW_CONNECTION,
      },
    };

    const firstResponse = await app.fetch(new Request('http://localhost/verify'), env);
    assert.equal(firstResponse.status, 200, 'first Hono request should succeed');

    const firstPayload = await firstResponse.json();
    assert.equal(firstPayload.requestContextPresent, true, 'middleware should attach an Eloquent request context');
    assert.equal(Array.isArray(firstPayload.users), true, 'users query should return data');
    assert.equal(Array.isArray(firstPayload.posts), true, 'posts query should return data');
    assert.equal(typeof firstPayload.totalUsers, 'number', 'count query should return a number');
    assert.equal(clientConfigs.length, 1, 'one Hono request should lazily create one mysql2 client');
    assert.equal(capturedRequestContext.connection, null, 'request-scoped connection should be cleared after request');
    assert.equal(capturedRequestContext.connectionInitialization, null, 'init promise should be cleared after request');
    assert.equal(capturedRequestContext.hyperdrive, null, 'Hyperdrive config should be cleared after request');
    assert.equal(capturedRequestContext.released, true, 'request context should be marked released after request');

    const secondResponse = await app.fetch(new Request('http://localhost/verify'), env);
    assert.equal(secondResponse.status, 200, 'second Hono request should also succeed');
    assert.equal(clientConfigs.length, 2, 'separate Hono requests should create separate mysql2 clients');

    console.log('Hono middleware demo passed');
  } finally {
    await Promise.allSettled(openedConnections.map((connection) => connection.end()));
    (Eloquent as any).connectionFactory = originalFactory;
  }
}

await main();
