# Relationships Guide

This guide covers all relationship types available in Eloquent ORM and how to use them effectively.

## Table of Contents

- [Basic Relationships](#basic-relationships)
- [Advanced Relationships](#advanced-relationships)
- [Polymorphic Relationships](#polymorphic-relationships)
- [Eager Loading](#eager-loading)
- [Relationship Queries](#relationship-queries)
- [TypeScript Integration](#typescript-integration)

## Basic Relationships

### One-to-One (hasOne)

A one-to-one relationship is a very basic relation. For example, a `User` model might have one `Profile`.

```typescript
class User extends Eloquent {
    relationsTypes!: {
        profile: Profile;
    };

    profile() {
        return this.hasOne(Profile, 'user_id');
    }
}

// Usage
const user = await User.query().with('profile').first();
console.log(user.profile.bio); // Profile is properly typed
```

### Inverse One-to-One (belongsTo)

The inverse of a `hasOne` relationship. For example, a `Profile` belongs to a `User`.

```typescript
class Profile extends Eloquent {
    relationsTypes!: {
        user: User;
    };

    user() {
        return this.belongsTo(User, 'user_id');
    }
}

// Usage
const profile = await Profile.query().with('user').first();
console.log(profile.user.name); // User is properly typed
```

### One-to-Many (hasMany)

A one-to-many relationship is used to define relationships where a single model owns any amount of other models. For example, a blog post may have an infinite number of comments.

```typescript
class Post extends Eloquent {
    relationsTypes!: {
        comments: Comment[];
    };

    comments() {
        return this.hasMany(Comment, 'post_id');
    }
}

// Usage
const post = await Post.query().with('comments').first();
console.log(post.comments.length); // Comment[] is properly typed
```

### Many-to-Many (belongsToMany)

Many-to-many relations are slightly more complicated than hasOne and hasMany relationships. For example, a user may have many roles, and those roles may also be shared by other users.

```typescript
class User extends Eloquent {
    relationsTypes!: {
        roles: Role[];
    };

    roles() {
        return this.belongsToMany(
            Role,
            'user_roles',      // pivot table
            'user_id',         // foreign key for this model
            'role_id'          // foreign key for related model
        );
    }
}

// Usage
const user = await User.query().with('roles').first();
console.log(user.roles.map(role => role.name)); // Role[] is properly typed
```

## Advanced Relationships

### One of Many

Sometimes you need to retrieve a single related record from a one-to-many relationship based on some criteria.

```typescript
class User extends Eloquent {
    relationsTypes!: {
        latestPost: Post;
        oldestPost: Post;
        mostPopularPost: Post;
    };

    // Get the latest post
    latestPost() {
        return this.hasOneOfMany(Post, 'user_id', 'created_at', 'max');
    }

    // Get the oldest post
    oldestPost() {
        return this.hasOneOfMany(Post, 'user_id', 'created_at', 'min');
    }

    // Get most popular post (by views)
    mostPopularPost() {
        return this.hasOneOfMany(Post, 'user_id', 'views', 'max');
    }
}

// Convenience methods
class User extends Eloquent {
    latestPost() {
        return this.latestOfMany(Post, 'user_id');
    }

    oldestPost() {
        return this.oldestOfMany(Post, 'user_id');
    }
}
```

### Has One Through

The "has-one-through" relationship links models through a single intermediate relation.

```typescript
class Country extends Eloquent {
    relationsTypes!: {
        capitalCity: City;
    };

    capitalCity() {
        return this.hasOneThrough(
            City,           // final model
            User,           // intermediate model
            'country_id',   // foreign key on intermediate model
            'city_id',      // foreign key on final model
            'id',           // local key on this model
            'id'            // local key on intermediate model
        );
    }
}
```

### Has Many Through

The "has-many-through" relationship provides a convenient shortcut for accessing distant relations via an intermediate relation.

```typescript
class Country extends Eloquent {
    relationsTypes!: {
        posts: Post[];
    };

    posts() {
        return this.hasManyThrough(
            Post,           // final model
            User,           // intermediate model
            'country_id',   // foreign key on intermediate model
            'user_id',      // foreign key on final model
            'id',           // local key on this model
            'id'            // local key on intermediate model
        );
    }
}

// Alternative using through() helper
class Country extends Eloquent {
    posts() {
        return this.through('users').has('posts');
    }
}
```

## Polymorphic Relationships

### One-to-Many Polymorphic

A one-to-many polymorphic relation is similar to a simple one-to-many relation; however, the target model can belong to more than one type of model on a single association.

```typescript
// Comments can belong to both Post and Video
class Comment extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        content: z.string(),
        commentable_type: z.string(),
        commentable_id: z.number().int(),
    });

    relationsTypes!: {
        commentable: Post | Video; // Union type for polymorphic relation
    };

    commentable() {
        return this.morphTo('commentable', 'commentable_type', 'commentable_id');
    }
}

class Post extends Eloquent {
    relationsTypes!: {
        comments: Comment[];
    };

    comments() {
        return this.morphMany(Comment, 'commentable', 'commentable_type', 'commentable_id');
    }
}

class Video extends Eloquent {
    relationsTypes!: {
        comments: Comment[];
    };

    comments() {
        return this.morphMany(Comment, 'commentable', 'commentable_type', 'commentable_id');
    }
}

// Usage
const post = await Post.query().with('comments').first();
post.comments.forEach(comment => {
    console.log(comment.content); // Comment is properly typed
});
```

### Many-to-Many Polymorphic

Many-to-many polymorphic relations are slightly more complicated than morphOne and morphMany relations. For example, a blog Post and Video model could share a polymorphic relation to a Tag model.

```typescript
class Tag extends Eloquent {
    // Tags can be attached to posts, videos, etc.
    posts() {
        return this.morphedByMany(Post, 'taggable', 'tags');
    }

    videos() {
        return this.morphedByMany(Video, 'taggable', 'tags');
    }
}

class Post extends Eloquent {
    relationsTypes!: {
        tags: Tag[];
    };

    tags() {
        return this.morphToMany(Tag, 'taggable', 'tags');
    }
}
```

## Eager Loading

### Basic Eager Loading

```typescript
// Load single relation
const users = await User.query().with('posts').get();

// Load multiple relations
const users = await User.query().with(['posts', 'profile']).get();

// Load nested relations
const users = await User.query().with('posts.comments').get();
```

### Constraining Eager Loads

```typescript
// Add constraints to eager loaded relations
const users = await User.query().with({
    posts: query => query.where('published', true).orderBy('created_at', 'desc')
}).get();

// Multiple constrained relations
const users = await User.query().with({
    posts: query => query.where('published', true),
    comments: query => query.where('approved', true)
}).get();
```

### Selecting Specific Columns

```typescript
// Select specific columns from relations
const users = await User.query()
    .with('posts:id,title,created_at')
    .get();

// Multiple relations with column selection
const users = await User.query()
    .with([
        'posts:id,title,created_at',
        'profile:id,bio,avatar'
    ])
    .get();
```

### Conditional Eager Loading

```typescript
// Load relation based on condition
const users = await User.query()
    .when(includePosts, query => query.with('posts'))
    .get();

// WithWhereHas - eager load and constrain the main query
const users = await User.query()
    .withWhereHas('posts', query => {
        query.where('published', true);
    })
    .get();
```

### Lazy Eager Loading

```typescript
// Load relations after the model has been retrieved
const users = await User.query().get();

// Load specific relations
await User.load(users, 'posts');
await User.load(users, ['posts', 'profile']);

// Load with constraints
await User.load(users, {
    posts: query => query.where('published', true)
});

// Load missing relations only
await User.loadMissing(users, 'posts');
```

## Relationship Queries

### Querying Relationship Existence

```typescript
// Get users that have posts
const users = await User.query().has('posts').get();

// Get users that have more than 3 posts
const users = await User.query().has('posts', '>', 3).get();

// Get users that don't have posts
const users = await User.query().doesntHave('posts').get();

// Multiple relationship checks
const users = await User.query()
    .has('posts')
    .has('profile')
    .get();
```

### Querying Relationship Existence with Constraints

```typescript
// Get users that have published posts
const users = await User.query()
    .whereHas('posts', query => {
        query.where('published', true);
    })
    .get();

// Get users that don't have unpublished posts
const users = await User.query()
    .whereDoesntHave('posts', query => {
        query.where('published', false);
    })
    .get();

// Complex relationship queries
const users = await User.query()
    .whereHas('posts', query => {
        query.where('published', true)
             .where('views', '>', 1000);
    })
    .get();
```

### Counting Related Models

```typescript
// Add relationship counts
const users = await User.query().withCount('posts').get();
console.log(users[0].posts_count); // number

// Multiple counts
const users = await User.query()
    .withCount(['posts', 'comments'])
    .get();

// Constrained counts
const users = await User.query()
    .withCount({
        posts: query => query.where('published', true)
    })
    .get();
```

### Relationship Aggregates

```typescript
// Sum related values
const users = await User.query()
    .withSum('posts', 'views')
    .get();
console.log(users[0].posts_sum_views); // number

// Average
const users = await User.query()
    .withAvg('posts', 'rating')
    .get();

// Min/Max
const users = await User.query()
    .withMin('posts', 'created_at')
    .withMax('posts', 'updated_at')
    .get();

// Multiple aggregates
const users = await User.query()
    .withCount('posts')
    .withSum('posts', 'views')
    .withAvg('posts', 'rating')
    .get();
```

## TypeScript Integration

### Defining Relation Types

```typescript
class User extends Eloquent {
    // Define all possible relations for type safety
    relationsTypes!: {
        posts: Post[];              // One-to-Many
        profile: Profile;           // One-to-One
        roles: Role[];              // Many-to-Many
        latestPost: Post;           // One of Many
        comments: Comment[];        // Polymorphic
    };
}
```

### Automatic Type Inference

```typescript
// Relations are automatically typed when eager loaded
const users = await User.query().with('posts').get();
// users[0].posts is typed as Post[]

const user = await User.query().with(['posts', 'profile']).first();
// user.posts is typed as Post[]
// user.profile is typed as Profile

// Relationship queries maintain proper types
const posts = await user.posts().where('published', true).get();
// posts is typed as Post[]

const profile = await user.profile().first();
// profile is typed as Profile | null
```

### Complex Relation Types

```typescript
class User extends Eloquent {
    relationsTypes!: {
        // Standard relations
        posts: Post[];
        profile: Profile;

        // Polymorphic relations
        notifications: (EmailNotification | SmsNotification)[];

        // Conditional relations
        publishedPosts: Post[];
        draftPosts: Post[];
    };

    publishedPosts() {
        return this.hasMany(Post, 'user_id').where('published', true);
    }

    draftPosts() {
        return this.hasMany(Post, 'user_id').where('published', false);
    }
}
```

## Best Practices

### 1. Always Define Relation Types

```typescript
// ✅ Good - Full type safety
class User extends Eloquent {
    relationsTypes!: {
        posts: Post[];
        profile: Profile;
    };
}

// ❌ Bad - No type safety for relations
class User extends Eloquent {
    // No relationsTypes defined
}
```

### 2. Use Descriptive Relation Names

```typescript
// ✅ Good
class User extends Eloquent {
    publishedPosts() {
        return this.hasMany(Post, 'user_id').where('published', true);
    }

    draftPosts() {
        return this.hasMany(Post, 'user_id').where('published', false);
    }
}

// ❌ Bad
class User extends Eloquent {
    posts1() {
        return this.hasMany(Post, 'user_id').where('published', true);
    }

    posts2() {
        return this.hasMany(Post, 'user_id').where('published', false);
    }
}
```

### 3. Optimize with Eager Loading

```typescript
// ✅ Good - Single query with eager loading
const users = await User.query()
    .with(['posts', 'profile'])
    .get();

// ❌ Bad - N+1 query problem
const users = await User.query().get();
for (const user of users) {
    const posts = await user.posts().get(); // N queries
    const profile = await user.profile().first(); // N queries
}
```

### 4. Use Relationship Constraints

```typescript
// ✅ Good - Efficient querying
const activeUsers = await User.query()
    .whereHas('posts', query => {
        query.where('published', true)
             .where('created_at', '>', '2023-01-01');
    })
    .withCount({
        posts: query => query.where('published', true)
    })
    .get();

// ❌ Bad - Loading unnecessary data
const users = await User.query().with('posts').get();
const activeUsers = users.filter(user =>
    user.posts.some(post => post.published && post.created_at > '2023-01-01')
);
```

This comprehensive relationships guide should help you understand and effectively use all relationship types in the Eloquent ORM!