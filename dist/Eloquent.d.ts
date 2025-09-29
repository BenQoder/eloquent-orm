/**
 * READ-ONLY ORM (Intentional Design)
 *
 * - This ORM is designed strictly for read operations.
 * - Mutating APIs (insert/update/delete, DDL, transactions, attach/detach/sync, save/create, etc.)
 *   must NOT be added. Raw SQL is restricted to SELECT statements only.
 * - A runtime guard rejects non-SELECT SQL (see ensureReadOnlySql/ensureReadOnlySnippet).
 * - Initialization requires a pre-created connection; this library will not open new connections.
 *
 * Contributor notes:
 * - If you add new raw-SQL entry points, call ensureReadOnlySql/ensureReadOnlySnippet.
 * - Keep the public surface read-only unless an explicit, opt-in write mode is introduced.
 * - Document any new APIs clearly as read-only.
 *
 * @readonly
 */
import type { z } from 'zod';
type RelationsOf<T> = T extends {
    relationsTypes: infer RT;
} ? RT : {};
type RelationData<M, K extends string> = {
    [P in K]: P extends keyof RelationsOf<M> ? RelationsOf<M>[P] : any;
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
    selectRaw(sql: string, bindings?: any[]): this;
    whereRaw(sql: string, bindings?: any[]): this;
    orWhereRaw(sql: string, bindings?: any[]): this;
    when(condition: any, callback: (query: this) => void, defaultCallback?: (query: this) => void): this;
    whereHas(relation: string, callback?: (query: QueryBuilder) => void): this;
    orWhereHas(relation: string, callback?: (query: QueryBuilder) => void): this;
    doesntHave(relation: string, callback?: (query: QueryBuilder) => void): this;
    whereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this;
    whereBelongsTo(model: any | any[], relation?: string): this;
    private getBelongsToForeignKey;
    whereRelation(relation: string, callback?: (query: QueryBuilder) => void): this;
    orWhereRelation(relation: string, callback?: (query: QueryBuilder) => void): this;
    whereHasMorph(relation: string, modelType: string | typeof Eloquent, callback?: (query: QueryBuilder) => void): this;
    whereMorphedTo(relation: string, model: any): this;
    has(relation: string): this;
    withCount(relations: string | string[] | Record<string, (query: QueryBuilder) => void>): this;
    private buildCountSubquery;
    private buildHasSubquery;
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
    get<TExplicit extends InstanceType<M> & Record<string, any> = WithRelations<InstanceType<M>, TWith>>(): Promise<Collection<TExplicit>>;
    get<TExplicit extends InstanceType<M> & Record<string, any>>(): Promise<Collection<TExplicit>>;
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
declare class ThroughBuilder {
    private instance;
    private throughRelation;
    constructor(instance: Eloquent, throughRelation: string);
    has(finalRelation: string): QueryBuilder<any, never>;
}
declare class Eloquent {
    [key: string]: any;
    protected static table?: string;
    protected static hidden: string[];
    protected static with: string[];
    static connection: any;
    private static morphMap;
    static automaticallyEagerLoadRelationshipsEnabled: boolean;
    static debugEnabled: boolean;
    static debugLogger: (message: string, data?: any) => void;
    static automaticallyEagerLoadRelationships(): void;
    static isAutomaticallyEagerLoadRelationshipsEnabled(): boolean;
    static enableDebug(logger?: (message: string, data?: any) => void): void;
    static disableDebug(): void;
    static raw(value: string): string;
    private static getLoadBatch;
    private static getLoadedRelationsRegistry;
    private static markRelationsAsLoaded;
    private static areRelationsLoaded;
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
    belongsTo<T extends typeof Eloquent>(related: T, foreignKey: string, ownerKey?: string): QueryBuilder<T, never>;
    belongsTo(related: string, foreignKey: string, ownerKey?: string): QueryBuilder<any, never>;
    hasMany<T extends typeof Eloquent>(related: T, foreignKey: string, localKey?: string): QueryBuilder<T, never>;
    hasMany(related: string, foreignKey: string, localKey?: string): QueryBuilder<any, never>;
    hasOne<T extends typeof Eloquent>(related: T, foreignKey: string, localKey?: string): QueryBuilder<T, never>;
    hasOne(related: string, foreignKey: string, localKey?: string): QueryBuilder<any, never>;
    hasOneOfMany<T extends typeof Eloquent>(related: T, foreignKey: string, column?: string, aggregate?: 'min' | 'max', localKey?: string): QueryBuilder<T, never>;
    hasOneOfMany(related: string, foreignKey: string, column?: string, aggregate?: 'min' | 'max', localKey?: string): QueryBuilder<any, never>;
    latestOfMany(related: typeof Eloquent | string, foreignKey: string, column?: string, localKey?: string): QueryBuilder<any, never>;
    oldestOfMany(related: typeof Eloquent | string, foreignKey: string, column?: string, localKey?: string): QueryBuilder<any, never>;
    morphOne<T extends typeof Eloquent>(related: T, name: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<T, never>;
    morphOne(related: string, name: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<any, never>;
    morphOneOfMany(related: typeof Eloquent | string, name: string, column?: string, aggregate?: 'min' | 'max', typeColumn?: string, idColumn?: string, localKey?: string): any;
    latestMorphOne(related: typeof Eloquent | string, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): any;
    oldestMorphOne(related: typeof Eloquent | string, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): any;
    morphMany<T extends typeof Eloquent>(related: T, name: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<T, never>;
    morphMany(related: string, name: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<any, never>;
    morphTo<T extends typeof Eloquent>(name: string, typeColumn?: string, idColumn?: string): QueryBuilder<T, never>;
    static registerMorphMap(map: Record<string, typeof Eloquent>): void;
    static getMorphTypeForModel(model: typeof Eloquent): string;
    static getModelForMorphType(type: string): typeof Eloquent | null;
    static getPossibleMorphTypesForModel(model: typeof Eloquent): string[];
    hasOneThrough<T extends typeof Eloquent>(related: T, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): QueryBuilder<T, never>;
    hasManyThrough<T extends typeof Eloquent>(related: T, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): QueryBuilder<T, never>;
    hasManyThrough(related: string, through: string, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): QueryBuilder<any, never>;
    belongsToMany<T extends typeof Eloquent>(related: T, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): QueryBuilder<T, never>;
    belongsToMany(related: string, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): QueryBuilder<any, never>;
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
    loadForAll<K extends readonly string[]>(this: this, ...relations: K): Promise<Omit<this, BaseRelationName<K[number]>> & {
        [P in BaseRelationName<K[number]> & keyof RelationsOf<this>]: RelationsOf<this>[P];
    }>;
    loadForAll<K extends string>(this: this, relations: K): Promise<Omit<this, BaseRelationName<K>> & (BaseRelationName<K> extends keyof RelationsOf<this> ? {
        [P in BaseRelationName<K>]: RelationsOf<this>[P];
    } : {})>;
    loadForAll<K extends readonly string[]>(this: this, relations: K): Promise<Omit<this, BaseRelationName<K[number]>> & {
        [P in BaseRelationName<K[number]> & keyof RelationsOf<this>]: RelationsOf<this>[P];
    }>;
    loadForAll<K extends string[]>(this: this, relations: K): Promise<Omit<this, BaseRelationName<K[number]>> & {
        [P in BaseRelationName<K[number]> & keyof RelationsOf<this>]: RelationsOf<this>[P];
    }>;
    loadForAll<R extends Record<string, string[] | ((query: QueryBuilder<any>) => void)>>(this: this, relations: R): Promise<Omit<this, BaseRelationName<keyof R & string>> & {
        [P in BaseRelationName<keyof R & string> & keyof RelationsOf<this>]: RelationsOf<this>[P];
    }>;
    static load(instances: Eloquent[], relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<void>;
    static loadMissing(instances: Eloquent[], relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<void>;
    static loadCount(instances: Eloquent[], relations: string | string[] | Record<string, (query: QueryBuilder) => void>): Promise<void>;
    private static parseRelationNames;
    private static parseFullRelationNames;
}
export default Eloquent;
//# sourceMappingURL=Eloquent.d.ts.map