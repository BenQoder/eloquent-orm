import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { Eloquent } from '../src/index.ts';

const REQUEST_CONTEXT_SYMBOL = Symbol.for('eloquent.requestContext');

class User extends Eloquent {
  protected static table = 'users';
}

type DemoEnv = {
  Bindings: {
    BACKEND_DB: {
      connectionString: string;
    };
  };
};

type Tracker = ReturnType<typeof installFactory>;

function installFactory() {
  const originalFactory = (Eloquent as any).connectionFactory;
  let factoryCalls = 0;
  let destroyCalls = 0;
  const queries: Array<{ sql: string; params: any[] }> = [];
  const connections: Array<{ destroyed: boolean }> = [];

  (Eloquent as any).connectionFactory = async () => {
    factoryCalls += 1;

    const state = { destroyed: false };
    connections.push(state);

    return {
      async query(sql: string, params: any[]) {
        queries.push({ sql, params });
        return [[{ id: 1, name: 'Alice' }], []];
      },
      destroy() {
        if (!state.destroyed) {
          state.destroyed = true;
          destroyCalls += 1;
        }
      },
    };
  };

  return {
    restore() {
      (Eloquent as any).connectionFactory = originalFactory;
    },
    get factoryCalls() {
      return factoryCalls;
    },
    get destroyCalls() {
      return destroyCalls;
    },
    queries,
    connections,
  };
}

async function makeApp(
  options?: Parameters<typeof Eloquent.honoMiddleware>[2]
) {
  const app = new Hono<DemoEnv>();
  let capturedRequestContext: any = null;

  app.use(
    '*',
    Eloquent.honoMiddleware(
      (c) => c.env.BACKEND_DB,
      undefined,
      options
    )
  );

  app.get('/query', async (c) => {
    capturedRequestContext = (c as any)[REQUEST_CONTEXT_SYMBOL];
    const users = await User.query().select('id', 'name').limit(1).get();
    return c.json({ count: users.length });
  });

  app.get('/no-query', async (c) => {
    capturedRequestContext = (c as any)[REQUEST_CONTEXT_SYMBOL];
    return c.json({ ok: true });
  });

  app.get('/throws', async (c) => {
    capturedRequestContext = (c as any)[REQUEST_CONTEXT_SYMBOL];
    await User.query().select('id', 'name').limit(1).get();
    throw new Error('boom');
  });

  return {
    app,
    env: {
      BACKEND_DB: {
        connectionString: 'mysql://hyperdrive.example/db',
      },
    },
    getCapturedRequestContext() {
      return capturedRequestContext;
    },
  };
}

async function testDefaultDoesNotCloseConnection() {
  const tracker = installFactory();

  try {
    const demo = await makeApp({ connectTimeout: 5000 });
    const response = await demo.app.fetch(new Request('http://localhost/query'), demo.env);

    assert.equal(response.status, 200, 'default middleware query request should succeed');
    assert.equal(tracker.factoryCalls, 1, 'default middleware should create one connection for one query request');
    assert.equal(tracker.destroyCalls, 1, 'default middleware should destroy the connection');
    assert.equal(tracker.connections[0]?.destroyed, true, 'default middleware should destroy the request-scoped connection');

    const context = demo.getCapturedRequestContext();
    assert.equal(context.connection, null, 'default middleware should still clear the connection reference');
    assert.equal(context.connectionInitialization, null, 'default middleware should clear the init promise');
    assert.equal(context.hyperdrive, null, 'default middleware should clear Hyperdrive config');
    assert.equal(context.released, true, 'default middleware should mark the request context released');
  } finally {
    tracker.restore();
  }
}

async function testNoQueryRequestDoesNotCreateOrCloseConnection() {
  const tracker = installFactory();

  try {
    const demo = await makeApp({ connectTimeout: 5000 });
    const response = await demo.app.fetch(new Request('http://localhost/no-query'), demo.env);

    assert.equal(response.status, 200, 'no-query request should succeed');
    assert.equal(tracker.factoryCalls, 0, 'no-query request should not create a connection');
    assert.equal(tracker.destroyCalls, 0, 'no-query request should not destroy a non-existent connection');

    const context = demo.getCapturedRequestContext();
    assert.equal(context.connection, null, 'no-query request should leave the connection reference empty');
    assert.equal(context.connectionInitialization, null, 'no-query request should leave init promise empty');
    assert.equal(context.hyperdrive, null, 'no-query request should still clear Hyperdrive config');
    assert.equal(context.released, true, 'no-query request should mark the request context released');
  } finally {
    tracker.restore();
  }
}

async function testOptInStillClosesOnHandlerError() {
  const tracker = installFactory();

  try {
    const demo = await makeApp({ connectTimeout: 5000 });
    const response = await demo.app.fetch(new Request('http://localhost/throws'), demo.env);

    assert.equal(response.status, 500, 'erroring handler should surface as a 500 response');
    assert.equal(tracker.factoryCalls, 1, 'erroring handler should still create one request-scoped connection');
    assert.equal(tracker.destroyCalls, 1, 'opt-in middleware should still destroy the connection after handler errors');
    assert.equal(tracker.connections[0]?.destroyed, true, 'opt-in middleware should destroy the connection even on errors');

    const context = demo.getCapturedRequestContext();
    assert.equal(context.connection, null, 'error cleanup should clear the connection reference');
    assert.equal(context.connectionInitialization, null, 'error cleanup should clear the init promise');
    assert.equal(context.hyperdrive, null, 'error cleanup should clear Hyperdrive config');
    assert.equal(context.released, true, 'error cleanup should mark the request context released');
  } finally {
    tracker.restore();
  }
}

async function main() {
  await testDefaultDoesNotCloseConnection();
  await testNoQueryRequestDoesNotCreateOrCloseConnection();
  await testOptInStillClosesOnHandlerError();
  console.log('Hono middleware lifecycle tests passed');
}

await main();
