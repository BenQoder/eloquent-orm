# Eloquent ORM - TypeScript Read-Only ORM

A powerful, type-safe, read-only ORM for TypeScript inspired by Laravel's Eloquent ORM. Built with Zod for runtime validation and designed specifically for data querying and retrieval operations.

## 🎯 Purpose & Design Philosophy

**Read-Only by Design**: This ORM is intentionally designed for read operations only. It does not support insert, update, delete, or DDL operations. This design choice ensures:

- **Safety**: Prevents accidental data mutations
- **Performance**: Optimized specifically for querying
- **Clarity**: Clear separation between read and write operations
- **Security**: Runtime guards reject non-SELECT SQL statements

## ✨ Key Features

- 🔒 **Read-Only Safety**: Runtime guards prevent mutation operations
- 🏷️ **Full TypeScript Support**: Complete type inference with loaded relations
- ✅ **Zod Integration**: Runtime validation with schema-based typing
- 🔗 **Rich Relationships**: belongsTo, hasMany, hasOne, morphMany, belongsToMany
- 🔍 **Advanced Querying**: Eager loading, constraints, aggregates, soft deletes
- 🎛️ **Query Builder**: Fluent, chainable query interface
- 📊 **Aggregations**: Built-in sum, count, avg, min, max support
- 🚀 **Performance**: Optimized for read-heavy workloads

## 📦 Installation

```bash
npm install @benqoder/eloquent-orm
```

## 🚀 Quick Start

### 1. Initialize Connection

```typescript
import Eloquent from '@benqoder/eloquent-orm';

// Initialize with your existing database connection
await Eloquent.init(connection);
```

### 2. Define Models

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';

class User extends Eloquent {
    protected static table = 'users';

    // Define Zod schema for type safety
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
    });

    // Define relation types for TypeScript
    relationsTypes!: {
        posts: Post[];
        profile: Profile;
    };

    // Define relationships
    posts() {
        return this.hasMany(Post, 'user_id');
    }

    profile() {
        return this.hasOne(Profile, 'user_id');
    }
}

// Use declaration merging for automatic schema typing
interface User extends z.infer<typeof User.schema> {}

export default User;
```

### 3. Query Data

```typescript
// Basic queries
const users = await User.query().get();
const user = await User.query().find(1);

// With relationships
const usersWithPosts = await User.query().with('posts').get();
const userWithProfile = await User.query().with(['posts', 'profile']).first();

// Advanced querying
const activeUsers = await User.query()
    .where('status', 'active')
    .whereNotNull('email_verified_at')
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();
```

## 📚 Complete API Documentation

### Query Builder Methods

#### Basic Queries

```typescript
// Get all records
const users = await User.query().get();

// Get single record
const user = await User.query().first();
const user = await User.query().find(1);

// Check existence
const exists = await User.query().exists();

// Count records
const count = await User.query().count();
```

#### Where Clauses

```typescript
// Basic where
User.query().where('name', 'John')
User.query().where('age', '>', 18)
User.query().where('status', 'in', ['active', 'pending'])

// Multiple conditions
User.query()
    .where('status', 'active')
    .where('age', '>=', 18)

// Or conditions
User.query()
    .where('role', 'admin')
    .orWhere('role', 'moderator')

// Null checks
User.query().whereNull('deleted_at')
User.query().whereNotNull('email_verified_at')

// Between
User.query().whereBetween('age', [18, 65])

// In/Not In
User.query().whereIn('status', ['active', 'pending'])
User.query().whereNotIn('role', ['banned', 'suspended'])

// Like patterns
User.query().where('name', 'like', '%john%')

// Raw conditions
User.query().whereRaw('YEAR(created_at) = ?', [2023])
```

#### Ordering & Limiting

```typescript
// Order by
User.query().orderBy('created_at', 'desc')
User.query().orderBy('name') // defaults to 'asc'

// Multiple order columns
User.query()
    .orderBy('status', 'asc')
    .orderBy('created_at', 'desc')

// Random order
User.query().inRandomOrder()

// Limit and offset
User.query().limit(10)
User.query().offset(20)
User.query().limit(10).offset(20) // pagination
```

#### Grouping & Aggregates

```typescript
// Group by
User.query().groupBy('status')

// Having
User.query()
    .groupBy('status')
    .having('count(*)', '>', 5)

