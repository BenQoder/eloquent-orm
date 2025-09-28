# Eloquent ORM - TypeScript Read-Only ORM

A powerful, type-safe, read-only ORM for TypeScript that allows you to access Laravel databases from Node.js environments. Built with Zod for runtime validation and designed specifically for data querying and retrieval operations.

## 🎯 Purpose & Use Case

**Laravel Database Access from Node.js**: This ORM is specifically designed for scenarios where you have a Laravel backend but need to access the same database from Node.js applications (microservices, analytics tools, reporting services, etc.).

**Perfect for:**

- Node.js microservices that need to read from Laravel databases
- Analytics and reporting tools built in Node.js
- API gateways that aggregate data from Laravel databases
- Background processing services
- Real-time dashboards and monitoring tools

**Read-Only by Design**: This ORM is intentionally designed for read operations only. It does not support insert, update, delete, or DDL operations. This design choice ensures:

- **Safety**: Prevents accidental data mutations (write operations should go through Laravel)
- **Performance**: Optimized specifically for querying
- **Clarity**: Clear separation between read and write operations
- **Security**: Runtime guards reject non-SELECT SQL statements
- **Laravel Compatibility**: Maintains your Laravel app as the single source of truth for data mutations
- **Migration Management**: Database schema changes and migrations remain in your Laravel backend
- **Business Logic**: All write operations, validations, and business logic stay in Laravel

## 🏗️ Architecture Pattern

This ORM enables a clean separation of concerns in multi-service architectures:

```
┌─────────────────────┐    ┌─────────────────────┐
│   Laravel Backend   │    │  Node.js Services   │
│                     │    │                     │
│  ✅ Write Operations│    │  ✅ Read Operations │
│  ✅ Migrations      │    │  ✅ Analytics       │
│  ✅ Business Logic  │    │  ✅ Reporting       │
│  ✅ Validations     │    │  ✅ API Gateways    │
│  ✅ Seeders         │    │  ✅ Dashboards      │
│                     │    │                     │
└─────────┬───────────┘    └─────────┬───────────┘
          │                          │
          └──────────┬─────────────────┘
                     │
           ┌─────────▼─────────┐
           │   Shared Database │
           │                   │
           │  📊 MySQL/Postgres│
           │  📊 Same Schema   │
           └───────────────────┘
```

## ✨ Key Features

- 🔒 **Read-Only Safety**: Runtime guards prevent mutation operations
- 🏷️ **Full TypeScript Support**: Complete type inference with loaded relations
- ✅ **Zod Integration**: Runtime validation with schema-based typing
- 🔗 **Rich Relationships**: belongsTo, hasMany, hasOne, morphMany, belongsToMany
- 🔍 **Advanced Querying**: Eager loading, constraints, aggregates, soft deletes
- ⚡ **Automatic Relationship Autoloading**: Optional global or per-collection lazy eager loading
- 🎛️ **Query Builder**: Fluent, chainable query interface
- 📊 **Aggregations**: Built-in sum, count, avg, min, max support
- 🚀 **Performance**: Optimized for read-heavy workloads

## 📦 Installation

```bash
npm install @benqoder/eloquent-orm
```

## 🏗️ Prerequisites

This package is designed to work with existing Laravel applications. You'll need:

- **Laravel Backend**: An existing Laravel application with database models
- **Shared Database**: Access to the same database used by your Laravel app
- **Database Connection**: A Node.js database connection to your Laravel database
- **Laravel Schema Knowledge**: Understanding of your Laravel model structure and relationships

## 🚀 Quick Start

### 1. Initialize Connection

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import mysql from 'mysql2/promise';

// Connect to your Laravel database
const connection = await mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE, // Same database as your Laravel app
	port: parseInt(process.env.DB_PORT || '3306'),
});

