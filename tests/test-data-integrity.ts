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
    comments: Comment[];
    images: Image[];
    statuses: Status[];
  };

  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }

  comments() {
    return this.morphMany(Comment, 'commentable');
  }

  images() {
    return this.morphMany(Image, 'imageable');
  }

  statuses() {
    return this.morphMany(Status, 'model');
  }
}

class Post extends Eloquent {
  protected static table = 'posts';

  relationsTypes!: {
    author: User;
    comments: Comment[];
    tags: Tag[];
    images: Image[];
    statuses: Status[];
  };

  author() {
    return this.belongsTo(User, 'user_id');
  }

  comments() {
    return this.morphMany(Comment, 'commentable');
  }

  tags() {
    return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id');
  }

  images() {
    return this.morphMany(Image, 'imageable');
  }

  statuses() {
    return this.morphMany(Status, 'model');
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

class Tag extends Eloquent {
  protected static table = 'tags';

  relationsTypes!: {
    posts: Post[];
  };

  posts() {
    return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id');
  }
}

class Comment extends Eloquent {
  protected static table = 'comments';
}

class Image extends Eloquent {
  protected static table = 'images';
}

class Status extends Eloquent {
  protected static table = 'statuses';
}

// ============================================
// Test Helpers
// ============================================

let passed = 0;
let failed = 0;
let queryCount = 0;

function resetQueryCount() {
  queryCount = 0;
}

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

// ============================================
// Data Integrity Tests
// ============================================

async function testUserPostsRelationship() {
  console.log('\n--- TEST: User -> Posts (HasMany) Data Integrity ---');

  // Alice should have 5 posts
  const alice = await User.query().where('name', 'Alice Johnson').with('posts').first();
  assert(alice !== null, 'Alice found');
  assertEquals((alice as any).posts.length, 5, 'Alice has exactly 5 posts');

  // Verify post titles belong to Alice
  const aliceTitles = (alice as any).posts.map((p: any) => p.title).sort();
  assert(aliceTitles.every((t: string) => t.includes('TypeScript')), 'All Alice posts are about TypeScript');

  // Eve should have 6 posts
  const eve = await User.query().where('name', 'Eve Wilson').with('posts').first();
  assertEquals((eve as any).posts.length, 6, 'Eve has exactly 6 posts');

  // Sam and Tina should have 0 posts
  const sam = await User.query().where('name', 'Sam Wright').with('posts').first();
  const tina = await User.query().where('name', 'Tina Scott').with('posts').first();
  assertEquals((sam as any).posts.length, 0, 'Sam has 0 posts');
  assertEquals((tina as any).posts.length, 0, 'Tina has 0 posts');
}

async function testPostAuthorRelationship() {
  console.log('\n--- TEST: Post -> Author (BelongsTo) Data Integrity ---');

  // Get Docker post and verify author is Charlie
  const dockerPost = await Post.query().where('title', 'Docker Best Practices').with('author').first();
  assert(dockerPost !== null, 'Docker post found');
  assertEquals((dockerPost as any).author.name, 'Charlie Brown', 'Docker post author is Charlie');

  // Get ML intro post and verify author is Eve
  const mlPost = await Post.query().where('title', 'Intro to Machine Learning').with('author').first();
  assertEquals((mlPost as any).author.name, 'Eve Wilson', 'ML post author is Eve');
}

async function testUserProfileRelationship() {
  console.log('\n--- TEST: User <-> Profile (HasOne/BelongsTo) Data Integrity ---');

  // All users should have profiles
  const users = await User.query().with('profile').get();
  let allHaveProfiles = true;
  for (const user of users as any[]) {
    if (!user.profile) {
      console.log('    Missing profile for:', user.name);
      allHaveProfiles = false;
    }
  }
  assert(allHaveProfiles, 'All 20 users have profiles');

  // Verify specific profile content
  const alice = await User.query().where('name', 'Alice Johnson').with('profile').first();
  assert((alice as any).profile.bio.includes('TypeScript'), 'Alice profile mentions TypeScript');

  // Test reverse: profile -> user
  const profile = await Profile.query().where('bio', 'LIKE', '%Data scientist%').with('user').first();
  assertEquals((profile as any).user.name, 'Eve Wilson', 'Data scientist profile belongs to Eve');
}

async function testManyToManyRelationship() {
  console.log('\n--- TEST: Post <-> Tags (BelongsToMany) Data Integrity ---');

  // TypeScript intro post should have TypeScript and JavaScript tags
  const tsPost = await Post.query().where('title', 'Getting Started with TypeScript').with('tags').first();
  const tagNames = (tsPost as any).tags.map((t: any) => t.name).sort();
  assertEquals(tagNames, ['JavaScript', 'TypeScript'], 'TS intro has correct tags');

  // Testing posts should have Testing tag
  const testingPost = await Post.query().where('title', 'Unit Testing Guide').with('tags').first();
  assert((testingPost as any).tags.some((t: any) => t.name === 'Testing'), 'Testing post has Testing tag');

  // Reverse: Tag -> Posts
  const typescriptTag = await Tag.query().where('name', 'TypeScript').with('posts').first();
  assert((typescriptTag as any).posts.length >= 5, 'TypeScript tag has 5+ posts');
}

async function testPolymorphicComments() {
  console.log('\n--- TEST: Polymorphic Comments Data Integrity ---');

  // Post 1 should have 3 comments
  const post1 = await Post.query().where('id', 1).with('comments').first();
  assertEquals((post1 as any).comments.length, 3, 'Post 1 has 3 comments');

  // Post 9 (Docker) should have 4 comments
  const post9 = await Post.query().where('id', 9).with('comments').first();
  assertEquals((post9 as any).comments.length, 4, 'Post 9 has 4 comments');

  // User comments (polymorphic on User)
  const alice = await User.query().where('id', 1).with('comments').first();
  assertEquals((alice as any).comments.length, 1, 'Alice has 1 comment about her');

  // Verify comment content matches
  const comment = (alice as any).comments[0];
  assert(comment.body.includes('great contributor'), 'Alice comment content is correct');
}

async function testPolymorphicImages() {
  console.log('\n--- TEST: Polymorphic Images Data Integrity ---');

  // Post 1 should have 2 images
  const post1 = await Post.query().where('id', 1).with('images').first();
  assertEquals((post1 as any).images.length, 2, 'Post 1 has 2 images');

  // Post 17 (Neural Networks) should have 2 images
  const post17 = await Post.query().where('id', 17).with('images').first();
  assertEquals((post17 as any).images.length, 2, 'Post 17 has 2 images');

  // Alice should have 1 image
  const alice = await User.query().where('id', 1).with('images').first();
  assertEquals((alice as any).images.length, 1, 'Alice has 1 image');
}

async function testBatchLoadingDataIntegrity() {
  console.log('\n--- TEST: Batch Loading Data Integrity ---');

  // Enable auto-loading
  Eloquent.automaticallyEagerLoadRelationships();

  // Get 10 users
  const users = await User.query().limit(10).get();

  // Await posts for first user (triggers batch load for all)
  const user1Posts = await (users[0] as any).posts;

  // Verify each user has correct post count
  const expectedPostCounts: Record<string, number> = {
    'Alice Johnson': 5,
    'Bob Smith': 3,
    'Charlie Brown': 4,
    'Diana Prince': 2,
    'Eve Wilson': 6,
    'Frank Miller': 3,
    'Grace Lee': 4,
    'Henry Davis': 2,
    'Ivy Chen': 3,
    'Jack Taylor': 2,
  };

  let allCorrect = true;
  for (const user of users as any[]) {
    const expected = expectedPostCounts[user.name];
    const actual = user.posts?.length ?? 0;
    if (actual !== expected) {
      console.log(`    MISMATCH: ${user.name} expected ${expected} posts, got ${actual}`);
      allCorrect = false;
    }
  }
  assert(allCorrect, 'All batch-loaded post counts are correct');

  // Verify post data matches user_id
  let foreignKeysCorrect = true;
  for (const user of users as any[]) {
    for (const post of user.posts || []) {
      if (post.user_id !== user.id) {
        console.log(`    FK MISMATCH: Post ${post.id} has user_id ${post.user_id}, expected ${user.id}`);
        foreignKeysCorrect = false;
      }
    }
  }
  assert(foreignKeysCorrect, 'All post foreign keys match their parent user');

  // Disable auto-loading
  (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;
}

async function testNestedEagerLoading() {
  console.log('\n--- TEST: Nested Eager Loading Data Integrity ---');

  // Load users with posts and post tags
  const users = await User.query()
    .with('posts.tags')
    .with('posts.comments')
    .limit(5)
    .get();

  // Verify nested data
  const alice = (users as any[]).find(u => u.name === 'Alice Johnson');
  assert(alice !== undefined, 'Alice found in results');
  assert(alice.posts.length === 5, 'Alice has 5 posts loaded');

  // Check that tags are loaded on posts
  const tsPost = alice.posts.find((p: any) => p.title === 'Getting Started with TypeScript');
  assert(tsPost !== undefined, 'TypeScript intro post found');
  assert(Array.isArray(tsPost.tags), 'Tags loaded on post');
  assert(tsPost.tags.length === 2, 'TypeScript intro has 2 tags');

  // Check comments are loaded
  assert(Array.isArray(tsPost.comments), 'Comments loaded on post');
  assertEquals(tsPost.comments.length, 3, 'TypeScript intro has 3 comments');
}

async function testQueryCount() {
  console.log('\n--- TEST: Query Efficiency (N+1 Prevention) ---');

  // Test with explicit eager loading
  resetQueryCount();
  const users = await User.query().with('posts').with('profile').get();
  // Should be 3 queries: users, posts (batch), profiles (batch)
  assert(queryCount <= 3, `Eager load used ${queryCount} queries (expected <= 3)`);

  // Verify data is fully loaded (no additional queries needed)
  let hasAllData = true;
  for (const user of users as any[]) {
    if (!Array.isArray(user.posts)) hasAllData = false;
    if (!user.profile && user.id <= 20) hasAllData = false;
  }
  assert(hasAllData, 'All data loaded without additional queries');
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('==============================================');
  console.log('  DATA INTEGRITY & RELATIONSHIP TESTS');
  console.log('  Database: test_eloquent');
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
    }
    return originalQuery(...args);
  };

  try {
    // Initialize Eloquent
    await Eloquent.init(connection as any);

    // Show data summary
    console.log('\n--- Dataset Summary ---');
    const userCount = await User.query().count();
    const postCount = await Post.query().count();
    const profileCount = await Profile.query().count();
    const tagCount = await Tag.query().count();
    const commentCount = await Comment.query().count();
    const imageCount = await Image.query().count();
    console.log(`  Users: ${userCount}`);
    console.log(`  Posts: ${postCount}`);
    console.log(`  Profiles: ${profileCount}`);
    console.log(`  Tags: ${tagCount}`);
    console.log(`  Comments: ${commentCount}`);
    console.log(`  Images: ${imageCount}`);

    // Run tests
    await testUserPostsRelationship();
    await testPostAuthorRelationship();
    await testUserProfileRelationship();
    await testManyToManyRelationship();
    await testPolymorphicComments();
    await testPolymorphicImages();
    await testBatchLoadingDataIntegrity();
    await testNestedEagerLoading();
    await testQueryCount();

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
    (Eloquent as any).automaticallyEagerLoadRelationshipsEnabled = false;
    await connection.end();
  }
}

main();
