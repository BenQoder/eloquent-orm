import { z } from 'zod';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Base Relation Class
 *
 * Abstract base class for all relationship types.
 * Provides chainable query building and execution methods.
 */

interface RelationshipConfig {
    type: string;
    model: typeof Eloquent | string;
    foreignKey?: string;
    localKey?: string;
    ownerKey?: string;
    morphName?: string;
    typeColumn?: string;
    idColumn?: string;
    table?: string;
    foreignPivotKey?: string;
    relatedPivotKey?: string;
    parentKey?: string;
    relatedKey?: string;
    column?: string;
    aggregate?: 'min' | 'max';
    through?: typeof Eloquent;
    firstKey?: string;
    secondKey?: string;
    secondLocalKey?: string;
}
declare abstract class Relation<TRelated extends Eloquent = Eloquent> {
    protected parent: Eloquent;
    protected related: typeof Eloquent;
    protected query: QueryBuilder<typeof Eloquent>;
    abstract readonly type: string;
    constructor(parent: Eloquent, related: typeof Eloquent);
    /**
     * Add the base constraints to the relation query
     * Subclasses implement this to add WHERE clauses specific to the relationship type
     */
    protected abstract addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    abstract getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship
     */
    abstract getResults(): Promise<TRelated | TRelated[] | null>;
    /**
     * Add a where clause to the query
     */
    where(column: string, operatorOrValue?: any, value?: any): this;
    /**
     * Add a where in clause to the query
     */
    whereIn(column: string, values: any[]): this;
    /**
     * Add a where not in clause to the query
     */
    whereNotIn(column: string, values: any[]): this;
    /**
     * Add a where null clause to the query
     */
    whereNull(column: string): this;
    /**
     * Add a where not null clause to the query
     */
    whereNotNull(column: string): this;
    /**
     * Add a raw where clause to the query
     */
    whereRaw(sql: string, bindings?: any[]): this;
    /**
     * Add an order by clause to the query
     */
    orderBy(column: string, direction?: 'asc' | 'desc'): this;
    /**
     * Limit the number of results
     */
    limit(count: number): this;
    /**
     * Skip a number of results
     */
    offset(count: number): this;
    /**
     * Select specific columns
     */
    select(...columns: string[]): this;
    /**
     * Execute the query and get all results
     */
    get(): Promise<Collection<TRelated>>;
    /**
     * Execute the query and get the first result
     */
    first(): Promise<TRelated | null>;
    /**
     * Get the count of related records
     */
    count(): Promise<number>;
    /**
     * Check if any related records exist
     */
    exists(): Promise<boolean>;
    /**
     * Get the underlying query builder
     */
    getQuery(): QueryBuilder<typeof Eloquent>;
    /**
     * Get the parent model instance
     */
    getParent(): Eloquent;
    /**
     * Get the related model class
     */
    getRelated(): typeof Eloquent;
}

/**
 * HasMany Relation Class
 *
 * Represents a one-to-many relationship where the parent has many related records.
 * Example: User hasMany Posts (posts table has user_id foreign key)
 */

declare class HasMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    readonly type = "hasMany";
    protected foreignKey: string;
    protected localKey: string;
    constructor(parent: Eloquent, related: typeof Eloquent, foreignKey: string, localKey?: string);
    /**
     * Add the base constraints - filter by parent's local key
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship
     */
    getResults(): Promise<TRelated[]>;
    /**
     * Get all results as a collection
     */
    get(): Promise<Collection<TRelated>>;
}

/**
 * HasOne Relation Class
 *
 * Represents a one-to-one relationship where the parent has one related record.
 * Example: User hasOne Profile (profiles table has user_id foreign key)
 */

declare class HasOne<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    readonly type = "hasOne";
    protected foreignKey: string;
    protected localKey: string;
    constructor(parent: Eloquent, related: typeof Eloquent, foreignKey: string, localKey?: string);
    /**
     * Add the base constraints - filter by parent's local key
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship (single record or null)
     */
    getResults(): Promise<TRelated | null>;
}

/**
 * BelongsTo Relation Class
 *
 * Represents an inverse one-to-one or one-to-many relationship.
 * Example: Post belongsTo User (posts table has user_id foreign key)
 */