// Aggregates
const total = await User.query().count();
const sum = await User.query().sum('points');
const avg = await User.query().avg('age');
const min = await User.query().min('created_at');
const max = await User.query().max('updated_at');
```

### Relationships

#### Defining Relationships

```typescript
class User extends Eloquent {
    // One-to-One
    profile() {
        return this.hasOne(Profile, 'user_id');
    }

    // One-to-Many
    posts() {
        return this.hasMany(Post, 'user_id');
    }

    // Inverse One-to-Many
    category() {
        return this.belongsTo(Category, 'category_id');
    }

    // Many-to-Many
    roles() {
        return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
    }

    // Polymorphic One-to-Many
    comments() {
        return this.morphMany(Comment, 'commentable', 'commentable_type', 'commentable_id');
    }

    // One of Many
    latestPost() {
        return this.hasOneOfMany(Post, 'user_id', 'created_at', 'max');
    }

    // Through relationships
    postComments() {
        return this.through('posts').has('comments');
    }
}
```

#### Eager Loading

```typescript
// Basic eager loading
const users = await User.query().with('posts').get();

// Multiple relations
const users = await User.query().with(['posts', 'profile']).get();

// Nested relations
const users = await User.query().with('posts.comments').get();

// Column selection
const users = await User.query().with('posts:id,title,created_at').get();

// Conditional eager loading
const users = await User.query().with({
    posts: query => query.where('published', true)
}).get();

// Constrained eager loading
const users = await User.query().withWhereHas('posts', query => {
    query.where('published', true);
}).get();
```

#### Lazy Loading

```typescript
const user = await User.query().first();

// Load relations after fetching
await user.load('posts');
await user.load(['posts', 'profile']);

// Load missing relations only
await user.loadMissing('posts');
```

#### Relationship Queries

```typescript
// Query relationship existence
User.query().has('posts')
User.query().has('posts', '>', 5)
User.query().doesntHave('posts')

// Query with relationship constraints
User.query().whereHas('posts', query => {
    query.where('published', true);
});

User.query().whereDoesntHave('posts', query => {
    query.where('published', false);
});

// Relationship aggregates
User.query().withCount('posts')
User.query().withSum('posts', 'views')
User.query().withAvg('posts', 'rating')
User.query().withMax('posts', 'created_at')
User.query().withMin('posts', 'created_at')
```

### Advanced Features

#### Soft Deletes

```typescript
class User extends Eloquent {
    static softDeletes = true; // Enable soft delete support
}

// Query including soft deleted
User.query().withTrashed().get();

// Query only soft deleted
User.query().onlyTrashed().get();

// Query without soft deleted (default)
User.query().withoutTrashed().get();
```

#### Scopes and Conditional Queries

```typescript
// Conditional queries
User.query().when(searchTerm, (query, term) => {
    query.where('name', 'like', `%${term}%`);
});

// Default fallback
User.query().when(false,
    query => query.where('active', true),
    query => query.where('status', 'pending') // default
);
```

#### Raw Queries and Expressions

```typescript
// Raw expressions
User.query().select(User.raw('COUNT(*) as total'))

// Raw where conditions
User.query().whereRaw('YEAR(created_at) = ?', [2023])

// Raw having conditions
User.query().havingRaw('COUNT(*) > ?', [5])
```

#### Query Unions

```typescript
const activeUsers = User.query().where('status', 'active');
const premiumUsers = User.query().where('plan', 'premium');

const combinedUsers = activeUsers.union(premiumUsers).get();
```

#### Chunking Large Results

```typescript
// Process in chunks to manage memory
await User.query().chunk(1000, users => {
    users.forEach(user => {
        // Process each user
        console.log(user.name);
    });
});

// Async chunk processing
await User.query().chunkAsync(1000, async users => {
    await processUsers(users);
});
```

### Schema Integration

#### Zod Schema Definition

```typescript
import { z } from 'zod';

class Product extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        price: z.string(), // Stored as string for precision
        weight: z.number().nullable().optional(),
        available: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
        updated_at: z.union([z.string(), z.date()]).nullable().optional(),
    });
}

