# Getting Started with Eloquent ORM

A comprehensive guide to get you up and running with Eloquent ORM in your TypeScript project.

## Prerequisites

- Node.js 16+
- TypeScript 4.5+
- An existing database connection (MySQL, PostgreSQL, SQLite, etc.)
- Basic familiarity with ORMs and SQL

## Installation

```bash
npm install @benqoder/eloquent-orm zod
```

## Quick Setup

### 1. Initialize the ORM

First, initialize Eloquent with your existing database connection:

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import mysql from 'mysql2/promise';

// Create your database connection (example with MySQL)
const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'your_user',
    password: 'your_password',
    database: 'your_database'
});

// Initialize Eloquent
await Eloquent.init(connection);
```

### 2. Create Your First Model

Create a model file (e.g., `models/User.ts`):

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';

class User extends Eloquent {
    // Specify the table name
    protected static table = 'users';

    // Define the Zod schema for validation and typing
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
        age: z.number().int().min(0).optional(),
        is_active: z.boolean().default(true),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
        updated_at: z.union([z.string(), z.date()]).nullable().optional(),
    });

    // Define relation types (we'll add relations later)
    relationsTypes!: {
        // Relations will be defined here
    };
}

// Use declaration merging for automatic schema typing
interface User extends z.infer<typeof User.schema> {}

export default User;
```

### 3. Your First Query

Now you can start querying:

```typescript
import User from './models/User';

async function getUsers() {
    // Get all users
    const users = await User.query().get();
    console.log(users);

    // Get a single user
    const user = await User.query().find(1);
    console.log(user?.name); // TypeScript knows this is a string

    // Query with conditions
    const activeUsers = await User.query()
        .where('is_active', true)
        .where('age', '>=', 18)
        .orderBy('created_at', 'desc')
        .limit(10)
        .get();

    console.log(activeUsers);
}

getUsers().catch(console.error);
```

## Building a Simple Blog

Let's build a complete example with a blog system:

### Step 1: Database Schema

First, make sure you have these tables in your database:

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Step 2: Create Models

**User Model** (`models/User.ts`):

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';
import Post from './Post';
import Comment from './Comment';

class User extends Eloquent {
    protected static table = 'users';

    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
        updated_at: z.union([z.string(), z.date()]).nullable().optional(),
    });

    relationsTypes!: {
        posts: Post[];
        comments: Comment[];
        publishedPosts: Post[];
    };

    posts() {
        return this.hasMany(Post, 'user_id');
    }

    publishedPosts() {
        return this.hasMany(Post, 'user_id').where('published', true);
    }

    comments() {
        return this.hasMany(Comment, 'user_id');
    }
}

interface User extends z.infer<typeof User.schema> {}

export default User;
```

**Post Model** (`models/Post.ts`):

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';
import User from './User';
import Comment from './Comment';

class Post extends Eloquent {
    protected static table = 'posts';

    static schema = z.object({
        id: z.number().int().optional(),
        user_id: z.number().int(),
        title: z.string(),
        content: z.string(),
        published: z.boolean(),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
        updated_at: z.union([z.string(), z.date()]).nullable().optional(),
    });

    relationsTypes!: {
        author: User;
        comments: Comment[];
    };

    author() {
        return this.belongsTo(User, 'user_id');
    }

    comments() {
        return this.hasMany(Comment, 'post_id');
    }
}

interface Post extends z.infer<typeof Post.schema> {}

export default Post;
```

**Comment Model** (`models/Comment.ts`):

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';
import User from './User';
import Post from './Post';

class Comment extends Eloquent {
    protected static table = 'comments';

    static schema = z.object({
        id: z.number().int().optional(),
        post_id: z.number().int(),
        user_id: z.number().int(),
        content: z.string(),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
    });

    relationsTypes!: {
        post: Post;
        author: User;
    };

    post() {
        return this.belongsTo(Post, 'post_id');
    }

    author() {
        return this.belongsTo(User, 'user_id');
    }
}

interface Comment extends z.infer<typeof Comment.schema> {}

export default Comment;
```

### Step 3: Use the Models

Now let's create some example functions:

```typescript
import User from './models/User';
import Post from './models/Post';
import Comment from './models/Comment';

// Get blog posts with authors and comment counts
async function getBlogPosts() {
    const posts = await Post.query()
        .with('author')
        .withCount('comments')
        .where('published', true)
        .orderBy('created_at', 'desc')
        .limit(10)
        .get();

    return posts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content.substring(0, 200) + '...',
        author: post.author.name,
        commentCount: post.comments_count,
        publishedAt: post.created_at
    }));
}

// Get a single post with comments
async function getPostWithComments(postId: number) {
    const post = await Post.query()
        .with(['author', 'comments.author'])
        .find(postId);

    if (!post) {
        return null;
    }

    return {
        id: post.id,
        title: post.title,
        content: post.content,
        author: {
            id: post.author.id,
            name: post.author.name
        },
        comments: post.comments.map(comment => ({
            id: comment.id,
            content: comment.content,
            author: comment.author.name,
            createdAt: comment.created_at
        }))
    };
}

