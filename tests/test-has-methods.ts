import { Eloquent } from '../src';
import mysql from 'mysql2/promise';

class User extends Eloquent {
  protected static table = 'users';
  posts() { return this.hasMany(Post, 'user_id'); }
  profile() { return this.hasOne(Profile, 'user_id'); }
}

class Post extends Eloquent {
  protected static table = 'posts';
  tags() { return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id'); }
  author() { return this.belongsTo(User, 'user_id'); }
  comments() { return this.morphMany(Comment, 'commentable'); }
}

class Profile extends Eloquent {
  protected static table = 'profiles';
}

class Tag extends Eloquent {
  protected static table = 'tags';
  posts() { return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id'); }
}

class Comment extends Eloquent {
  protected static table = 'comments';
}

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${name}`);
    failed++;
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: 'root',
    database: 'test_eloquent', port: 3306
  });
  await Eloquent.init(conn as any);

  console.log('==============================================');
  console.log('  HAS / WHEREHAS METHOD TESTS');
  console.log('==============================================');

  // ============================================
  // has() tests
  // ============================================
  console.log('\n--- TEST: has() basic ---');
  const usersWithPosts = await User.query().has('posts').get();
  test('has("posts") returns users with posts', usersWithPosts.length === 18);

  console.log('\n--- TEST: has() with operators ---');
  const users4Plus = await User.query().has('posts', '>=', 4).get();
  test('has("posts", ">=", 4) returns 5 users', users4Plus.length === 5);

  const usersExact3 = await User.query().has('posts', '=', 3).get();
  test('has("posts", "=", 3) returns 4 users', usersExact3.length === 4);

  const usersLessThan3 = await User.query().has('posts', '<', 3).get();
  test('has("posts", "<", 3) returns 11 users', usersLessThan3.length === 11);

  const usersMoreThan5 = await User.query().has('posts', '>', 5).get();
  test('has("posts", ">", 5) returns 1 user (Eve)', usersMoreThan5.length === 1);

  // ============================================
  // doesntHave() tests
  // ============================================
  console.log('\n--- TEST: doesntHave() ---');
  const usersNoPosts = await User.query().doesntHave('posts').get();
  test('doesntHave("posts") returns 2 users', usersNoPosts.length === 2);
  test('doesntHave results are Sam & Tina',
    (usersNoPosts as any[]).some(u => u.name === 'Sam Wright') &&
    (usersNoPosts as any[]).some(u => u.name === 'Tina Scott')
  );

  // ============================================
  // whereHas() tests
  // ============================================
  console.log('\n--- TEST: whereHas() with callback ---');
  const usersPublished = await User.query()
    .whereHas('posts', q => q.where('published', 1))
    .get();
  test('whereHas with published filter works', usersPublished.length === 18);

  const users3PlusPublished = await User.query()
    .whereHas('posts', q => q.where('published', 1), '>=', 3)
    .get();
  test('whereHas("posts", cb, ">=", 3) returns 8 users', users3PlusPublished.length === 8);

  // ============================================
  // whereDoesntHave() tests
  // ============================================
  console.log('\n--- TEST: whereDoesntHave() ---');
  const usersNoPublished = await User.query()
    .whereDoesntHave('posts', q => q.where('published', 1))
    .get();
  test('whereDoesntHave for published posts returns 2', usersNoPublished.length === 2);

  // ============================================
  // withWhereHas() tests
  // ============================================
  console.log('\n--- TEST: withWhereHas() ---');
  const usersWithPublished = await User.query()
    .withWhereHas('posts', q => q.where('published', 1))
    .limit(3)
    .get();
  test('withWhereHas filters and loads relation', usersWithPublished.length === 3);
  test('withWhereHas loads only published posts',
    (usersWithPublished as any[]).every(u =>
      u.posts && u.posts.every((p: any) => p.published === 1)
    )
  );

  // ============================================
  // has() with different relation types
  // ============================================
  console.log('\n--- TEST: has() with hasOne ---');
  const usersWithProfile = await User.query().has('profile').get();
  test('has("profile") works with hasOne', usersWithProfile.length === 20);

  console.log('\n--- TEST: has() with belongsToMany ---');
  const postsWithTags = await Post.query().has('tags').get();
  test('has("tags") works with belongsToMany', postsWithTags.length === 46);

  const posts2PlusTags = await Post.query().has('tags', '>=', 2).get();
  test('has("tags", ">=", 2) returns 4 posts', posts2PlusTags.length === 4);

  console.log('\n--- TEST: has() with morphMany ---');
  const postsWithComments = await Post.query().has('comments').get();
  test('has("comments") works with morphMany', postsWithComments.length === 11);

  const posts3PlusComments = await Post.query().has('comments', '>=', 3).get();
  test('has("comments", ">=", 3) returns 4 posts', posts3PlusComments.length === 4);

  // ============================================
  // Combining has() with other query methods
  // ============================================
  console.log('\n--- TEST: has() combined with other methods ---');
  const usersWithPostsOrdered = await User.query()
    .has('posts', '>=', 4)
    .orderBy('name', 'asc')
    .get();
  test('has() with orderBy works',
    (usersWithPostsOrdered as any[])[0].name === 'Alice Johnson'
  );

  const usersWithPostsLimited = await User.query()
    .has('posts', '>=', 3)
    .limit(2)
    .get();
  test('has() with limit works', usersWithPostsLimited.length === 2);

  const usersWithPostsSelected = await User.query()
    .select('id', 'name')
    .has('posts', '>=', 4)
    .get();
  test('has() with select works',
    (usersWithPostsSelected as any[])[0].email === undefined
  );

  // ============================================
  // orHas() tests
  // ============================================
  console.log('\n--- TEST: orHas() ---');
  const usersOrCondition = await User.query()
    .has('posts', '=', 6)
    .orHas('posts', '=', 5)
    .get();
  test('orHas combines conditions (Eve with 6, Alice with 5)', usersOrCondition.length === 2);

  // ============================================
  // Nested whereHas()
  // ============================================
  console.log('\n--- TEST: Nested whereHas ---');
  const usersWithTypescriptPosts = await User.query()
    .whereHas('posts', q => {
      q.whereHas('tags', tq => tq.where('name', 'TypeScript'));
    })
    .get();
  test('Nested whereHas (users with TypeScript-tagged posts)', usersWithTypescriptPosts.length > 0);

  await conn.end();

  console.log('\n==============================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('==============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
