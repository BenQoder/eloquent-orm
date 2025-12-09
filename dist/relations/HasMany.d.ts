/**
 * HasMany Relation Class
 *
 * Represents a one-to-many relationship where the parent has many related records.
 * Example: User hasMany Posts (posts table has user_id foreign key)
 */
import type Eloquent from '../Eloquent';
import { type Collection } from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
export declare class HasMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
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
//# sourceMappingURL=HasMany.d.ts.map