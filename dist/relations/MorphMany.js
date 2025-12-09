/**
 * MorphMany Relation Class
 *
 * Represents a polymorphic one-to-many relationship.
 * Example: Post morphMany Comments (comments table has commentable_type and commentable_id)
 */
import { Relation } from './Relation';
export class MorphMany extends Relation {
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
        this.type = 'morphMany';
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
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'morphMany',
            model: this.related,
            morphName: this.morphName,
            typeColumn: this.typeColumn,
            idColumn: this.idColumn,
            localKey: this.localKey,
        };
    }
    /**
     * Get the results of the relationship
     */
    async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === undefined) {
            return [];
        }
        return this.get();
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