declare class BelongsTo<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    readonly type = "belongsTo";
    protected foreignKey: string;
    protected ownerKey: string;
    constructor(parent: Eloquent, related: typeof Eloquent, foreignKey: string, ownerKey?: string);
    /**
     * Add the base constraints - filter by the foreign key value
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship (single record or null)
     */
    getResults(): Promise<TRelated | null>;
}

/**
 * BelongsToMany Relation Class
 *
 * Represents a many-to-many relationship through a pivot table.
 * Example: User belongsToMany Roles (through user_roles pivot table)
 */

declare class BelongsToMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    readonly type = "belongsToMany";
    protected pivotColumns: string[];
    protected table?: string;
    protected foreignPivotKey?: string;
    protected relatedPivotKey?: string;
    protected parentKey: string;
    protected relatedKey: string;
    constructor(parent: Eloquent, related: typeof Eloquent, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string);
    /**
     * Add the base constraints - join through pivot table
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship
     */
    getResults(): Promise<TRelated[]>;
    /**
     * Specify which pivot columns to include
     */
    withPivot(...columns: string[]): this;
    /**
     * Get the pivot table name
     */
    protected getPivotTable(): string;
    /**
     * Get the related model's table name
     */
    protected getRelatedTable(): string;
    /**
     * Get the foreign pivot key
     */
    protected getForeignPivotKey(): string;
    /**
     * Get the related pivot key
     */
    protected getRelatedPivotKey(): string;
}

/**
 * MorphMany Relation Class
 *
 * Represents a polymorphic one-to-many relationship.
 * Example: Post morphMany Comments (comments table has commentable_type and commentable_id)
 */

declare class MorphMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    protected morphName: string;
    protected localKey: string;
    readonly type = "morphMany";
    protected typeColumn: string;
    protected idColumn: string;
    constructor(parent: Eloquent, related: typeof Eloquent, morphName: string, typeColumn?: string, idColumn?: string, localKey?: string);
    /**
     * Add the base constraints - filter by morph type and id
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship
     */
    getResults(): Promise<TRelated[]>;
    /**
     * Get possible morph type values for the parent model
     */
    protected getMorphTypes(): string[];
}

/**
 * MorphOne Relation Class
 *
 * Represents a polymorphic one-to-one relationship.
 * Example: Post morphOne Image (images table has imageable_type and imageable_id)
 */

/**
 * Base class for morph-one type relationships
 */
declare abstract class MorphOneBase<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    protected morphName: string;
    protected localKey: string;
    protected typeColumn: string;
    protected idColumn: string;
    constructor(parent: Eloquent, related: typeof Eloquent, morphName: string, typeColumn?: string, idColumn?: string, localKey?: string);
    /**
     * Add the base constraints - filter by morph type and id
     */
    protected addConstraints(): void;
    /**
     * Get the related model's table name
     */
    protected getRelatedTable(): string;
    /**
     * Get possible morph type values for the parent model
     */
    protected getMorphTypes(): string[];
}
declare class MorphOne<TRelated extends Eloquent = Eloquent> extends MorphOneBase<TRelated> {
    readonly type = "morphOne";
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship (single record or null)
     */
    getResults(): Promise<TRelated | null>;
}

/**
 * MorphTo Relation Class
 *
 * Represents the inverse of a polymorphic relationship.
 * Example: Comment morphTo commentable (can be Post, Video, etc.)
 */

declare class MorphTo<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    protected morphName: string;
    readonly type = "morphTo";
    protected typeColumn: string;
    protected idColumn: string;
    constructor(parent: Eloquent, morphName: string, typeColumn?: string, idColumn?: string);
    /**
     * Add the base constraints - filter by the id value
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship (single record or null)
     */
    getResults(): Promise<TRelated | null>;
    /**
     * Resolve the related model class from a morph type string
     */
    protected static resolveRelatedModel(typeValue: string): typeof Eloquent | null;
}

/**
 * MorphOneOfMany Relation Class
 *
 * Represents a polymorphic one-of-many relationship with aggregation.
 * Used for latestMorphOne and oldestMorphOne patterns.
 * Example: Post latestMorphOne Status (get the most recent status)
 */

