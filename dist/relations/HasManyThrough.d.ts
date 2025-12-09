/**
 * HasManyThrough Relation Class
 *
 * Represents a has-many-through relationship.
 * Example: Country hasManyThrough Posts through Users
 * (countries -> users -> posts)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
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
export declare class HasManyThrough<TRelated extends Eloquent = Eloquent> extends ThroughRelation<TRelated> {
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
export declare class HasOneThrough<TRelated extends Eloquent = Eloquent> extends ThroughRelation<TRelated> {
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
export {};
//# sourceMappingURL=HasManyThrough.d.ts.map