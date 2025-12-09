import { Eloquent } from '../src';
import mysql from 'mysql2/promise';

class User extends Eloquent {
  protected static table = 'users';
  posts() { return this.hasMany(Post, 'user_id'); }
}

class Post extends Eloquent {
  protected static table = 'posts';
  tags() { return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id'); }
}

class Tag extends Eloquent {
  protected static table = 'tags';
}

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: 'root',
    database: 'test_eloquent', port: 3306
  });
  await Eloquent.init(conn as any);

  console.log('=== Verifying nested callback data correctness ===\n');

  // Test: Get Alice's published posts with only TypeScript tag
  const users = await User.query()
    .where('name', 'Alice Johnson')
    .with({
      posts: (q: any) => {
        q.where('published', 1);
        q.with({
          tags: (tq: any) => tq.where('name', 'TypeScript')
        });
      }
    })
    .get();

  const alice = (users as any[])[0];
  console.log('ORM Results for Alice:');
  console.log('-'.repeat(50));
  for (const post of alice.posts || []) {
    const tagNames = post.tags?.map((t: any) => t.name).join(', ') || 'none';
    console.log(`Post ${post.id}: "${post.title}" (published: ${post.published})`);
    console.log(`  Tags: [${tagNames}]`);
  }

  // Now verify with raw SQL
  console.log('\n\nRaw SQL Verification:');
  console.log('-'.repeat(50));

  // Get Alice's published posts
  const [rawPosts] = await conn.query(`
    SELECT p.id, p.title, p.published
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE u.name = 'Alice Johnson' AND p.published = 1
    ORDER BY p.id
  `) as any;

  console.log('Published posts by Alice (raw SQL):');
  for (const post of rawPosts) {
    // Get tags for this post that are 'TypeScript'
    const [tags] = await conn.query(`
      SELECT t.name
      FROM tags t
      JOIN post_tag pt ON t.id = pt.tag_id
      WHERE pt.post_id = ? AND t.name = 'TypeScript'
    `, [post.id]) as any;
    const tagNames = tags.map((t: any) => t.name).join(', ') || 'none';
    console.log(`Post ${post.id}: "${post.title}" -> Tags: [${tagNames}]`);
  }

  // Compare counts
  console.log('\n\nComparison:');
  console.log('-'.repeat(50));
  console.log(`ORM published post count: ${alice.posts?.length}`);
  console.log(`Raw SQL published post count: ${rawPosts.length}`);
  const countMatch = alice.posts?.length === rawPosts.length;
  console.log(`Match: ${countMatch ? '✓ YES' : '✗ NO'}`);

  // Verify each post's tags are correct
  let allTagsCorrect = true;
  for (const ormPost of alice.posts || []) {
    const ormTagNames = ormPost.tags?.map((t: any) => t.name).sort() || [];
    const [rawTags] = await conn.query(`
      SELECT t.name
      FROM tags t
      JOIN post_tag pt ON t.id = pt.tag_id
      WHERE pt.post_id = ? AND t.name = 'TypeScript'
      ORDER BY t.name
    `, [ormPost.id]) as any;
    const rawTagNames = rawTags.map((t: any) => t.name).sort();

    const match = JSON.stringify(ormTagNames) === JSON.stringify(rawTagNames);
    if (!match) {
      console.log(`Post ${ormPost.id} tags MISMATCH: ORM=[${ormTagNames}] vs SQL=[${rawTagNames}]`);
      allTagsCorrect = false;
    }
  }
  console.log(`All tags match: ${allTagsCorrect ? '✓ YES' : '✗ NO'}`);

  // Test 2: Verify a post with NO TypeScript tag gets empty array
  console.log('\n\n=== Test: Post without TypeScript tag ===');
  // Post 6 (JavaScript Fundamentals) only has JavaScript tag
  const jsUsers = await User.query()
    .where('name', 'Bob Smith')
    .with({
      posts: (q: any) => {
        q.where('title', 'JavaScript Fundamentals');
        q.with({
          tags: (tq: any) => tq.where('name', 'TypeScript')
        });
      }
    })
    .get();

  const bob = (jsUsers as any[])[0];
  const jsPost = bob.posts?.[0];
  console.log(`Post: "${jsPost?.title}"`);
  console.log(`Tags (filtered to TypeScript): [${jsPost?.tags?.map((t: any) => t.name).join(', ') || 'empty'}]`);
  console.log(`Expected: empty array (post has JavaScript tag, not TypeScript)`);
  const test2Pass = jsPost?.tags?.length === 0;
  console.log(`Test pass: ${test2Pass ? '✓ YES' : '✗ NO'}`);

  // Test 3: Verify callback ordering works
  console.log('\n\n=== Test: Callback with orderBy ===');
  const orderedUsers = await User.query()
    .where('name', 'Alice Johnson')
    .with({
      posts: (q: any) => {
        q.orderBy('title', 'desc');
        q.limit(3);
      }
    })
    .get();

  const orderedAlice = (orderedUsers as any[])[0];
  console.log('Posts ordered by title DESC (limit 3):');
  for (const post of orderedAlice.posts || []) {
    console.log(`  - ${post.title}`);
  }

  // Verify ordering
  const titles = orderedAlice.posts?.map((p: any) => p.title) || [];
  const sortedTitles = [...titles].sort().reverse();
  const orderCorrect = JSON.stringify(titles) === JSON.stringify(sortedTitles);
  console.log(`Order correct: ${orderCorrect ? '✓ YES' : '✗ NO'}`);

  await conn.end();

  console.log('\n' + '='.repeat(50));
  console.log('All nested callback tests completed');
}

main();
