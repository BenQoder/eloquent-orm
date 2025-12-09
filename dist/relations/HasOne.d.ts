/**
 * HasOne Relation Class
 *
 * Represents a one-to-one relationship where the parent has one related record.
 * Example: User hasOne Profile (profiles table has user_id foreign key)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
export declare class HasOne<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
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
//# sourceMappingURL=HasOne.d.ts.map