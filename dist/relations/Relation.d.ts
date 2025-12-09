/**
 * Base Relation Class
 *
 * Abstract base class for all relationship types.
 * Provides chainable query building and execution methods.
 */
import type Eloquent from '../Eloquent';
import { type QueryBuilder, type Collection } from '../Eloquent';
export interface RelationshipConfig {
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
export declare abstract class Relation<TRelated extends Eloquent = Eloquent> {
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
//# sourceMappingURL=Relation.d.ts.map