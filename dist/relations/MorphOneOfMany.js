/**
 * MorphOneOfMany Relation Class
 *
 * Represents a polymorphic one-of-many relationship with aggregation.
 * Used for latestMorphOne and oldestMorphOne patterns.
 * Example: Post latestMorphOne Status (get the most recent status)
 */
import { MorphOneBase } from './MorphOne';
export class MorphOneOfMany extends MorphOneBase {
    constructor(parent, related, morphName, column = 'created_at', aggregate = 'max', typeColumn, idColumn, localKey = 'id') {
        super(parent, related, morphName, typeColumn, idColumn, localKey);
        this.column = column;
        this.aggregate = aggregate;
        this.type = 'morphOneOfMany';
    }
    /**
     * Add the base constraints - filter by morph type/id and aggregate
     */
    addConstraints() {
        // Call parent constraints first
        super.addConstraints();
        // Add the aggregate constraint
        const parentKey = this.parent[this.localKey];
        if (parentKey !== null && parentKey !== undefined) {
            const relatedTable = this.getRelatedTable();
            const aggFn = this.aggregate === 'max' ? 'MAX' : 'MIN';
            this.query.whereRaw(`${relatedTable}.${this.column} = (
        SELECT ${aggFn}(sub.${this.column}) FROM ${relatedTable} sub
        WHERE sub.${this.typeColumn} = ${relatedTable}.${this.typeColumn}
        AND sub.${this.idColumn} = ${relatedTable}.${this.idColumn}
      )`);
        }
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'morphOneOfMany',
            model: this.related,
            morphName: this.morphName,
            typeColumn: this.typeColumn,
            idColumn: this.idColumn,
            localKey: this.localKey,
            column: this.column,
            aggregate: this.aggregate,
        };
    }
    /**
     * Get the results of the relationship (single record or null)
     */
    async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === undefined) {
            return null;
        }
        return this.first();
    }
}
/**
 * Factory function for creating a "latest" morph one relationship
 */
export function latestMorphOne(parent, related, morphName, column = 'created_at', typeColumn, idColumn, localKey = 'id') {
    return new MorphOneOfMany(parent, related, morphName, column, 'max', typeColumn, idColumn, localKey);
}
/**
 * Factory function for creating an "oldest" morph one relationship
 */
export function oldestMorphOne(parent, related, morphName, column = 'created_at', typeColumn, idColumn, localKey = 'id') {
    return new MorphOneOfMany(parent, related, morphName, column, 'min', typeColumn, idColumn, localKey);
}
