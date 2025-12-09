/**
 * BelongsTo Relation Class
 *
 * Represents an inverse one-to-one or one-to-many relationship.
 * Example: Post belongsTo User (posts table has user_id foreign key)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
export declare class BelongsTo<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
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
//# sourceMappingURL=BelongsTo.d.ts.map