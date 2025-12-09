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
  user() { return this.belongsTo(User, 'user_id'); }
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
  console.log('  ADVANCED NESTED CALLBACK TESTS');
  console.log('==============================================');

  // Test 1: Callback on top-level + nested with callback
  console.log('\n--- TEST 1: Top-level callback + nested callback ---');
  const users1 = await User.query()
    .with({
      posts: (q: any) => {
        q.where('published', 1);
        q.orderBy('created_at', 'desc');
        q.with({
          tags: (tq: any) => tq.orderBy('name', 'asc')
        });
      }
    })
    .where('name', 'Alice Johnson')
    .get();

  const alice1 = (users1 as any[])[0];
  test('Posts are filtered (published only)', alice1.posts.length === 4);
  test('Posts have tags loaded', Array.isArray(alice1.posts[0]?.tags));
  test('Post 1 has 2 tags (TypeScript, JavaScript)', alice1.posts.find((p: any) => p.id === 1)?.tags?.length === 2);

  // Test 2: Multiple nested callbacks at same level
  console.log('\n--- TEST 2: Multiple nested callbacks at same level ---');
  const users2 = await User.query()
    .with({
      posts: (q: any) => {
        q.limit(5);
        q.with({
          tags: (tq: any) => tq.where('name', 'LIKE', '%Script%'),
          comments: (cq: any) => cq.orderBy('created_at', 'desc').limit(2)
        });
      }
    })
    .where('name', 'Alice Johnson')
    .get();

  const alice2 = (users2 as any[])[0];
  test('Posts limited to 5', alice2.posts.length <= 5);
  test('Tags filtered to *Script names', alice2.posts[0]?.tags?.every((t: any) => t.name.includes('Script')));
  test('Comments limited to 2 per post', alice2.posts[0]?.comments?.length <= 2);

  // Test 3: Three levels deep with callbacks
  console.log('\n--- TEST 3: Three levels deep with callbacks ---');
  const posts3 = await Post.query()
    .with({
      author: (q: any) => {
        q.with({
          posts: (pq: any) => {
            pq.where('published', 1);
            pq.with('tags');
          }
        });
      }
    })
    .where('id', 1)
    .get();

  const post3 = (posts3 as any[])[0];
  test('Post has author', post3.author !== null);
  test('Author has posts loaded', Array.isArray(post3.author?.posts));
  test('Author posts are filtered (published)', post3.author?.posts?.every((p: any) => p.published === 1));
  test('Author posts have tags', Array.isArray(post3.author?.posts?.[0]?.tags));

  // Test 4: Callback with select/columns
  console.log('\n--- TEST 4: Callback with whereIn ---');
  const users4 = await User.query()
    .with({
      posts: (q: any) => {
        q.whereIn('id', [1, 2, 3]);
      }
    })
    .where('name', 'Alice Johnson')
    .get();

  const alice4 = (users4 as any[])[0];
  test('Posts filtered by whereIn', alice4.posts.length === 3);
  test('Post IDs match [1,2,3]', alice4.posts.every((p: any) => [1, 2, 3].includes(p.id)));

  // Test 5: BelongsToMany with callback
  console.log('\n--- TEST 5: BelongsToMany with pivot callback ---');
  const tags5 = await Tag.query()
    .with({
      posts: (q: any) => {
        q.where('published', 1);
        q.orderBy('title', 'asc');
      }
    })
    .where('name', 'TypeScript')
    .get();

  const tsTag = (tags5 as any[])[0];
  test('Tag has posts', Array.isArray(tsTag.posts));
  test('Posts are published only', tsTag.posts.every((p: any) => p.published === 1));
  test('Posts are ordered by title', tsTag.posts.length > 1 && tsTag.posts[0].title < tsTag.posts[1].title);

  // Test 6: Callback returns empty result
  console.log('\n--- TEST 6: Callback that returns empty result ---');
  const users6 = await User.query()
    .with({
      posts: (q: any) => {
        q.where('title', 'NONEXISTENT_TITLE_12345');
      }
    })
    .where('name', 'Alice Johnson')
    .get();

  const alice6 = (users6 as any[])[0];
  test('Posts array exists but empty', Array.isArray(alice6.posts) && alice6.posts.length === 0);

  // Test 7: Mix callback and string in same with()
  console.log('\n--- TEST 7: Mix callback and dot-notation ---');
  const users7 = await User.query()
    .with('profile')
    .with({
      'posts.tags': (q: any) => q.limit(1)
    })
    .where('name', 'Alice Johnson')
    .get();

  const alice7 = (users7 as any[])[0];
  test('Profile loaded (string syntax)', alice7.profile !== null);
  test('Posts loaded', Array.isArray(alice7.posts));
  test('Tags loaded with limit', alice7.posts[0]?.tags?.length <= 1);

  // Test 8: Morphic relation with callback
  console.log('\n--- TEST 8: MorphMany with callback ---');
  const posts8 = await Post.query()
    .with({
      comments: (q: any) => {
        q.where('body', 'LIKE', '%great%');
      }
    })
    .where('id', 1)
    .get();

  const post8 = (posts8 as any[])[0];
  test('Comments filtered by body content', post8.comments.every((c: any) => c.body.toLowerCase().includes('great')));

  await conn.end();

  console.log('\n==============================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('==============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
