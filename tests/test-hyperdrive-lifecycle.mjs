import assert from 'node:assert/strict';
import { Eloquent } from '../src/index.ts';

class Post extends Eloquent {
    static table = 'posts';
}

class User extends Eloquent {
    static table = 'users';

    posts() {
        return this.hasMany(Post, 'user_id');
    }
}

const binding = {
    connectionString: 'mysql://hyperdrive.example/db',
    host: 'hyperdrive.example',
    user: 'worker',
    password: 'secret',
    database: 'db',
    port: 3306,
};

const originalFactory = Eloquent.connectionFactory;
const originalOptions = Eloquent.getOptions();

function installFactory({ delayMs = 0 } = {}) {
    let factoryCalls = 0;
    const connections = [];

    Eloquent.connectionFactory = async (config) => {
        factoryCalls += 1;
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const record = {
            config,
            queries: [],
        };

        const connection = {
            async query(sql, params) {
                record.queries.push({ sql, params });

                if (sql.includes('COUNT(')) {
                    return [[{ aggregate: 1 }], []];
                }

                if (sql.includes('FROM db.users') || sql.includes('FROM users')) {
                    return [[{ id: 1, name: 'Alice' }], []];
                }

                if (sql.includes('FROM db.posts') || sql.includes('FROM posts')) {
                    return [[{ id: 10, user_id: 1, title: 'Hello from Hyperdrive' }], []];
                }

                return [[{ ok: true }], []];
            },
        };

        record.connection = connection;
        connections.push(record);
        return connection;
    };

    return {
        get factoryCalls() {
            return factoryCalls;
        },
        connections,
    };
}

async function run() {
    let tracker = installFactory();

    Eloquent.setOptions({ prefixTablesWithDatabase: true });
    await Eloquent.hyperdrive(binding, undefined, async () => {
        assert.equal(
            User.query().toSql(),
            'SELECT * FROM db.users',
            'global options should qualify generated table names'
        );
        assert.equal(
            User.query().join('posts', 'users.id', '=', 'posts.user_id').toSql(),
            'SELECT * FROM db.users INNER JOIN db.posts ON db.users.id = db.posts.user_id',
            'simple join tables should be qualified when enabled'
        );
        assert.equal(
            User.query().join('posts as p', 'users.id', '=', 'p.user_id').toSql(),
            'SELECT * FROM db.users INNER JOIN posts as p ON db.users.id = p.user_id',
            'aliased join expressions should keep the alias untouched'
        );
        assert.equal(
            User.query().table('analytics.users').toSql(),
            'SELECT * FROM analytics.users',
            'already-qualified tables should not be rewritten'
        );
    });

    await Eloquent.hyperdrive(binding, undefined, async () => {
        assert.equal(
            User.query().toSql(),
            'SELECT * FROM users',
            'request-scoped options should override global qualification settings'
        );
    }, {
        prefixTablesWithDatabase: false,
    });

    await Eloquent.hyperdrive(binding, undefined, async () => 'no-op');
    assert.equal(tracker.factoryCalls, 0, 'no query should not create a client');

    tracker = installFactory();
    await Eloquent.hyperdrive(binding, undefined, async () => {
        await User.query().get();
        await User.query().count();
    });
    assert.equal(tracker.factoryCalls, 1, 'multiple queries in one request should reuse one client');
    assert.equal(tracker.connections[0].queries.length, 2, 'request-scoped client should execute both queries');

    tracker = installFactory();
    await Eloquent.hyperdrive(binding, undefined, async () => {
        await User.query().get();
    });
    await Eloquent.hyperdrive(binding, undefined, async () => {
        await User.query().get();
    });
    assert.equal(tracker.factoryCalls, 2, 'separate request scopes should create separate clients');
    assert.notEqual(
        tracker.connections[0].connection,
        tracker.connections[1].connection,
        'request-scoped clients must not leak across requests'
    );

    tracker = installFactory({ delayMs: 10 });
    await Eloquent.hyperdrive(binding, undefined, async () => {
        await Promise.all([
            User.query().get(),
            User.query().count(),
        ]);
    });
    assert.equal(tracker.factoryCalls, 1, 'concurrent first-use queries should share one init promise');

    tracker = installFactory();
    await Eloquent.hyperdrive(binding, undefined, async () => {
        const users = await User.query().with('posts').get();
        assert.equal(users.length, 1, 'user query should still resolve');
        assert.equal(users[0].posts.length, 1, 'relation query should still resolve');
    });
    assert.equal(tracker.factoryCalls, 1, 'eager loading should reuse the same request-scoped client');
    assert.equal(tracker.connections[0].queries.length, 2, 'eager loading should execute both queries on the same client');

    tracker = installFactory();
    let capturedContext = null;
    await Eloquent.hyperdrive(binding, undefined, async () => {
        await User.query().get();
        capturedContext = Eloquent.connectionStorage.getStore();
        assert.ok(capturedContext?.connection, 'request context should hold the live client during the callback');
    });
    assert.equal(capturedContext?.connection, null, 'request-scoped client reference should be cleared after callback');
    assert.equal(capturedContext?.connectionInitialization, null, 'init promise should be cleared after callback');
    assert.equal(capturedContext?.hyperdrive, null, 'hyperdrive config should be released after callback');
    assert.equal(capturedContext?.released, true, 'request context should be marked released after callback');

    assert.equal(
        typeof Eloquent.getConnection,
        'undefined',
        'raw connection access should not be exposed on the public Eloquent API'
    );

    await assert.rejects(
        Eloquent.withConnection({}, async () => null),
        /not supported/,
        'manual Worker connections should be rejected'
    );
}

try {
    await run();
    console.log('Hyperdrive lifecycle tests passed');
} finally {
    Eloquent.connectionFactory = originalFactory;
    Eloquent.setOptions(originalOptions);
}
