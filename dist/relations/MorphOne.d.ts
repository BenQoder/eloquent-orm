/**
 * MorphOne Relation Class
 *
 * Represents a polymorphic one-to-one relationship.
 * Example: Post morphOne Image (images table has imageable_type and imageable_id)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
/**
 * Base class for morph-one type relationships
 */
export declare abstract class MorphOneBase<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
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
export declare class MorphOne<TRelated extends Eloquent = Eloquent> extends MorphOneBase<TRelated> {
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
//# sourceMappingURL=MorphOne.d.ts.map