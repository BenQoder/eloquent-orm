/**
 * MorphTo Relation Class
 *
 * Represents the inverse of a polymorphic relationship.
 * Example: Comment morphTo commentable (can be Post, Video, etc.)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
export declare class MorphTo<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
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
//# sourceMappingURL=MorphTo.d.ts.map