declare class MorphOneOfMany<TRelated extends Eloquent = Eloquent> extends MorphOneBase<TRelated> {
    protected column: string;
    protected aggregate: 'min' | 'max';
    readonly type = "morphOneOfMany";
    constructor(parent: Eloquent, related: typeof Eloquent, morphName: string, column?: string, aggregate?: 'min' | 'max', typeColumn?: string, idColumn?: string, localKey?: string);
    /**
     * Add the base constraints - filter by morph type/id and aggregate
     */
    protected addConstraints(): void;
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship (single record or null)
     */
    getResults(): Promise<TRelated | null>;
}

/**
 * HasManyThrough Relation Class
 *
 * Represents a has-many-through relationship.
 * Example: Country hasManyThrough Posts through Users
 * (countries -> users -> posts)
 */

/**
 * Base class for through relationships
 */
declare abstract class ThroughRelation<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    protected through: typeof Eloquent;
    protected firstKey?: string | undefined;
    protected secondKey?: string | undefined;
    protected localKey: string;
    protected secondLocalKey: string;
    constructor(parent: Eloquent, related: typeof Eloquent, through: typeof Eloquent, firstKey?: string | undefined, secondKey?: string | undefined, localKey?: string, secondLocalKey?: string);
    /**
     * Add the base constraints - join through intermediate table
     */
    protected addConstraints(): void;
    /**
     * Get the related model's table name
     */
    protected getRelatedTable(): string;
    /**
     * Get the through model's table name
     */
    protected getThroughTable(): string;
    /**
     * Get the first key (on the through table, pointing to parent)
     */
    protected getFirstKey(): string;
    /**
     * Get the second key (on the related table, pointing to through)
     */
    protected getSecondKey(): string;
}
declare class HasManyThrough<TRelated extends Eloquent = Eloquent> extends ThroughRelation<TRelated> {
    readonly type = "hasManyThrough";
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship
     */
    getResults(): Promise<TRelated[]>;
}
/**
 * HasOneThrough - returns single record through intermediate table
 */
declare class HasOneThrough<TRelated extends Eloquent = Eloquent> extends ThroughRelation<TRelated> {
    readonly type = "hasOneThrough";
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig(): RelationshipConfig;
    /**
     * Get the results of the relationship (single record or null)
     */
    getResults(): Promise<TRelated | null>;
}

/**
 * READ-ONLY ORM (Intentional Design)
 *
 * - This ORM is designed strictly for read operations.
 * - Mutating APIs (insert/update/delete, DDL, transactions, attach/detach/sync, save/create, etc.)
 *   must NOT be added. Raw SQL is restricted to SELECT statements only.
 * - A runtime guard rejects non-SELECT SQL (see ensureReadOnlySql/ensureReadOnlySnippet).
 * - In Workers, Hyperdrive-backed connections are created lazily per request scope.
 * - Connections are never stored globally and are released by the Worker request lifecycle.
 *
 * Contributor notes:
 * - If you add new raw-SQL entry points, call ensureReadOnlySql/ensureReadOnlySnippet.
 * - Keep the public surface read-only unless an explicit, opt-in write mode is introduced.
 * - Document any new APIs clearly as read-only.
 *
 * @readonly
 */

