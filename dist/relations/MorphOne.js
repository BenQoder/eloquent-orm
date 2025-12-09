/**
 * MorphOne Relation Class
 *
 * Represents a polymorphic one-to-one relationship.
 * Example: Post morphOne Image (images table has imageable_type and imageable_id)
 */
import { Relation } from './Relation';
/**
 * Base class for morph-one type relationships
 */
export class MorphOneBase extends Relation {
    constructor(parent, related, morphName, typeColumn, idColumn, localKey = 'id') {
        // Set columns before calling super (which calls addConstraints)
        const tCol = typeColumn || `${morphName}_type`;
        const iCol = idColumn || `${morphName}_id`;
        // Temporarily store these so addConstraints can use them
        parent.__tempTypeColumn = tCol;
        parent.__tempIdColumn = iCol;
        super(parent, related);
        this.morphName = morphName;
        this.localKey = localKey;
        this.typeColumn = tCol;
        this.idColumn = iCol;
        // Clean up temp properties
        delete parent.__tempTypeColumn;
        delete parent.__tempIdColumn;
    }
    /**
     * Add the base constraints - filter by morph type and id
     */
    addConstraints() {
        const typeColumn = this.parent.__tempTypeColumn || this.typeColumn;
        const idColumn = this.parent.__tempIdColumn || this.idColumn;
        const parentKey = this.parent[this.localKey];
        const morphTypes = this.getMorphTypes();
        if (parentKey !== null && parentKey !== undefined) {
            this.query.whereIn(typeColumn, morphTypes);
            this.query.where(idColumn, parentKey);
        }
    }
    /**
     * Get the related model's table name
     */
    getRelatedTable() {
        return this.related.table || this.related.name.toLowerCase() + 's';
    }
    /**
     * Get possible morph type values for the parent model
     */
    getMorphTypes() {
        const parentClass = this.parent.constructor;
        const types = new Set();
        // Check for explicit morphClass
        const explicitClass = parentClass.morphClass;
        if (explicitClass)
            types.add(explicitClass);
        // Check for explicit morphTypes array
        const explicitTypes = parentClass.morphTypes;
        if (explicitTypes && Array.isArray(explicitTypes)) {
            for (const t of explicitTypes)
                if (t)
                    types.add(t);
        }
        // Add class name as fallback
        types.add(parentClass.name);
        return Array.from(types);
    }
}
export class MorphOne extends MorphOneBase {
    constructor() {
        super(...arguments);
        this.type = 'morphOne';
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'morphOne',
            model: this.related,
            morphName: this.morphName,
            typeColumn: this.typeColumn,
            idColumn: this.idColumn,
            localKey: this.localKey,
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
