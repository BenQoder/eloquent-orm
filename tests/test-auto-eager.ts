import { Eloquent } from '../src';
import mysql from 'mysql2/promise';

// ============================================
// Test Models
// ============================================

class User extends Eloquent {
  protected static table = 'users';

  relationsTypes!: {
    posts: Post[];
    profile: Profile;
  };

  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

class Post extends Eloquent {
  protected static table = 'posts';

  relationsTypes!: {
    author: User;
  };

  author() {
    return this.belongsTo(User, 'user_id');
  }
}

class Profile extends Eloquent {
  protected static table = 'profiles';

  relationsTypes!: {
    user: User;
  };

  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// ============================================
// Query Counter
// ============================================

let queryCount = 0;
let queries: string[] = [];

function resetQueryCount() {
  queryCount = 0;
  queries = [];
}

function getQueryCount() {
  return queryCount;
}

function getQueries() {
  return queries;
}

// ============================================
// Test Helpers
// ============================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log('  [PASS]', message);
    passed++;
  } else {
    console.log('  [FAIL]', message);
    failed++;
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEqual) {
    console.log('  [PASS]', message);
    passed++;
  } else {
    console.log('  [FAIL]', message);
    console.log('         Expected:', expected);
    console.log('         Actual:', actual);
    failed++;
  }
}

function assertQueryCount(expected: number, message: string) {
  const actual = getQueryCount();
  if (actual === expected) {
    console.log('  [PASS]', message, `(${actual} queries)`);
    passed++;
  } else {
    console.log('  [FAIL]', message);
    console.log('         Expected:', expected, 'queries');
    console.log('         Actual:', actual, 'queries');
    console.log('         Queries:', getQueries());
    failed++;
  }
}

function assertQueryCountMax(max: number, message: string) {
  const actual = getQueryCount();
  if (actual <= max) {
    console.log('  [PASS]', message, `(${actual} queries, max ${max})`);
    passed++;
  } else {
    console.log('  [FAIL]', message);
    console.log('         Expected at most:', max, 'queries');
    console.log('         Actual:', actual, 'queries');
    console.log('         Queries:', getQueries());
    failed++;
  }
}

// ============================================
// Tests
// ============================================

async function testEagerLoadingBaseline() {
  console.log('\n--- TEST: Eager Loading Baseline ---');

  resetQueryCount();
  const users = await User.query().with('posts').get();

  assertQueryCount(2, 'with("posts") uses exactly 2 queries');

  for (const user of users as any[]) {
    assert(Array.isArray(user.posts), `User ${user.id} has posts loaded`);
  }
}

async function testAutomaticEagerLoadingGlobal() {
  console.log('\n--- TEST: Automatic Eager Loading (Global) ---');

  // Enable automatic eager loading globally
  Eloquent.automaticallyEagerLoadRelationships();
  assert(Eloquent.isAutomaticallyEagerLoadRelationshipsEnabled(), 'Global auto-loading enabled');

  resetQueryCount();

  // Get users WITHOUT with() - relations not loaded yet
  const users = await User.query().limit(3).get();
  assertQueryCount(1, 'Initial query fetches only users (no relations)');

  // KEY FEATURE: Can directly await user.posts!
  // This returns a thenable that resolves when the batch load completes
  const posts = await (users[0] as any).posts;
  assert(Array.isArray(posts), 'await user.posts returns array directly');
  assert(posts.length > 0, 'Posts array has data');

  // All users in the collection now have posts loaded (batch load)
  // After first await, subsequent accesses return data synchronously (no await needed)
  const user2Posts = (users[1] as any).posts;
  const user3Posts = (users[2] as any).posts;
  assert(Array.isArray(user2Posts), 'User 2 posts already loaded (sync access)');
  assert(Array.isArray(user3Posts), 'User 3 posts already loaded (sync access)');

  // Query count should still be 2 (1 for users + 1 batch for posts)
  assertQueryCount(2, 'Only 2 queries total (users + batch posts)');

  // Disable for other tests
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;
}