// Declaration merging for automatic typing
interface Product extends z.infer<typeof Product.schema> {}
```

#### Runtime Validation

The ORM automatically validates data against your Zod schemas:

```typescript
// Data is automatically validated and typed
const products = await Product.query().get();
// products[0].price is typed as string
// products[0].weight is typed as number | null | undefined
```

### TypeScript Integration

#### Automatic Type Inference

```typescript
// Basic queries are properly typed
const users: User[] = await User.query().get();
const user: User | null = await User.query().first();

// Relations are properly typed
const usersWithPosts = await User.query().with('posts').get();
// usersWithPosts[0].posts is typed as Post[]

// Relation queries return correct types
const posts: Post[] = await user.posts().get();
const profile: Profile | null = await user.profile().first();
```

#### Relation Type Definitions

```typescript
class User extends Eloquent {
    // Define relation return types for TypeScript
    relationsTypes!: {
        posts: Post[];
        profile: Profile;
        roles: Role[];
        comments: Comment[];
    };
}

// With relations automatically include the loaded types
const user = await User.query().with('posts').first();
// user.posts is properly typed as Post[]
```

## 🔧 Configuration

### Model Configuration

```typescript
class User extends Eloquent {
    protected static table = 'users';           // Table name
    protected static fillable = ['name', 'email']; // Not used (read-only)
    protected static hidden = ['password'];     // Hidden in JSON output
    protected static with = ['profile'];        // Default eager loading
    static softDeletes = true;                  // Enable soft deletes
    static morphClass = 'App\\Models\\User';    // For polymorphic relations
}
```

### Connection Management

```typescript
import Eloquent from '@benqoder/eloquent-orm';

// Initialize with existing connection
await Eloquent.init(mysqlConnection);

// The ORM does not create connections - use your existing setup
```

## ⚠️ Important Limitations

### Read-Only Design

This ORM is **intentionally read-only**. The following operations are **NOT supported**:

```typescript
// ❌ These will throw runtime errors
User.create({name: 'John'});     // No create
user.save();                     // No save
user.delete();                   // No delete
User.query().update({...});      // No update
User.query().insert({...});      // No insert
```

### SQL Restrictions

- Only `SELECT` statements are allowed
- Raw SQL is validated to prevent mutations
- DDL operations are blocked
- Transactions are not supported (read-only)

## 🎨 Examples

### E-commerce Product Catalog

```typescript
// Product model
class Product extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        business_id: z.number().int(),
        name: z.string(),
        price: z.string(),
        available: z.number().nullable().optional(),
    });

    relationsTypes!: {
        business: Business;
        categories: ProductCategory[];
        medias: Media[];
    };

    business() {
        return this.belongsTo(Business, 'business_id');
    }

    categories() {
        return this.belongsToMany(ProductCategory, 'category_product');
    }
}

// Query examples
const products = await Product.query()
    .with(['business', 'categories'])
    .where('available', '>', 0)
    .whereHas('business', query => {
        query.where('status', 'active');
    })
    .orderBy('created_at', 'desc')
    .limit(20)
    .get();

const product = products[0];
console.log(product.name);              // string
console.log(product.business.name);     // string
console.log(product.categories.length); // number
```

### Blog System

```typescript
class Post extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        user_id: z.number().int(),
        title: z.string(),
        content: z.string(),
        published: z.boolean(),
        published_at: z.date().nullable().optional(),
    });

    relationsTypes!: {
        author: User;
        comments: Comment[];
        tags: Tag[];
    };

    author() {
        return this.belongsTo(User, 'user_id');
    }

    comments() {
        return this.hasMany(Comment, 'post_id');
    }

    tags() {
        return this.belongsToMany(Tag, 'post_tags');
    }
}

// Advanced querying
const publishedPosts = await Post.query()
    .with(['author', 'comments', 'tags'])
    .where('published', true)
    .whereNotNull('published_at')
    .withCount('comments')
    .orderBy('published_at', 'desc')
    .chunk(100, posts => {
        posts.forEach(post => {
            console.log(`${post.title} by ${post.author.name}`);
            console.log(`${post.comments_count} comments`);
        });
    });
```

## 🤝 Contributing

This is a specialized read-only ORM. When contributing:

1. Maintain the read-only design principle
2. Add runtime guards for any new SQL-generating methods
3. Ensure full TypeScript support
4. Add Zod integration for new features
5. Include comprehensive tests

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

Inspired by Laravel's Eloquent ORM, adapted for TypeScript with a read-only focus and enhanced type safety through Zod integration.