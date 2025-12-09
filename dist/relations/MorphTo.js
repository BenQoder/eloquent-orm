/**
 * MorphTo Relation Class
 *
 * Represents the inverse of a polymorphic relationship.
 * Example: Comment morphTo commentable (can be Post, Video, etc.)
 */
import { Relation } from './Relation';
export class MorphTo extends Relation {
    constructor(parent, morphName, typeColumn, idColumn) {
        // For MorphTo, we don't know the related model until runtime
        // So we pass a placeholder and resolve it in addConstraints
        const tCol = typeColumn || `${morphName}_type`;
        const iCol = idColumn || `${morphName}_id`;
        // Get the actual related model from the type column
        const typeValue = parent[tCol];
        const relatedModel = MorphTo.resolveRelatedModel(typeValue);
        // Store columns before super call
        parent.__tempTypeColumn = tCol;
        parent.__tempIdColumn = iCol;
        // If we can't resolve the model, use a dummy that will return nothing
        super(parent, relatedModel || parent.constructor);
        this.morphName = morphName;
        this.type = 'morphTo';
        this.typeColumn = tCol;
        this.idColumn = iCol;
        // Clean up
        delete parent.__tempTypeColumn;
        delete parent.__tempIdColumn;
    }
    /**
     * Add the base constraints - filter by the id value
     */
    addConstraints() {
        const idColumn = this.parent.__tempIdColumn || this.idColumn;
        const idValue = this.parent[idColumn];
        if (idValue !== null && idValue !== undefined) {
            this.query.where('id', idValue);
        }
        else {
            // No id, query will return nothing
            this.query.whereRaw('0 = 1');
        }
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'morphTo',
            model: this.related,
            morphName: this.morphName,
            typeColumn: this.typeColumn,
            idColumn: this.idColumn,
        };
    }
    /**
     * Get the results of the relationship (single record or null)
     */
    async getResults() {
        const typeValue = this.parent[this.typeColumn];
        const idValue = this.parent[this.idColumn];
        if (!typeValue || idValue === null || idValue === undefined) {
            return null;
        }
        const relatedModel = MorphTo.resolveRelatedModel(typeValue);
        if (!relatedModel) {
            return null;
        }
        return relatedModel.query().where('id', idValue).first();
    }
    /**
     * Resolve the related model class from a morph type string
     */
    static resolveRelatedModel(typeValue) {
        if (!typeValue)
            return null;
        // Try to get from morph map (this would be set up in Eloquent)
        // For now, return null - the Eloquent class will need to provide this
        try {
            const { Eloquent } = require('../Eloquent');
            return Eloquent.getModelForMorphType(typeValue);
        }
        catch {
            return null;
        }
    }
}