// Initialize Eloquent with the Laravel database connection
await Eloquent.init(connection);
```

### 2. Define Models (Mirror Your Laravel Models)

Create TypeScript models that mirror your existing Laravel Eloquent models:

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';

// This should mirror your Laravel User model
class User extends Eloquent {
	protected static table = 'users'; // Same table as Laravel

	// Define Zod schema matching your Laravel migration/model
	static schema = z.object({
		id: z.number().int().optional(),
		name: z.string(),
		email: z.string().email(),
		email_verified_at: z.union([z.string(), z.date()]).nullable().optional(),
		created_at: z.union([z.string(), z.date()]).nullable().optional(),
		updated_at: z.union([z.string(), z.date()]).nullable().optional(),
	});

	// Define relation types matching your Laravel relationships
	relationsTypes!: {
		posts: Post[];
		profile: Profile;
	};

	// Define relationships (same as your Laravel model)
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
User.query().where('name', 'John');
User.query().where('age', '>', 18);
User.query().where('status', 'in', ['active', 'pending']);

// Multiple conditions
User.query().where('status', 'active').where('age', '>=', 18);

// Or conditions
User.query().where('role', 'admin').orWhere('role', 'moderator');

// Null checks
User.query().whereNull('deleted_at');
User.query().whereNotNull('email_verified_at');

// Between
User.query().whereBetween('age', [18, 65]);

// In/Not In
User.query().whereIn('status', ['active', 'pending']);
User.query().whereNotIn('role', ['banned', 'suspended']);

// Like patterns
User.query().where('name', 'like', '%john%');

// Raw conditions
User.query().whereRaw('YEAR(created_at) = ?', [2023]);
```

#### Ordering & Limiting

```typescript
// Order by
User.query().orderBy('created_at', 'desc');
User.query().orderBy('name'); // defaults to 'asc'

// Multiple order columns
User.query().orderBy('status', 'asc').orderBy('created_at', 'desc');

// Random order
User.query().inRandomOrder();

// Limit and offset
User.query().limit(10);
User.query().offset(20);
User.query().limit(10).offset(20); // pagination
```

#### Grouping & Aggregates

```typescript
// Group by
User.query().groupBy('status');

// Having
User.query().groupBy('status').having('count(*)', '>', 5);

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
const users = await User.query()
	.with({
		posts: (query) => query.where('published', true),
	})
	.get();

// Constrained eager loading
const users = await User.query()
	.withWhereHas('posts', (query) => {
		query.where('published', true);
	})
	.get();
```

#### Automatic Relationship Autoloading

You can enable Laravel-like automatic relationship autoloading. When enabled, accessing an unloaded relation triggers a lazy eager load. If the instance belongs to a collection with autoloading enabled, the relation is loaded for the entire collection in one batched query.

Global enable:

```typescript
import Eloquent from '@benqoder/eloquent-orm';
Eloquent.automaticallyEagerLoadRelationships();
```

Per-collection:

```typescript
const users = await User.query().get();
users.withRelationshipAutoloading();

// Accessing users[0].posts will load posts for all users in the collection
console.log(users[0].posts.length);
```

Note: Property access is synchronous in JavaScript; eager loading still occurs asynchronously. Prefer calling a load step before reading values in performance-critical paths.

#### Collection-wide Loading with loadForAll

To explicitly load relations across the entire collection from any instance:

```typescript
const products = await Product.query().limit(5).get();

// Load for all items in the collection (only missing relations are fetched)
await products[0].loadForAll('business');

// Multiple or nested relations
await products[0].loadForAll('business', 'business.orders', 'business.orders.items');

// Tuple/array literal also works (use `as const` for best typing)
await products[0].loadForAll(['business', 'categories'] as const);

// Now you can safely access loaded values
const ids = products.map((p) => p.business?.id ?? null);
```

Constraints and column selection:

```typescript
// Constrain relations with callbacks
await products[0].loadForAll({
	business: (q) => q.where('status', 'active'),
	'business.orders': (q) => q.where('total', '>', 100),
});

// Select specific columns
await products[0].loadForAll({ business: ['id', 'name'] });
```

Typing tips:

- Single relation returns the instance augmented with that relation key:

```ts
const p = products[0];
const withBiz = await p.loadForAll('business');
// withBiz: Product & { business: Business }
```

- Multiple keys via variadic args:

```ts
const augmented = await p.loadForAll('business', 'categories');
// augmented: Product & { business: Business; categories: ProductCategory[] }
```

- Arrays should be declared as const tuples to preserve literal keys:

```ts
const rels = ['business', 'categories'] as const;
const augmented2 = await p.loadForAll(rels);
```

The loader batches queries and skips already-loaded relations to avoid redundant fetches.

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
User.query().has('posts');
User.query().has('posts', '>', 5);
User.query().doesntHave('posts');

// Query with relationship constraints
User.query().whereHas('posts', (query) => {
	query.where('published', true);
});

User.query().whereDoesntHave('posts', (query) => {
	query.where('published', false);
});

// Relationship aggregates
User.query().withCount('posts');
User.query().withSum('posts', 'views');
User.query().withAvg('posts', 'rating');
User.query().withMax('posts', 'created_at');
User.query().withMin('posts', 'created_at');
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
User.query().when(
	false,
	(query) => query.where('active', true),
	(query) => query.where('status', 'pending') // default
);
```

#### Raw Queries and Expressions

```typescript
// Raw expressions
User.query().select(User.raw('COUNT(*) as total'));

