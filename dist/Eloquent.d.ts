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
type InferModel<M extends typeof Eloquent> = M extends {
    schema: infer S;
} ? S extends z.ZodTypeAny ? z.infer<S> : unknown : unknown;
declare class QueryBuilder<M extends typeof Eloquent = typeof Eloquent> {
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
    private static readonly IN_CHUNK_SIZE;
    private trashedMode;
    private selectBindings;
    private pivotConfig?;
    private static readonly FORBIDDEN_SQL;
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
    find(id: any): Promise<any>;
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
    when(condition: any, callback: (query: QueryBuilder<any>) => void, defaultCallback?: (query: QueryBuilder<any>) => void): this;
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
    with(relations: string | string[] | Record<string, (query: QueryBuilder<any>) => void>, callback?: (query: QueryBuilder<any>) => void): this;
    withTrashed(): this;
    onlyTrashed(): this;
    withoutTrashed(): this;
    latestOfMany(column?: string): this;
    oldestOfMany(column?: string): this;
    ofMany(column: string, aggregate: 'min' | 'max'): this;
    clone(): QueryBuilder<M>;
    private chunkArray;
    private getInBatches;
    private setPivotSource;
    as(alias: string): this;
    withPivot(...columns: string[]): this;
    private loadRelations;
    private loadSingleRelation;
    chunk(size: number, callback: (results: any[]) => Promise<void> | void): Promise<void>;
    private buildWhereClause;
    first(): Promise<(InstanceType<M> & InferModel<M>) | null>;
    get(): Promise<Array<InstanceType<M> & InferModel<M>>>;
    private buildSelectSql;
    private ensureReadOnlySnippet;
    private ensureReadOnlySql;
}
declare class ThroughBuilder {
    private instance;
    private throughRelation;
    constructor(instance: Eloquent, throughRelation: string);
    has(finalRelation: string): QueryBuilder<typeof Eloquent>;
}
declare class Eloquent {
    [key: string]: any;
    protected static table?: string;
    protected static fillable: string[];
    protected static hidden: string[];
    static connection: any;
    private static morphMap;
    static raw(value: string): string;
    static init(connection: any, morphs?: Record<string, typeof Eloquent>): Promise<void>;
    static useConnection(connection: any, morphs?: Record<string, typeof Eloquent>): void;
    static getRelationConfig(model: typeof Eloquent, relationName: string): any | null;
    static describeRelation(model: typeof Eloquent, relationName: string): any | null;
    belongsTo(related: typeof Eloquent, foreignKey: string, ownerKey?: string): QueryBuilder<typeof Eloquent>;
    hasMany(related: typeof Eloquent, foreignKey: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    hasOne(related: typeof Eloquent, foreignKey: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    hasOneOfMany(related: typeof Eloquent, foreignKey: string, column?: string, aggregate?: 'min' | 'max', localKey?: string): QueryBuilder<typeof Eloquent>;
    latestOfMany(related: typeof Eloquent, foreignKey: string, column?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    oldestOfMany(related: typeof Eloquent, foreignKey: string, column?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    morphOne(related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    morphOneOfMany(related: typeof Eloquent, name: string, column?: string, aggregate?: 'min' | 'max', typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    latestMorphOne(related: typeof Eloquent, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    oldestMorphOne(related: typeof Eloquent, name: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    morphMany(related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey?: string): QueryBuilder<typeof Eloquent>;
    morphTo(name: string, typeColumn?: string, idColumn?: string): any;
    static registerMorphMap(map: Record<string, typeof Eloquent>): void;
    static getMorphTypeForModel(model: typeof Eloquent): string;
    static getModelForMorphType(type: string): typeof Eloquent | null;
    static getPossibleMorphTypesForModel(model: typeof Eloquent): string[];
    hasOneThrough(related: typeof Eloquent, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): QueryBuilder<typeof Eloquent>;
    hasManyThrough(related: typeof Eloquent, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey?: string, secondLocalKey?: string): QueryBuilder<typeof Eloquent>;
    belongsToMany(related: typeof Eloquent, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): QueryBuilder<typeof Eloquent>;
    static getProperty(key: string): any;
    through(relationship: string): ThroughBuilder;
    static query<T extends typeof Eloquent>(this: T): QueryBuilder<T>;
    static schema?: z.ZodTypeAny;
    toJSON(): any;
}
export default Eloquent;
//# sourceMappingURL=Eloquent.d.ts.map