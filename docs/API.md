# API Reference

Complete API reference for Eloquent ORM methods and classes.

## Table of Contents

- [Eloquent Class](#eloquent-class)
- [QueryBuilder Class](#querybuilder-class)
- [Static Methods](#static-methods)
- [Instance Methods](#instance-methods)
- [Configuration](#configuration)

## Eloquent Class

### Static Properties

```typescript
class Model extends Eloquent {
	protected static table?: string; // Table name
	protected static hidden: string[]; // Hidden in JSON output
	protected static with: string[]; // Default eager loading
	static softDeletes?: boolean; // Enable soft delete support
	static morphClass?: string; // For polymorphic relations
	static schema?: z.ZodTypeAny; // Zod validation schema
	static connection: any; // Database connection
}
```

### Static Methods

#### `init(connection, morphs?)`

Initialize the ORM with a database connection.

```typescript
static async init(
    connection: any,
    morphs?: Record<string, typeof Eloquent>
): Promise<void>

// Usage
await Eloquent.init(mysqlConnection, {
    'App\\Models\\Post': Post,
    'App\\Models\\Video': Video
});
```

#### `query()`

Create a new query builder instance.

```typescript
static query<T extends typeof Eloquent>(this: T): QueryBuilder<T, never>

// Usage
const users = await User.query().get();
```

#### `raw(value)`

Create a raw SQL expression.

```typescript
static raw(value: string): string

// Usage
User.query().select(User.raw('COUNT(*) as total'))
```

## QueryBuilder Class

### Generic Type Parameters

```typescript
class QueryBuilder<
    M extends typeof Eloquent = typeof Eloquent,
    TWith extends string = never
>
```

- `M`: The model class type
- `TWith`: Union of loaded relation names for type safety

### Query Execution

#### `get()`

Execute the query and return all results.

```typescript
async get(): Promise<Array<WithRelations<InstanceType<M>, TWith>>>

// Usage
const users = await User.query().get();
const usersWithPosts = await User.query().with('posts').get();
```

#### `first()`

Execute the query and return the first result.

```typescript
async first(): Promise<WithRelations<InstanceType<M>, TWith> | null>

// Usage
const user = await User.query().first();
const userWithPosts = await User.query().with('posts').first();
```

#### `find(id)`

Find a model by its primary key.

```typescript
async find(id: any): Promise<WithRelations<InstanceType<M>, TWith> | null>

// Usage
const user = await User.query().find(1);
const userWithPosts = await User.query().with('posts').find(1);
```

#### `exists()`

Check if any records exist for the query.

```typescript
async exists(): Promise<boolean>

// Usage
const hasUsers = await User.query().where('active', true).exists();
```

### Aggregates

#### `count(column?)`

Get the count of records.

```typescript
async count(column = '*'): Promise<number>

// Usage
const userCount = await User.query().count();
const activeUserCount = await User.query().where('active', true).count();
```

#### `sum(column)`

Get the sum of a column.

```typescript
async sum(column: string): Promise<number>

// Usage
const totalPoints = await User.query().sum('points');
```

#### `avg(column)`

Get the average of a column.

```typescript
async avg(column: string): Promise<number>

// Usage
const averageAge = await User.query().avg('age');
```

#### `min(column)`

Get the minimum value of a column.

```typescript
async min(column: string): Promise<any>

// Usage
const youngestAge = await User.query().min('age');
```

#### `max(column)`

Get the maximum value of a column.

```typescript
async max(column: string): Promise<any>

// Usage
const oldestAge = await User.query().max('age');
```

### Where Clauses

#### `where(column, operator?, value?)`

Add a basic where clause.

```typescript
where(column: string, value: any): this
where(column: string, operator: string, value: any): this

// Usage
User.query().where('name', 'John')
User.query().where('age', '>', 18)
User.query().where('status', 'in', ['active', 'pending'])
```

#### `orWhere(column, operator?, value?)`

Add an OR where clause.

```typescript
orWhere(column: string, value: any): this
orWhere(column: string, operator: string, value: any): this

// Usage
User.query()
    .where('role', 'admin')
    .orWhere('role', 'moderator')
```

#### `whereIn(column, values)`

Add a where in clause.

```typescript
whereIn(column: string, values: any[]): this

// Usage
User.query().whereIn('status', ['active', 'pending'])
```

#### `whereNotIn(column, values)`

Add a where not in clause.

```typescript
whereNotIn(column: string, values: any[]): this

// Usage
User.query().whereNotIn('role', ['banned', 'suspended'])
```

#### `whereBetween(column, values)`

Add a where between clause.

```typescript
whereBetween(column: string, values: [any, any]): this

// Usage
User.query().whereBetween('age', [18, 65])
```

#### `whereNotBetween(column, values)`

Add a where not between clause.

```typescript
whereNotBetween(column: string, values: [any, any]): this

// Usage
User.query().whereNotBetween('score', [0, 50])
```

#### `whereNull(column)`

Add a where null clause.

```typescript
whereNull(column: string): this

// Usage
User.query().whereNull('deleted_at')
```

#### `whereNotNull(column)`

Add a where not null clause.

```typescript
whereNotNull(column: string): this

// Usage
User.query().whereNotNull('email_verified_at')
```

#### `whereRaw(sql, bindings?)`

Add a raw where clause.

```typescript
whereRaw(sql: string, bindings?: any[]): this

// Usage
User.query().whereRaw('YEAR(created_at) = ?', [2023])
```

### Ordering & Limiting

#### `orderBy(column, direction?)`

Add an order by clause.

```typescript
orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this

// Usage
User.query().orderBy('created_at', 'desc')
User.query().orderBy('name') // defaults to 'asc'
```

#### `inRandomOrder()`

Order results randomly.

```typescript
inRandomOrder(): this

// Usage
User.query().inRandomOrder().limit(5).get()
```

#### `limit(count)`

Limit the number of results.

```typescript
limit(count: number): this

// Usage
User.query().limit(10)
```

#### `offset(count)`

Offset the results.

```typescript
offset(count: number): this

// Usage
User.query().offset(20).limit(10) // pagination
```

### Grouping

#### `groupBy(...columns)`

Add group by clauses.

```typescript
groupBy(...columns: string[]): this

// Usage
User.query().groupBy('status')
User.query().groupBy('status', 'role')
```

#### `having(column, operator?, value?)`

Add a having clause.

```typescript
having(column: string, operator: string, value: any): this
having(callback: (query: QueryBuilder) => void): this

// Usage
User.query()
    .groupBy('status')
    .having('count(*)', '>', 5)
```

### Joins

#### `join(table, first, operator?, second?)`

Add an inner join.

```typescript
join(table: string, first: string, operator: string, second: string): this

// Usage
User.query().join('profiles', 'users.id', '=', 'profiles.user_id')
```

#### `leftJoin(table, first, operator?, second?)`

Add a left join.

```typescript
leftJoin(table: string, first: string, operator: string, second: string): this

// Usage
User.query().leftJoin('profiles', 'users.id', '=', 'profiles.user_id')
```

#### `rightJoin(table, first, operator?, second?)`

Add a right join.

```typescript
rightJoin(table: string, first: string, operator: string, second: string): this

// Usage
User.query().rightJoin('profiles', 'users.id', '=', 'profiles.user_id')
```

#### `crossJoin(table)`

Add a cross join.

```typescript
crossJoin(table: string): this

// Usage
User.query().crossJoin('settings')
```

### Selection

#### `select(...columns)`

Set the columns to select.

```typescript
select(...columns: string[]): this

// Usage
User.query().select('id', 'name', 'email')
User.query().select('users.*', 'profiles.bio')
```

#### `addSelect(...columns)`

Add columns to the existing selection.

```typescript
addSelect(...columns: string[]): this

// Usage
User.query()
    .select('id', 'name')
    .addSelect('email', 'created_at')
```

#### `distinct()`

Add a distinct clause.

```typescript
distinct(): this

// Usage
User.query().distinct().select('status')
```

### Eager Loading

#### `with(relations, callback?)`

Eager load relations.

```typescript
with<K extends string>(
    relations: K | K[] | Record<K, string[] | ((query: QueryBuilder<any>) => void)>,
    callback?: (query: QueryBuilder<any>) => void
): QueryBuilder<M, TWith | K>

// Usage
User.query().with('posts')
User.query().with(['posts', 'profile'])
User.query().with('posts:id,title,created_at')
User.query().with({
    posts: query => query.where('published', true)
})
```

#### `withWhereHas(relation, callback?)`

Eager load and constrain the main query.

```typescript
withWhereHas(relation: string, callback?: (query: QueryBuilder) => void): any

// Usage
User.query().withWhereHas('posts', query => {
    query.where('published', true);
})
```

#### `without(relations)`

Remove relations from eager loading.

```typescript
without(relations: string | string[]): this

// Usage
User.query().with(['posts', 'profile']).without('profile')
```

#### `withOnly(relations)`

Set specific relations for eager loading (clears existing).

```typescript
withOnly(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): any

// Usage
User.query().with(['posts', 'profile']).withOnly('posts')
```

### Relationship Queries

#### `has(relation, operator?, count?)`

Query based on relationship existence.

```typescript
has(relation: string, operator?: string, count?: number): this

// Usage
User.query().has('posts')
User.query().has('posts', '>', 5)
```

#### `doesntHave(relation)`

Query based on relationship non-existence.

```typescript
doesntHave(relation: string): this

// Usage
User.query().doesntHave('posts')
```

#### `whereHas(relation, callback?)`

Query with relationship constraints.

```typescript
whereHas(relation: string, callback?: (query: QueryBuilder) => void): this

// Usage
User.query().whereHas('posts', query => {
    query.where('published', true);
})
```

#### `whereDoesntHave(relation, callback?)`

Query with inverse relationship constraints.

```typescript
whereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this

// Usage
User.query().whereDoesntHave('posts', query => {
    query.where('published', false);
})
```

### Relationship Aggregates

#### `withCount(relations)`

Add relationship counts.

```typescript
withCount(relations: string | string[] | Record<string, (query: QueryBuilder<any>) => void>): this

// Usage
User.query().withCount('posts')
User.query().withCount(['posts', 'comments'])
User.query().withCount({
    posts: query => query.where('published', true)
})
```

#### `withSum(relation, column)`

Add relationship sum.

```typescript
withSum(relation: string, column: string): this

// Usage
User.query().withSum('posts', 'views')
```

#### `withAvg(relation, column)`

Add relationship average.

```typescript
withAvg(relation: string, column: string): this

// Usage
User.query().withAvg('posts', 'rating')
```

#### `withMin(relation, column)`

Add relationship minimum.

```typescript
withMin(relation: string, column: string): this

// Usage
User.query().withMin('posts', 'created_at')
```

#### `withMax(relation, column)`

Add relationship maximum.

```typescript
withMax(relation: string, column: string): this

// Usage
User.query().withMax('posts', 'updated_at')
```

### Soft Deletes

#### `withTrashed()`

Include soft deleted records.

```typescript
withTrashed(): this

// Usage
User.query().withTrashed().get()
```

#### `onlyTrashed()`

Only get soft deleted records.

```typescript
onlyTrashed(): this

// Usage
User.query().onlyTrashed().get()
```

#### `withoutTrashed()`

Exclude soft deleted records (default).

```typescript
withoutTrashed(): this

// Usage
User.query().withoutTrashed().get()
```

### One of Many

#### `latestOfMany(column?)`

Get the latest record based on a column.

```typescript
latestOfMany(column = 'created_at'): this

// Usage
User.query().latestOfMany()
User.query().latestOfMany('updated_at')
```

#### `oldestOfMany(column?)`

Get the oldest record based on a column.

```typescript
oldestOfMany(column = 'created_at'): this

// Usage
User.query().oldestOfMany()
User.query().oldestOfMany('created_at')
```

#### `ofMany(column, aggregate)`

Get one record based on min/max aggregate.

```typescript
ofMany(column: string, aggregate: 'min' | 'max'): this

// Usage
User.query().ofMany('views', 'max')  // Most viewed
User.query().ofMany('price', 'min')  // Cheapest
```

### Conditional Queries

#### `when(condition, callback, defaultCallback?)`

Conditionally apply query constraints.

```typescript
when(
    condition: any,
    callback: (query: this) => void,
    defaultCallback?: (query: this) => void
): this

// Usage
User.query().when(searchTerm, (query, term) => {
    query.where('name', 'like', `%${term}%`);
})

User.query().when(includeInactive,
    query => query.withTrashed(),
    query => query.where('active', true)
)
```

### Unions

#### `union(query, all?)`

Add a union clause.

```typescript
union(query: QueryBuilder, all = false): this

// Usage
const activeUsers = User.query().where('status', 'active');
const premiumUsers = User.query().where('plan', 'premium');
const combined = activeUsers.union(premiumUsers).get();
```

### Chunking

#### `chunk(size, callback)`

Process results in chunks.

```typescript
async chunk(size: number, callback: (items: any[]) => void): Promise<void>

// Usage
await User.query().chunk(1000, users => {
    users.forEach(user => {
        console.log(user.name);
    });
});
```

#### `chunkAsync(size, callback)`

Process results in chunks asynchronously.

```typescript
async chunkAsync(size: number, callback: (items: any[]) => Promise<void>): Promise<void>

// Usage
await User.query().chunkAsync(1000, async users => {
    await processUsers(users);
});
```

### Utility Methods

#### `clone()`

Clone the query builder.

```typescript
clone(): QueryBuilder<M, TWith>

// Usage
const baseQuery = User.query().where('active', true);
const adminQuery = baseQuery.clone().where('role', 'admin');
const userQuery = baseQuery.clone().where('role', 'user');
```

#### `toSql()`

Get the SQL representation of the query.

```typescript
toSql(): { sql: string; params: any[] }

// Usage
const { sql, params } = User.query().where('active', true).toSql();
console.log(sql);    // SELECT * FROM users WHERE active = ?
console.log(params); // [true]
```

## Instance Methods

### Relationships

#### `belongsTo<T>(related, foreignKey, ownerKey?)`

Define a belongs to relationship.

```typescript
belongsTo<T extends typeof Eloquent>(
    related: T,
    foreignKey: string,
    ownerKey = 'id'
): QueryBuilder<T, never>

// Usage
class Post extends Eloquent {
    user() {
        return this.belongsTo(User, 'user_id');
    }
}
```

#### `hasOne<T>(related, foreignKey, localKey?)`

Define a has one relationship.

```typescript
hasOne<T extends typeof Eloquent>(
    related: T,
    foreignKey: string,
    localKey = 'id'
): QueryBuilder<T, never>

// Usage
class User extends Eloquent {
    profile() {
        return this.hasOne(Profile, 'user_id');
    }
}
```

#### `hasMany<T>(related, foreignKey, localKey?)`

Define a has many relationship.

```typescript
hasMany<T extends typeof Eloquent>(
    related: T,
    foreignKey: string,
    localKey = 'id'
): QueryBuilder<T, never>

// Usage
class User extends Eloquent {
    posts() {
        return this.hasMany(Post, 'user_id');
    }
}
```

#### `belongsToMany<T>(related, table?, foreignPivotKey?, relatedPivotKey?, parentKey?, relatedKey?)`

Define a belongs to many relationship.

```typescript
belongsToMany<T extends typeof Eloquent>(
    related: T,
    table?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey = 'id',
    relatedKey = 'id'
): QueryBuilder<T, never>

// Usage
class User extends Eloquent {
    roles() {
        return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
    }
}
```

### Lazy Loading

#### `load(relations)`

Lazy load relations on the instance.

```typescript
async load(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<this>

// Usage
const user = await User.query().first();
await user.load('posts');
await user.load(['posts', 'profile']);
await user.load({
    posts: query => query.where('published', true)
});
```

#### `loadMissing(relations)`

Load relations that haven't been loaded yet.

```typescript
async loadMissing(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<this>

// Usage
const user = await User.query().with('posts').first();
await user.loadMissing('profile'); // Only loads profile, posts already loaded
```

### JSON Serialization

#### `toJSON()`

Convert the model to JSON, respecting hidden fields.

```typescript
toJSON(): any

// Usage
const user = await User.query().first();
const json = user.toJSON();
console.log(json); // Hidden fields are excluded
```

## Static Utility Methods

#### `load(instances, relations)`

Load relations on multiple instances.

```typescript
static async load(
    instances: Eloquent[],
    relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>
): Promise<void>

// Usage
const users = await User.query().get();
await User.load(users, 'posts');
```

#### `loadMissing(instances, relations)`

Load missing relations on multiple instances.

```typescript
static async loadMissing(
    instances: Eloquent[],
    relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>
): Promise<void>

// Usage
const users = await User.query().with('posts').get();
await User.loadMissing(users, 'profile');
```

## Explicit Relationship Typing

You can explicitly specify the shape of loaded relationships for better type safety:

```typescript
// Define exact relationship structure
const ordersWithFullRelations = await Order.query()
	.with(['business', 'business.owner', 'user', 'cart', 'cart.items', 'cart.items.product'])
	.limit(2)
	.get<{
		business: Business & {
			owner: User;
		};
		user: User;
		cart: Cart & {
			items: (CartItem & {
				product: Product;
			})[];
		};
	}>();
```

For instance methods, you can also specify explicit types:

```typescript
// Load relationships on existing instances
const order = await Order.find(1);
const loadedOrder = await order.load<Order & { user: User; cart: Cart }>('user', 'cart');

// Load missing relationships
const orderWithMore = await loadedOrder.loadMissing<
	Order & {
		user: User;
		cart: Cart;
		business: Business;
	}
>('business');

// Load all relationships at once
const fullyLoaded = await order.loadForAll<
	Order & {
		user: User;
		cart: Cart & { items: CartItem[] };
		business: Business;
	}
>(['user', 'cart.items', 'business']);
```

This works with all query methods: `get()`, `first()`, `firstOrFail()`, `find()`, `findOrFail()`, and instance methods: `load()`, `loadMissing()`, `loadForAll()`.

This API reference provides complete documentation for all available methods in the Eloquent ORM.