// Raw where conditions
User.query().whereRaw('YEAR(created_at) = ?', [2023]);

// Raw having conditions
User.query().havingRaw('COUNT(*) > ?', [5]);
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
await User.query().chunk(1000, (users) => {
	users.forEach((user) => {
		// Process each user
		console.log(user.name);
	});
});

// Async chunk processing
await User.query().chunkAsync(1000, async (users) => {
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

Models support various configuration options to customize their behavior:

```typescript
class User extends Eloquent {
	// Database Configuration
	protected static table = 'users'; // Table name
	protected static hidden: string[] = ['password']; // Hidden in JSON output
	protected static with: string[] = ['profile']; // Default eager loading
	static softDeletes = true; // Enable soft delete support
	static morphClass = 'App\\Models\\User'; // For polymorphic relations

	// Schema & Validation
	static schema?: z.ZodTypeAny; // Zod validation schema

	// Type Casting
	protected static casts: Record<string, string> = {
		created_at: 'datetime',
		updated_at: 'datetime',
		amount: 'integer',
		price: 'string', // Stored as string in DB
		is_active: 'boolean',
	};

	// Relationship Type Definitions (for TypeScript)
	relationsTypes!: {
		posts: Post[];
		profile: Profile;
		roles: Role[];
	};
}
```

#### Available Configuration Options

| Property         | Type                     | Description                     | Example                      |
| ---------------- | ------------------------ | ------------------------------- | ---------------------------- |
| `table`          | `string`                 | Database table name             | `'users'`                    |
| `hidden`         | `string[]`               | Fields to hide in JSON output   | `['password', 'token']`      |
| `with`           | `string[]`               | Default eager loading           | `['profile', 'posts']`       |
| `softDeletes`    | `boolean`                | Enable soft delete support      | `true`                       |
| `morphClass`     | `string`                 | Polymorphic type identifier     | `'App\\Models\\User'`        |
| `schema`         | `z.ZodTypeAny`           | Zod validation schema           | `z.object({...})`            |
| `casts`          | `Record<string, string>` | Type casting rules              | `{'created_at': 'datetime'}` |
| `relationsTypes` | `object`                 | TypeScript relation definitions | `{posts: Post[]}`            |

#### Schema Definition Guidelines

```typescript
// ✅ Good - Complete schema with proper types
static schema = z.object({
	id: z.number().int().optional(),
	name: z.string().min(1).max(255),
	email: z.string().email(),
	age: z.number().int().min(0).max(150).nullable().optional(),
	created_at: z.union([z.string(), z.date()]).nullable().optional(),
	updated_at: z.union([z.string(), z.date()]).nullable().optional(),
});

// ❌ Bad - Incomplete or incorrect schema
static schema = z.object({
	id: z.any(),  // Too loose
	name: z.string(),  // No validation
	age: z.number(),  // Doesn't handle null/undefined
});
```

#### Cast Types Available

| Cast         | Database Type        | TypeScript Type | Example          |
| ------------ | -------------------- | --------------- | ---------------- |
| `'integer'`  | `INT`                | `number`        | `123`            |
| `'float'`    | `FLOAT/DECIMAL`      | `number`        | `123.45`         |
| `'string'`   | `VARCHAR/TEXT`       | `string`        | `"Hello"`        |
| `'boolean'`  | `TINYINT(1)`         | `boolean`       | `true`           |
| `'datetime'` | `DATETIME/TIMESTAMP` | `Date`          | `new Date()`     |
| `'array'`    | `JSON`               | `any[]`         | `[1, 2, 3]`      |
| `'json'`     | `JSON`               | `object`        | `{key: 'value'}` |

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

### Laravel Backend Responsibilities

**All write operations and schema management should happen in your Laravel backend:**

- **Migrations**: Use Laravel's migration system (`php artisan migrate`)
- **Create/Update/Delete**: Use Laravel controllers, jobs, or artisan commands
- **Schema Changes**: Add new tables/columns through Laravel migrations
- **Business Logic**: Keep validation rules and business logic in Laravel
- **Seeders**: Use Laravel seeders for populating test data

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
	.whereHas('business', (query) => {
		query.where('status', 'active');
	})
	.orderBy('created_at', 'desc')
	.limit(20)
	.get();

const product = products[0];
console.log(product.name); // string
console.log(product.business.name); // string
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
	.chunk(100, (posts) => {
		posts.forEach((post) => {
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