// Get user profile with their posts
async function getUserProfile(userId: number) {
    const user = await User.query()
        .with('publishedPosts')
        .withCount(['posts', 'comments'])
        .find(userId);

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        totalPosts: user.posts_count,
        totalComments: user.comments_count,
        recentPosts: user.publishedPosts.slice(0, 5).map(post => ({
            id: post.id,
            title: post.title,
            createdAt: post.created_at
        }))
    };
}

// Example usage
async function main() {
    try {
        console.log('=== Blog Posts ===');
        const posts = await getBlogPosts();
        console.log(posts);

        console.log('\\n=== Post with Comments ===');
        const postDetail = await getPostWithComments(1);
        console.log(postDetail);

        console.log('\\n=== User Profile ===');
        const userProfile = await getUserProfile(1);
        console.log(userProfile);
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
```

## Next Steps

Now that you have the basics working, explore more advanced features:

### 1. Learn About Relationships
Read the [Relationships Guide](./RELATIONSHIPS.md) to understand:
- Different relationship types
- Eager loading strategies
- Polymorphic relationships
- Relationship constraints

### 2. Master TypeScript Integration
Check out the [TypeScript Guide](./TYPESCRIPT.md) for:
- Advanced type safety
- Schema integration
- Custom type definitions
- Best practices

### 3. Study Real-World Examples
Look at the [Examples Guide](./EXAMPLES.md) for:
- E-commerce systems
- Content management
- User management
- Analytics and reporting

### 4. API Reference
Use the [API Reference](./API.md) for complete method documentation.

## Best Practices

### 1. Always Define Schemas
```typescript
// ✅ Good - Full validation and typing
static schema = z.object({
    id: z.number().int().optional(),
    name: z.string().min(1).max(255),
    email: z.string().email(),
});

// ❌ Bad - No validation
static schema = z.object({
    id: z.any(),
    name: z.any(),
    email: z.any(),
});
```

### 2. Use Declaration Merging
```typescript
// ✅ Good - Automatic type inference
class User extends Eloquent {
    static schema = z.object({ /* ... */ });
}
interface User extends z.infer<typeof User.schema> {}

// ❌ Bad - Manual typing (prone to errors)
class User extends Eloquent {
    id?: number;
    name!: string;
    email!: string;
}
```

### 3. Define Relation Types
```typescript
// ✅ Good - Type-safe relations
relationsTypes!: {
    posts: Post[];
    profile: Profile;
};

// ❌ Bad - No relation typing
// (relations will be 'any' type)
```

### 4. Use Eager Loading
```typescript
// ✅ Good - Single query with relations
const users = await User.query().with(['posts', 'profile']).get();

// ❌ Bad - N+1 query problem
const users = await User.query().get();
for (const user of users) {
    const posts = await user.posts().get(); // N additional queries
}
```

## Common Pitfalls

### 1. Read-Only Nature
Remember this ORM is read-only:

```typescript
// ❌ These will throw errors
await User.create({name: 'John'});    // No create method
user.name = 'Jane';
await user.save();                    // No save method
await user.delete();                  // No delete method
```

### 2. Database Connections
The ORM doesn't create connections:

```typescript
// ❌ Bad - Trying to create connection
await Eloquent.init('mysql://localhost/db');

// ✅ Good - Using existing connection
const connection = await mysql.createConnection({...});
await Eloquent.init(connection);
```

### 3. Schema Validation Errors
Make sure your schemas match your database:

```typescript
// If database allows NULL but schema doesn't:
static schema = z.object({
    email: z.string().email(),  // ❌ Will fail if DB has NULL
});

// ✅ Fix by making it nullable
static schema = z.object({
    email: z.string().email().nullable(),
});
```

## Troubleshooting

### TypeScript Errors

**Problem**: Properties show as `any` type
**Solution**: Make sure you're using declaration merging:

```typescript
interface User extends z.infer<typeof User.schema> {}
```

**Problem**: Relations show as `never` type
**Solution**: Define `relationsTypes` properly:

```typescript
relationsTypes!: {
    posts: Post[];  // Not just Post
    profile: Profile;  // Not Profile[]
};
```

### Runtime Errors

**Problem**: "Database connection not initialized"
**Solution**: Call `Eloquent.init()` before making queries

**Problem**: Zod validation errors
**Solution**: Check that your schema matches your database structure

**Problem**: "Read-only ORM violation"
**Solution**: You're trying to use mutation methods - this ORM is read-only

## Getting Help

- Check the [API Reference](./API.md) for method documentation
- Read the [Examples](./EXAMPLES.md) for real-world patterns
- Review the [TypeScript Guide](./TYPESCRIPT.md) for type issues
- Look at the [Relationships Guide](./RELATIONSHIPS.md) for complex relations

You're now ready to build powerful, type-safe applications with Eloquent ORM!