async function testAwaitableRelations() {
  console.log('\n--- TEST: Awaitable Relations (await user.posts) ---');

  // Enable automatic eager loading
  Eloquent.automaticallyEagerLoadRelationships();

  resetQueryCount();

  const users = await User.query().limit(2).get();
  assertQueryCount(1, 'Initial query for users');

  // Direct await on relation - no need for setTimeout!
  const user1Posts = await (users[0] as any).posts;
  assert(Array.isArray(user1Posts), 'await user.posts returns Post[]');

  // Second user also has posts loaded (batch)
  const user2Posts = (users[1] as any).posts;
  assert(Array.isArray(user2Posts), 'Second user posts also loaded (batch)');

  // Can still use chainable syntax
  resetQueryCount();
  const publishedPosts = await (users[0] as any).posts().where('published', true).get();
  assertQueryCount(1, 'Chainable query still works');
  assert(Array.isArray(publishedPosts), 'Chainable query returns array');

  // Disable
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;
}

async function testPerCollectionAutoloading() {
  console.log('\n--- TEST: Per-Collection Automatic Eager Loading ---');

  // Make sure global is disabled
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;

  resetQueryCount();

  // Get users and enable autoloading for this collection only
  const users = await User.query().limit(3).get();
  users.withRelationshipAutoloading();

  assertQueryCount(1, 'Initial query fetches only users');

  // Access posts - should trigger batch load
  const _ = (users[0] as any).posts;

  // Wait for async load
  await new Promise(resolve => setTimeout(resolve, 200));

  let allLoaded = true;
  for (const user of users as any[]) {
    if (!Array.isArray((user as any).posts)) {
      allLoaded = false;
    }
  }
  assert(allLoaded, 'All users have posts auto-loaded via collection autoloading');
}

async function testNoAutoloadingWithoutFlag() {
  console.log('\n--- TEST: No Auto-Loading Without Flag ---');

  // Make sure both are disabled
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;

  resetQueryCount();

  // Get users without autoloading
  const users = await User.query().limit(3).get();
  // Don't call withRelationshipAutoloading()

  assertQueryCount(1, 'Initial query fetches only users');

  // Access posts - should NOT trigger auto-load
  const posts = (users[0] as any).posts;

  // Give time for any potential async load
  await new Promise(resolve => setTimeout(resolve, 100));

  // Posts should be undefined (not loaded)
  assertEquals(posts, undefined, 'Posts not auto-loaded without flag');
}

async function testExplicitWithStillWorks() {
  console.log('\n--- TEST: Explicit with() Still Works ---');

  // Disable auto-loading
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;

  resetQueryCount();

  // Explicit with() should always work
  const users = await User.query().with('posts').limit(3).get();

  assertQueryCount(2, 'Explicit with() still works (2 queries)');

  for (const user of users as any[]) {
    assert(Array.isArray(user.posts), `User ${user.id} has posts loaded via explicit with()`);
  }
}

async function testNestedAutoLoading() {
  console.log('\n--- TEST: Nested Auto-Loading ---');

  // Enable global auto-loading
  Eloquent.automaticallyEagerLoadRelationships();

  resetQueryCount();

  // Get posts without relations
  const posts = await Post.query().limit(5).get();
  assertQueryCount(1, 'Initial query fetches only posts');

  // Access author on first post
  const _ = (posts[0] as any).author;

  // Wait for async load
  await new Promise(resolve => setTimeout(resolve, 200));

  let allLoaded = true;
  for (const post of posts as any[]) {
    if ((post as any).author === undefined) {
      allLoaded = false;
    }
  }
  assert(allLoaded, 'All posts have author auto-loaded (belongsTo batch load)');

  // Disable
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('==============================================');
  console.log('  AUTOMATIC EAGER LOADING TESTS');
  console.log('==============================================');

  // Connect to database
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'test_eloquent',
    port: 3306,
  });

  // Wrap connection to count queries
  const originalQuery = connection.query.bind(connection);
  (connection as any).query = async function(...args: any[]) {
    const sql = args[0];
    if (typeof sql === 'string' && sql.trim().toUpperCase().startsWith('SELECT')) {
      queryCount++;
      queries.push(sql.substring(0, 80) + (sql.length > 80 ? '...' : ''));
    }
    return originalQuery(...args);
  };

  try {
    // Initialize Eloquent
    await Eloquent.init(connection as any);

    // Run tests
    await testEagerLoadingBaseline();
    await testNoAutoloadingWithoutFlag();
    await testExplicitWithStillWorks();
    await testAutomaticEagerLoadingGlobal();
    await testPerCollectionAutoloading();
    await testNestedAutoLoading();

    console.log('\n==============================================');
    console.log('  RESULTS:', passed, 'passed,', failed, 'failed');
    console.log('==============================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\nTEST ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    // Cleanup
    (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;
    await connection.end();
  }
}

main();