type RelationsOf<T> = T extends {
    relationsTypes: infer RT;
} ? RT : {};
type RelationData<M, K extends string> = {
    [P in K]-?: P extends keyof RelationsOf<M> ? NonNullable<RelationsOf<M>[P]> : any;
};
type WithRelations<M, K extends string> = M & RelationData<M, K>;
type StripColumns<S extends string> = S extends `${infer R}:${string}` ? R : S;
type BaseRelationName<S extends string> = StripColumns<S> extends `${infer R}.${string}` ? R : StripColumns<S>;
declare class QueryBuilder<M extends typeof Eloquent = typeof Eloquent, TWith extends string = never> {
    private model;
    private conditions;
    private tableName?;
    private selectColumns;
    private isDistinct;
    private joins;
    private unions;
    private limitValue?;
    private offsetValue?;
    private orderByClauses;
    private groupByColumns;
    private havingConditions;
    private withRelations?;
    private withCallbacks?;
    private withColumns?;
    private static readonly IN_CHUNK_SIZE;
    private trashedMode;
    private selectBindings;
    private pivotConfig?;
    private static readonly FORBIDDEN_SQL;
    private debugLog;
    constructor(model: M);
    private resolveTableName;
    private prefixTableWithDatabase;
    private prefixColumnWithDatabase;
    table(name: string): this;
    select(...columns: string[]): this;
    addSelect(...columns: string[]): this;
    distinct(): this;
    orderBy(column: string, direction?: 'asc' | 'desc'): this;
    orderByDesc(column: string): this;
    latest(column?: string): this;
    oldest(column?: string): this;
    inRandomOrder(): this;
    groupBy(...columns: string[]): this;
    having(column: string, operator: string, value: any): this;
    having(callback: (query: QueryBuilder<any>) => void): this;
    limit(value: number): this;
    offset(value: number): this;
    tap(callback: (query: this) => void): this;
    each(callback: (item: any) => Promise<void> | void): Promise<void>;
    join(table: string, first: string, operator: string, second: string): this;
    leftJoin(table: string, first: string, operator: string, second: string): this;
    rightJoin(table: string, first: string, operator: string, second: string): this;
    crossJoin(table: string): this;
    union(query: QueryBuilder): this;
    unionAll(query: QueryBuilder): this;
    count(column?: string): Promise<number>;
    max(column: string): Promise<number>;
    min(column: string): Promise<number>;
    avg(column: string): Promise<number>;
    sum(column: string): Promise<number>;
    exists(): Promise<boolean>;
    doesntExist(): Promise<boolean>;
    pluck(column: string, key?: string): Promise<any>;
    value(column: string): Promise<any>;
    find<TExplicit = WithRelations<InstanceType<M>, TWith>>(id: any): Promise<TExplicit | null>;
    find<TExplicit>(id: any): Promise<TExplicit | null>;
    findOrFail<TExplicit = WithRelations<InstanceType<M>, TWith>>(id: any): Promise<TExplicit>;
    findOrFail<TExplicit>(id: any): Promise<TExplicit>;
    findOr<TExplicit = WithRelations<InstanceType<M>, TWith>, TDefault = TExplicit>(id: any, defaultValue: TDefault | (() => TDefault)): Promise<TExplicit | TDefault>;
    private aggregate;
    where(column: string, value: any): this;
    where(column: string, operator: string, value: any): this;
    where(callback: (query: QueryBuilder<any>) => void): this;
    orWhere(column: string, value: any): this;
    orWhere(column: string, operator: string, value: any): this;
    orWhere(callback: (query: QueryBuilder<any>) => void): this;
    whereIn(column: string, values: any[]): this;
    whereNotIn(column: string, values: any[]): this;
    orWhereIn(column: string, values: any[]): this;
    orWhereNotIn(column: string, values: any[]): this;
    whereNull(column: string): this;
    whereNotNull(column: string): this;
    orWhereNull(column: string): this;
    orWhereNotNull(column: string): this;
    whereBetween(column: string, values: [any, any]): this;
    whereNotBetween(column: string, values: [any, any]): this;
    orWhereBetween(column: string, values: [any, any]): this;
    orWhereNotBetween(column: string, values: [any, any]): this;
    whereDate(column: string, operatorOrValue: string, value?: string): this;
    whereMonth(column: string, operatorOrValue: string | number, value?: string | number): this;
    whereYear(column: string, operatorOrValue: string | number, value?: string | number): this;
    whereDay(column: string, operatorOrValue: string | number, value?: string | number): this;
    whereTime(column: string, operatorOrValue: string, value?: string): this;
    whereNot(columnOrCallback: string | ((query: this) => void), operatorOrValue?: any, value?: any): this;
    private negateOperator;
    whereAny(columns: string[], operator: string, value: any): this;
    whereAll(columns: string[], operator: string, value: any): this;
    whereLike(column: string, value: string): this;
    whereNotLike(column: string, value: string): this;
    whereIntegerInRaw(column: string, values: number[]): this;
    whereIntegerNotInRaw(column: string, values: number[]): this;
    reorder(column?: string, direction?: 'asc' | 'desc'): this;
    selectRaw(sql: string, bindings?: any[]): this;
    whereRaw(sql: string, bindings?: any[]): this;
    orWhereRaw(sql: string, bindings?: any[]): this;
    when(condition: any, callback: (query: this) => void, defaultCallback?: (query: this) => void): this;
    unless(condition: any, callback: (query: this) => void, defaultCallback?: (query: this) => void): this;
    whereHas(relation: string, callback?: (query: QueryBuilder) => void, operator?: string, count?: number): this;
    orWhereHas(relation: string, callback?: (query: QueryBuilder) => void, operator?: string, count?: number): this;
    doesntHave(relation: string, callback?: (query: QueryBuilder) => void): this;
    whereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this;
    orDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this;
    orWhereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this;
    whereBelongsTo(model: any | any[], relation?: string): this;
    private getBelongsToForeignKey;
    whereRelation(relation: string, callback?: (query: QueryBuilder) => void): this;
    orWhereRelation(relation: string, callback?: (query: QueryBuilder) => void): this;
    whereHasMorph(relation: string, types: string | typeof Eloquent | (string | typeof Eloquent)[], callback?: (query: QueryBuilder) => void): this;
    orWhereHasMorph(relation: string, types: string | typeof Eloquent | (string | typeof Eloquent)[], callback?: (query: QueryBuilder) => void): this;
    whereMorphedTo(relation: string, model: any): this;
    has(relation: string, operator?: string, count?: number): this;
    orHas(relation: string, operator?: string, count?: number): this;
    withCount(relations: string | string[] | Record<string, (query: QueryBuilder) => void>): this;
    private buildCountSubquery;
    private buildHasSubquery;
    private buildHasMorphSubquery;
    with<K extends string>(relations: K | K[] | Record<K, string[] | ((query: QueryBuilder<any>) => void)>, callback?: (query: QueryBuilder<any>) => void): QueryBuilder<M, TWith | K>;
    private parseRelationWithColumns;
    withWhereHas(relation: string, callback?: (query: QueryBuilder) => void): any;
    without(relations: string | string[]): this;
    withOnly(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): any;
    withTrashed(): this;
    onlyTrashed(): this;
    withoutTrashed(): this;
    latestOfMany(column?: string): this;
    oldestOfMany(column?: string): this;
    ofMany(column: string, aggregate: 'min' | 'max'): this;
    clone(): QueryBuilder<M, TWith>;
    private chunkArray;
    private getInBatches;
    private setPivotSource;
    as(alias: string): this;
    withPivot(...columns: string[]): this;
    scope(name: string, ...args: any[]): this;
    private applyCast;
    loadRelations(instances: any[], relations: string[], model?: typeof Eloquent, prefix?: string): Promise<void>;
    private loadSingleRelation;
    chunk(size: number, callback: (results: any[]) => Promise<void> | void): Promise<void>;
    private buildWhereClause;
    first<TExplicit = WithRelations<InstanceType<M>, TWith>>(): Promise<TExplicit | null>;
    first<TExplicit>(): Promise<TExplicit | null>;
    firstOrFail<TExplicit = WithRelations<InstanceType<M>, TWith>>(): Promise<TExplicit>;
    firstOrFail<TExplicit>(): Promise<TExplicit>;
    firstOr<TExplicit = WithRelations<InstanceType<M>, TWith>, TDefault = TExplicit>(defaultValue: TDefault | (() => TDefault)): Promise<TExplicit | TDefault>;
    toSql(): string;
    toRawSql(): string;
    dump(): this;
    dd(): never;
    whereColumn(first: string, operatorOrSecond: string, second?: string): this;
    orWhereColumn(first: string, operatorOrSecond: string, second?: string): this;
    get<TExplicit extends InstanceType<M> & Record<string, any> = WithRelations<InstanceType<M>, TWith>>(): Promise<Collection<TExplicit>>;
    get<TExplicit extends InstanceType<M> & Record<string, any>>(): Promise<Collection<TExplicit>>;
    /**
     * Execute aggregate function against Sushi (in-memory array) data
     */
    private aggregateSushi;
    /**
     * Execute query against Sushi (in-memory array) data
     * Supports: where, whereIn, whereNull, orderBy, limit, offset
     */
    private getSushi;
    /**
     * Apply conditions to Sushi rows (in-memory filtering)
     */
    private applySushiConditions;
    /**
     * Evaluate a single condition against a Sushi row
     */
    private evaluateSushiCondition;
    /**
     * Apply orderBy to Sushi rows (in-memory sorting)
     */
    private applySushiOrderBy;
    private buildSelectSql;
    private ensureReadOnlySnippet;
    private ensureReadOnlySql;
    private createProxiedInstance;
    private shouldAutoLoad;
    private autoLoadRelation;
}
declare class Collection<T extends Eloquent> extends Array<T> {
    private relationshipAutoloadingEnabled;
    withRelationshipAutoloading(): this;
    isRelationshipAutoloadingEnabled(): boolean;
}
interface LoadBatchItem {
    instances: Eloquent[];
    relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>;
}
type HyperdriveBinding = {
    connectionString: string;
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number | string;
};
type EloquentOptions = {
    connectTimeout?: number;
    prefixTablesWithDatabase?: boolean;
};
type ResolvedEloquentOptions = {
    connectTimeout: number;
    prefixTablesWithDatabase: boolean;
};
interface HyperdriveRequestConfig {
    binding: HyperdriveBinding;
    connectTimeout: number;
    database?: string;
}
type HonoLikeContext = Record<PropertyKey, any>;
interface EloquentRequestContext {
    connection: any | null;
    connectionInitialization: Promise<any> | null;
    hyperdrive: HyperdriveRequestConfig | null;
    options: ResolvedEloquentOptions;
    morphMap: Record<string, typeof Eloquent>;
    loadBatch: LoadBatchItem[];
    loadingPromises: Map<string, Promise<void>>;
    collectionsRegistry: Map<string, Eloquent[]>;
    batchFlushScheduled: boolean;
    automaticallyEagerLoadRelationshipsEnabled: boolean;
    released: boolean;
}
declare class ThroughBuilder {
    private instance;
    private throughRelation;
    constructor(instance: Eloquent, throughRelation: string);
    has(finalRelation: string): HasOneThrough<any> | HasManyThrough<any>;
}
declare class Eloquent {
    [key: string]: any;
    protected static table?: string;
    protected static hidden: string[];
    protected static appends: string[];
    protected static with: string[];
    private static options;
    static connectionStorage: AsyncLocalStorage<EloquentRequestContext>;
    private static connectionFactory;
    private static registeredMorphMap;
    private static readonly requestContextSymbol;
    private static resolveOptions;
    private static getActiveOptions;
    private static resolveBindingDatabase;
    private static getActiveDatabaseName;
    private static shouldPrefixTableWithDatabase;
    static prefixTableWithDatabase(table: string): string;
    static prefixColumnWithDatabase(column: string, allowedTables?: Set<string>): string;
    static resolveTableName(model: typeof Eloquent, tableOverride?: string): string;
    static setOptions(options: EloquentOptions): void;
    static getOptions(): ResolvedEloquentOptions;
    private static createRequestContext;
    private static getContext;
    private static requireContext;
    private static getMorphMap;
    private static runWithRequestContext;
    private static attachRequestContext;
    private static detachRequestContext;
    private static releaseRequestContext;
    private static buildMysqlConnectionOptions;
    /**
     * Get the active database connection.
     * Workers-only: create the request-scoped Hyperdrive connection lazily on first use.
     */
    private static resolveConnection;
    /**
     * Manual connections are not supported in the Workers-only runtime.
     */
    static withConnection<T>(connection: any, callback: () => Promise<T>, options?: {
        morphs?: Record<string, typeof Eloquent>;
        automaticallyEagerLoadRelationshipsEnabled?: boolean;
    }): Promise<T>;
    /**
     * Run a callback in a Workers-native Hyperdrive request scope.
     *
     * The mysql2 client is created lazily on the first actual query inside the callback,
     * reused for the rest of that request scope, and then released naturally with the
     * Worker request lifecycle. We intentionally do not call connection.end().
     *
     * Usage:
     *   const result = await Eloquent.hyperdrive(env.BACKEND_DB, MODEL_MAPPINGS, async () => {
     *     return await handler.execute(...);
     *   });
     */
    static hyperdrive<T>(binding: HyperdriveBinding, morphs: Record<string, typeof Eloquent> | undefined, callback: () => Promise<T>, options?: EloquentOptions): Promise<T>;
    /**
     * Hono middleware that registers a request-scoped Hyperdrive context for downstream ORM queries.
     * The request-scoped mysql2 connection is destroyed when the downstream middleware/handler finishes.
     */
    static honoMiddleware<TContext extends HonoLikeContext>(resolveBinding: (context: TContext) => HyperdriveBinding, morphs?: Record<string, typeof Eloquent>, options?: EloquentOptions): (context: TContext, next: () => Promise<unknown>) => Promise<void>;
    protected static rows?: Record<string, any>[];
    /**
     * Check if this model uses Sushi (in-memory array data)
     * Override this method to return true for API-based Sushi models
     */
    static usesSushi(): boolean;
    /**
     * Get the Sushi rows for this model (async - can fetch from API)
     * Override this method to fetch data from an API or other async source
     */
    static getRows(): Promise<Record<string, any>[]>;
    static debugEnabled: boolean;
    static debugLogger: (message: string, data?: any) => void;
    static automaticallyEagerLoadRelationships(): void;
    static isAutomaticallyEagerLoadRelationshipsEnabled(): boolean;
    static enableDebug(logger?: (message: string, data?: any) => void): void;
    static disableDebug(): void;
    static raw(value: string): string;
    private static getLoadBatch;
    private static getLoadingPromises;
    private static getLoadingCacheKey;
    private static getCollectionsRegistry;
    private static generateCollectionId;
    private static addToLoadBatch;
    private static scheduleBatchFlush;
    private static flushLoadBatch;
    static flushLoadForAllBatch(): Promise<void>;
    static clearLoadForAllBatch(): void;
    static init(connection: any, morphs?: Record<string, typeof Eloquent>): Promise<void>;
    static useConnection(connection: any, morphs?: Record<string, typeof Eloquent>): void;
    static getRelationConfig(model: typeof Eloquent, relationName: string): any | null;
    static describeRelation(model: typeof Eloquent, relationName: string): any | null;
    belongsTo<T extends typeof Eloquent>(related: T, foreignKey: string, ownerKey?: string): BelongsTo<InstanceType<T>>;
    belongsTo(related: string, foreignKey: string, ownerKey?: string): BelongsTo<Eloquent>;
    hasMany<T extends typeof Eloquent>(related: T, foreignKey: string, localKey?: string): HasMany<InstanceType<T>>;
    hasMany(related: string, foreignKey: string, localKey?: string): HasMany<Eloquent>;
    hasOne<T extends typeof Eloquent>(related: T, foreignKey: string, localKey?: string): HasOne<InstanceType<T>>;
    hasOne(related: string, foreignKey: string, localKey?: string): HasOne<Eloquent>;
    hasOneOfMany<T extends typeof Eloquent>(related: T, foreignKey: string, column?: string, aggregate?: 'min' | 'max', localKey?: string): QueryBuilder<T, never>;
    hasOneOfMany(related: string, foreignKey: string, column?: string, aggregate?: 'min' | 'max', localKey?: string): QueryBuilder<any, never>;
    latestOfMany(related: typeof Eloquent | string, foreignKey: string, column?: string, localKey?: string): QueryBuilder<any, never>;
    oldestOfMany(related: typeof Eloquent | string, foreignKey: string, column?: string, localKey?: string): QueryBuilder<any, never>;
    morphOne<T extends typeof Eloquent>(related: T, name: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOne<InstanceType<T>>;
    morphOne(related: string, name: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOne<Eloquent>;
    morphOneOfMany<T extends typeof Eloquent>(related: T, name: string, column?: string, aggregate?: 'min' | 'max', typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<InstanceType<T>>;
    morphOneOfMany(related: string, name: string, column?: string, aggregate?: 'min' | 'max', typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<Eloquent>;
    latestMorphOne<T extends typeof Eloquent>(related: T, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<InstanceType<T>>;
    latestMorphOne(related: string, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<Eloquent>;
    oldestMorphOne<T extends typeof Eloquent>(related: T, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<InstanceType<T>>;
    oldestMorphOne(related: string, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<Eloquent>;
    morphMany<T extends typeof Eloquent>(related: T, name: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphMany<InstanceType<T>>;
    morphMany(related: string, name: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphMany<Eloquent>;
    morphTo<T extends typeof Eloquent>(name: string, typeColumn?: string, idColumn?: string): MorphTo<InstanceType<T>>;
    static registerMorphMap(map: Record<string, typeof Eloquent>): void;
    static getMorphTypeForModel(model: typeof Eloquent): string;
    static getModelForMorphType(type: string): typeof Eloquent | null;
    static getPossibleMorphTypesForModel(model: typeof Eloquent): string[];
    hasOneThrough<T extends typeof Eloquent>(related: T, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): HasOneThrough<InstanceType<T>>;
    hasOneThrough(related: string, through: string, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): HasOneThrough<Eloquent>;
    hasManyThrough<T extends typeof Eloquent>(related: T, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): HasManyThrough<InstanceType<T>>;
    hasManyThrough(related: string, through: string, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): HasManyThrough<Eloquent>;
    belongsToMany<T extends typeof Eloquent>(related: T, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): BelongsToMany<InstanceType<T>>;
    belongsToMany(related: string, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): BelongsToMany<Eloquent>;
    static getProperty(key: string): any;
    through(relationship: string): ThroughBuilder;
    static query<T extends typeof Eloquent>(this: T): QueryBuilder<T, never>;
    static schema?: z.ZodTypeAny;
    toJSON(): any;
    load<TExplicit = this>(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<TExplicit>;
    load<TExplicit>(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<TExplicit>;
    loadMissing<TExplicit = this>(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<TExplicit>;
    loadMissing<TExplicit>(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<TExplicit>;
    loadCount(relations: string | string[] | Record<string, (query: QueryBuilder) => void>): Promise<this>;
    loadForAll<TExplicit = this>(relations: string): Promise<TExplicit>;
    loadForAll<TExplicit = this>(relations: readonly string[]): Promise<TExplicit>;
    loadForAll<TExplicit = this>(relations: string[]): Promise<TExplicit>;
    loadForAll<TExplicit = this>(relations: Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<TExplicit>;
    loadForAll<TExplicit = this>(...relations: string[]): Promise<TExplicit>;
    loadForAll<K extends readonly string[]>(this: this, ...relations: K): Promise<this & {
        [P in BaseRelationName<K[number]> & keyof RelationsOf<this>]-?: NonNullable<RelationsOf<this>[P]>;
    }>;
    loadForAll<K extends string>(this: this, relations: K): Promise<this & (BaseRelationName<K> extends keyof RelationsOf<this> ? {
        [P in BaseRelationName<K>]-?: NonNullable<RelationsOf<this>[P]>;
    } : {})>;
    loadForAll<K extends readonly string[]>(this: this, relations: K): Promise<this & {
        [P in BaseRelationName<K[number]> & keyof RelationsOf<this>]-?: NonNullable<RelationsOf<this>[P]>;
    }>;
    loadForAll<K extends string[]>(this: this, relations: K): Promise<this & {
        [P in BaseRelationName<K[number]> & keyof RelationsOf<this>]-?: NonNullable<RelationsOf<this>[P]>;
    }>;
    loadForAll<R extends Record<string, string[] | ((query: QueryBuilder<any>) => void)>>(this: this, relations: R): Promise<this & {
        [P in BaseRelationName<keyof R & string> & keyof RelationsOf<this>]-?: NonNullable<RelationsOf<this>[P]>;
    }>;
    static load(instances: Eloquent[], relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<void>;
    static loadMissing(instances: Eloquent[], relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<void>;
    static loadCount(instances: Eloquent[], relations: string | string[] | Record<string, (query: QueryBuilder) => void>): Promise<void>;
    private static parseRelationNames;
    private static parseFullRelationNames;
}

export { BelongsTo, BelongsToMany, Eloquent, HasMany, HasManyThrough, HasOne, HasOneThrough, MorphMany, MorphOne, MorphOneOfMany, MorphTo, Relation, type RelationshipConfig, Eloquent as default };
