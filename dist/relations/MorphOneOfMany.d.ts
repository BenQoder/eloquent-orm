/**
 * MorphOneOfMany Relation Class
 *
 * Represents a polymorphic one-of-many relationship with aggregation.
 * Used for latestMorphOne and oldestMorphOne patterns.
 * Example: Post latestMorphOne Status (get the most recent status)
 */
import type Eloquent from '../Eloquent';
import { MorphOneBase } from './MorphOne';
import type { RelationshipConfig } from './Relation';
export declare class MorphOneOfMany<TRelated extends Eloquent = Eloquent> extends MorphOneBase<TRelated> {
    protected column: string;
    protected aggregate: 'min' | 'max';
    readonly type = "morphOneOfMany";
    constructor(parent: Eloquent, related: typeof Eloquent, morphName: string, column?: string, aggregate?: 'min' | 'max', typeColumn?: string, idColumn?: string, localKey?: string);
    /**
     * Add the base constraints - filter by morph type/id and aggregate
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
/**
 * Factory function for creating a "latest" morph one relationship
 */
export declare function latestMorphOne<TRelated extends Eloquent = Eloquent>(parent: Eloquent, related: typeof Eloquent, morphName: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<TRelated>;
/**
 * Factory function for creating an "oldest" morph one relationship
 */
export declare function oldestMorphOne<TRelated extends Eloquent = Eloquent>(parent: Eloquent, related: typeof Eloquent, morphName: string, column?: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneOfMany<TRelated>;
//# sourceMappingURL=MorphOneOfMany.d.ts.map