# TypeScript Integration Guide

This guide covers how to get the most out of Eloquent ORM's TypeScript integration, including proper typing, Zod schema integration, and advanced type safety features.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Schema Integration](#schema-integration)
- [Relation Types](#relation-types)
- [Query Builder Types](#query-builder-types)
- [Advanced Type Features](#advanced-type-features)
- [Best Practices](#best-practices)

## Basic Setup

### Model Definition with TypeScript

```typescript
import Eloquent from '@benqoder/eloquent-orm';
import { z } from 'zod';

class User extends Eloquent {
    protected static table = 'users';

    // Zod schema for runtime validation and type inference
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
        age: z.number().int().min(0).max(120),
        is_active: z.boolean(),
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
        updated_at: z.union([z.string(), z.date()]).nullable().optional(),
    });

    // Relation type definitions
    relationsTypes!: {
        posts: Post[];
        profile: Profile;
        roles: Role[];
    };

    // Relationship methods
    posts() {
        return this.hasMany(Post, 'user_id');
    }

    profile() {
        return this.hasOne(Profile, 'user_id');
    }

    roles() {
        return this.belongsToMany(Role, 'user_roles');
    }
}

// Declaration merging to add schema types to the class
interface User extends z.infer<typeof User.schema> {}

export default User;
```

## Schema Integration

### Zod Schema Definition

Zod schemas provide both runtime validation and compile-time type safety:

```typescript
class Product extends Eloquent {
    static schema = z.object({
        // Required fields
        id: z.number().int().optional(),
        name: z.string().min(1).max(255),
        price: z.string(), // Using string for decimal precision

        // Optional fields
        description: z.string().nullable().optional(),
        weight: z.number().positive().nullable().optional(),

        // Enums
        status: z.enum(['active', 'inactive', 'discontinued']),

        // Arrays
        tags: z.array(z.string()).optional(),

        // Dates (flexible format)
        created_at: z.union([z.string(), z.date()]).nullable().optional(),
        updated_at: z.union([z.string(), z.date()]).nullable().optional(),

        // Complex validations
        email: z.string().email().nullable().optional(),
        url: z.string().url().nullable().optional(),
    });
}

interface Product extends z.infer<typeof Product.schema> {}
```

### Automatic Type Inference

Once you define the schema and use declaration merging, all properties are automatically typed:

```typescript
const product = await Product.query().first();

// All these properties are properly typed from the schema
console.log(product.name);        // string
console.log(product.price);       // string
console.log(product.weight);      // number | null | undefined
console.log(product.status);      // "active" | "inactive" | "discontinued"
console.log(product.tags);        // string[] | undefined
console.log(product.created_at);  // string | Date | null | undefined
```

### Handling Nullable Fields

Properly handle nullable database fields in your schemas:

```typescript
class User extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),

        // Field that can be null in database
        email: z.string().email().nullable(),

        // Field that can be null OR undefined
        phone: z.string().nullable().optional(),

        // Field with default value
        is_active: z.boolean().default(true),

        // Timestamp that might not exist
        email_verified_at: z.union([z.string(), z.date()]).nullable().optional(),
    });
}

interface User extends z.infer<typeof User.schema> {}

// Usage with proper null checking
const user = await User.query().first();
if (user.email !== null) {
    console.log(user.email.toLowerCase()); // TypeScript knows email is string here
}
```

## Relation Types

### Defining Relation Types

The `relationsTypes` property tells TypeScript what types to expect for each relation:

```typescript
class User extends Eloquent {
    relationsTypes!: {
        // One-to-One
        profile: Profile;

        // One-to-Many
        posts: Post[];
        comments: Comment[];

        // Many-to-Many
        roles: Role[];
        tags: Tag[];

        // Polymorphic
        notifications: Notification[];

        // One of Many
        latestPost: Post;
        oldestPost: Post;

        // Conditional relations
        publishedPosts: Post[];
        draftPosts: Post[];
    };
}
```

### Explicit Type Parameters for Relations

**IMPORTANT**: When working with relations, you must provide explicit type parameters to ensure TypeScript correctly infers the loaded relation types. This applies to all data-fetching methods.

#### Why Explicit Type Parameters Are Required

TypeScript's type system cannot automatically infer which relations are loaded at runtime. The `with()` method accepts string literals that are validated at runtime, but TypeScript needs explicit type information to provide compile-time safety:

```typescript
// ❌ Without explicit type parameter
const authors = await Author.query().with('books').get();
// authors[0].books - TypeScript error: Property 'books' does not exist

// ✅ With explicit type parameter
const authors = await Author.query()
    .with('books')
    .get<Author & { books: Book[] }>();
// authors[0].books - Properly typed as Book[]
```

#### Data-Fetching Methods Requiring Explicit Types

**get()** - Fetch multiple records
```typescript
const authors = await Author.query()
    .with('books')
    .get<Author & { books: Book[] }>();

// Multiple relations
const authors = await Author.query()
    .with(['books', 'profile'])
    .get<Author & { books: Book[]; profile: Profile }>();

// Nested relations
const authors = await Author.query()
    .with(['books.reviews', 'profile.address'])
    .get<Author & {
        books: (Book & { reviews: Review[] })[];
        profile: Profile & { address: Address };
    }>();
```

**first()** - Fetch single record
```typescript
const author = await Author.query()
    .with('books')
    .first<Author & { books: Book[] }>();
// Type: (Author & { books: Book[] }) | null
```

**find()** - Find by primary key
```typescript
const author = await Author.query()
    .with('books')
    .find<Author & { books: Book[] }>(1);
// Type: (Author & { books: Book[] }) | null
```

**findOrFail()** - Find by primary key or throw
```typescript
const author = await Author.query()
    .with('books')
    .findOrFail<Author & { books: Book[] }>(1);
// Type: Author & { books: Book[] }
```

**load()** - Lazy load relations on instance
```typescript
const author = await Author.query().first();
const authorWithBooks = await author.load<Author & { books: Book[] }>(['books']);
// Type: Author & { books: Book[] }

// Multiple relations
const authorWithMore = await author.load<
    Author & { books: Book[]; profile: Profile }
>(['books', 'profile']);
```

**loadForAll()** - Load relations for entire collection
```typescript
const authors = await Author.query().limit(5).get();

// Single relation
const authorWithBooks = await authors[0].loadForAll<
    Author & { books: Book[] }
>(['books']);

// Multiple relations
const authorWithRelations = await authors[0].loadForAll<
    Author & { books: Book[]; profile: Profile }
>(['books', 'profile']);

// Nested relations
const authorWithNested = await authors[0].loadForAll<
    Author & {
        books: (Book & { reviews: Review[] })[];
        profile: Profile & { address: Address };
    }
>(['books.reviews', 'profile.address']);
```

### Automatic Relation Typing (When Using Explicit Parameters)

Once you provide explicit type parameters, TypeScript will correctly type all relation access:

```typescript
// With explicit type parameter
const authors = await Author.query()
    .with(['books', 'profile'])
    .get<Author & { books: Book[]; profile: Profile }>();

// Accessing loaded relations - fully typed
const author = authors[0];
console.log(author.books.length);        // ✅ TypeScript knows books is Book[]
console.log(author.books[0].title);      // ✅ TypeScript knows Book properties
console.log(author.profile.bio);         // ✅ TypeScript knows Profile properties
```

### Relation Query Types

Relation methods return properly typed QueryBuilders:

```typescript
const user = await User.query().first();

// Relation queries maintain proper types
const posts = await user.posts().get();
// Type: Post[]

const publishedPosts = await user.posts()
    .where('published', true)
    .orderBy('created_at', 'desc')
    .get();
// Type: Post[]

const latestPost = await user.posts()
    .orderBy('created_at', 'desc')
    .first();
// Type: Post | null

const profile = await user.profile().first();
// Type: Profile | null
```

## Query Builder Types

### Generic QueryBuilder

The QueryBuilder is generic and tracks the model type and loaded relations:

```typescript
// Basic QueryBuilder
const queryBuilder = User.query();
// Type: QueryBuilder<typeof User, never>

// With relations tracked
const queryWithPosts = User.query().with('posts');
// Type: QueryBuilder<typeof User, "posts">

const queryWithMultiple = User.query().with(['posts', 'profile']);
// Type: QueryBuilder<typeof User, "posts" | "profile">
```

### Return Type Inference

Query methods return properly typed results:

```typescript
// get() returns array of models
const users: User[] = await User.query().get();

// first() returns single model or null
const user: User | null = await User.query().first();

// find() returns single model or null
const user: User | null = await User.query().find(1);

// With relations
const usersWithPosts = await User.query().with('posts').get();
// Type: (User & { posts: Post[] })[]

// Aggregates return numbers
const count: number = await User.query().count();
const sum: number = await User.query().sum('age');
const avg: number = await User.query().avg('age');
```

### Method Chaining

All query builder methods maintain type safety:

```typescript
const result = await User.query()
    .select('id', 'name', 'email')           // Still User type
    .where('is_active', true)                // Still User type
    .whereIn('role', ['admin', 'user'])      // Still User type
    .orderBy('created_at', 'desc')           // Still User type
    .limit(10)                               // Still User type
    .with('posts')                           // Now User & { posts: Post[] }
    .get();                                  // Returns typed array
```

## Advanced Type Features

### Conditional Types with When

The `when` method preserves types through conditional logic:

```typescript
const includeProfile = true;
const includePosts = false;

const users = await User.query()
    .when(includeProfile, query => query.with('profile'))
    .when(includePosts, query => query.with('posts'))
    .get();

// TypeScript correctly infers the conditional types
```

### Custom Relation Types

Define custom relation methods with proper typing:

```typescript
class User extends Eloquent {
    relationsTypes!: {
        recentPosts: Post[];
        popularPosts: Post[];
    };

    recentPosts(): QueryBuilder<typeof Post, never> {
        return this.hasMany(Post, 'user_id')
            .where('created_at', '>', '2023-01-01')
            .orderBy('created_at', 'desc');
    }

    popularPosts(): QueryBuilder<typeof Post, never> {
        return this.hasMany(Post, 'user_id')
            .where('views', '>', 1000)
            .orderBy('views', 'desc');
    }
}

// Usage maintains proper types
const user = await User.query().first();
const recentPosts: Post[] = await user.recentPosts().get();
const popularPost: Post | null = await user.popularPosts().first();
```

### Union Types for Polymorphic Relations

Handle polymorphic relations with union types:

```typescript
class Comment extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        content: z.string(),
        commentable_type: z.string(),
        commentable_id: z.number().int(),
    });

    relationsTypes!: {
        // Union type for polymorphic relation
        commentable: Post | Video | Article;
    };

    commentable() {
        return this.morphTo('commentable', 'commentable_type', 'commentable_id');
    }
}

interface Comment extends z.infer<typeof Comment.schema> {}

// Usage with type guards
const comment = await Comment.query().with('commentable').first();

if (comment.commentable instanceof Post) {
    console.log(comment.commentable.title);     // Post-specific property
} else if (comment.commentable instanceof Video) {
    console.log(comment.commentable.duration);  // Video-specific property
}
```

### Type-Safe Aggregates

Aggregate methods with relation constraints maintain type safety:

```typescript
const users = await User.query()
    .withCount('posts')                    // Adds posts_count: number
    .withSum('posts', 'views')             // Adds posts_sum_views: number
    .withAvg('posts', 'rating')            // Adds posts_avg_rating: number
    .get();

users.forEach(user => {
    console.log(`${user.name} has ${user.posts_count} posts`);
    console.log(`Total views: ${user.posts_sum_views}`);
    console.log(`Average rating: ${user.posts_avg_rating}`);
});
```

## Best Practices

### 1. Always Use Declaration Merging

```typescript
// ✅ Good - Schema types merged with class
class User extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
    });
}

interface User extends z.infer<typeof User.schema> {}

// ❌ Bad - No automatic schema typing
class User extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
    });

    // Manual property definitions (prone to drift)
    id?: number;
    name!: string;
    email!: string;
}
```

### 2. Define Complete Relation Types

```typescript
// ✅ Good - All relations typed
class User extends Eloquent {
    relationsTypes!: {
        posts: Post[];
        profile: Profile;
        roles: Role[];
        comments: Comment[];
    };
}

// ❌ Bad - Missing relation types
class User extends Eloquent {
    // No relationsTypes - loses type safety
}
```

### 3. Use Specific Zod Types

```typescript
// ✅ Good - Specific validations
static schema = z.object({
    status: z.enum(['active', 'inactive', 'pending']),
    email: z.string().email(),
    age: z.number().int().min(0).max(120),
    url: z.string().url().nullable().optional(),
});

// ❌ Bad - Generic types
static schema = z.object({
    status: z.string(),
    email: z.string(),
    age: z.number(),
    url: z.string().nullable().optional(),
});
```

### 4. Handle Nullable Fields Properly

```typescript
// ✅ Good - Matches database schema
static schema = z.object({
    name: z.string(),                              // NOT NULL
    email: z.string().email().nullable(),          // NULL allowed
    phone: z.string().nullable().optional(),       // NULL allowed, might not exist
    created_at: z.date().nullable().optional(),    // Timestamp field
});

// ❌ Bad - Doesn't match database
static schema = z.object({
    name: z.string(),
    email: z.string().email(),          // Required but DB allows NULL
    phone: z.string(),                  // Required but DB allows NULL
    created_at: z.date(),               // Required but DB allows NULL
});
```

### 5. Use Type Guards for Polymorphic Relations

```typescript
// ✅ Good - Type-safe polymorphic handling
function handleCommentable(commentable: Post | Video | Article) {
    if (commentable instanceof Post) {
        console.log(`Post: ${commentable.title}`);
    } else if (commentable instanceof Video) {
        console.log(`Video: ${commentable.title} (${commentable.duration}s)`);
    } else if (commentable instanceof Article) {
        console.log(`Article: ${commentable.headline}`);
    }
}

// ❌ Bad - Type assertions without checks
function handleCommentable(commentable: Post | Video | Article) {
    const post = commentable as Post;
    console.log(post.title); // Might fail if it's actually a Video
}
```

### 6. Leverage Conditional Types

```typescript
// ✅ Good - Type-safe conditional queries
function getUsers<T extends boolean>(
    includePosts: T
): Promise<T extends true ? (User & { posts: Post[] })[] : User[]> {
    const query = User.query();

    if (includePosts) {
        return query.with('posts').get() as any;
    }

    return query.get() as any;
}

// Usage
const usersWithPosts = await getUsers(true);   // Type: (User & { posts: Post[] })[]
const usersWithoutPosts = await getUsers(false); // Type: User[]
```

This TypeScript integration guide should help you leverage the full power of type safety in your Eloquent ORM applications!