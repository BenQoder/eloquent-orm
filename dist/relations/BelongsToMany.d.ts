/**
 * BelongsToMany Relation Class
 *
 * Represents a many-to-many relationship through a pivot table.
 * Example: User belongsToMany Roles (through user_roles pivot table)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
export declare class BelongsToMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
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
//# sourceMappingURL=BelongsToMany.d.ts.map