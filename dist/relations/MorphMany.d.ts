/**
 * MorphMany Relation Class
 *
 * Represents a polymorphic one-to-many relationship.
 * Example: Post morphMany Comments (comments table has commentable_type and commentable_id)
 */
import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';
export declare class MorphMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
    protected morphName: string;
    protected localKey: string;
    readonly type = "morphMany";
    protected typeColumn: string;
    protected idColumn: string;
    constructor(parent: Eloquent, related: typeof Eloquent, morphName: string, typeColumn?: string, idColumn?: string, localKey?: string);
    /**
     * Add the base constraints - filter by morph type and id
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
     * Get possible morph type values for the parent model
     */
    protected getMorphTypes(): string[];
}
//# sourceMappingURL=MorphMany.d.ts.map