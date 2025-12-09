/**
 * BelongsTo Relation Class
 *
 * Represents an inverse one-to-one or one-to-many relationship.
 * Example: Post belongsTo User (posts table has user_id foreign key)
 */
import { Relation } from './Relation';
export class BelongsTo extends Relation {
    constructor(parent, related, foreignKey, ownerKey = 'id') {
        // Store properties BEFORE calling super (which calls addConstraints)
        parent.__tempForeignKey = foreignKey;
        parent.__tempOwnerKey = ownerKey;
        super(parent, related);
        this.type = 'belongsTo';
        this.foreignKey = foreignKey;
        this.ownerKey = ownerKey;
        // Clean up
        delete parent.__tempForeignKey;
        delete parent.__tempOwnerKey;
    }
    /**
     * Add the base constraints - filter by the foreign key value
     */
    addConstraints() {
        const foreignKey = this.parent.__tempForeignKey || this.foreignKey;
        const ownerKey = this.parent.__tempOwnerKey || this.ownerKey;
        const foreignKeyValue = this.parent[foreignKey];
        if (foreignKeyValue !== null && foreignKeyValue !== undefined) {
            this.query.where(ownerKey, foreignKeyValue);
        }
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'belongsTo',
            model: this.related,
            foreignKey: this.foreignKey,
            ownerKey: this.ownerKey,
        };
    }
    /**
     * Get the results of the relationship (single record or null)
     */
    async getResults() {
        const foreignKeyValue = this.parent[this.foreignKey];
        if (foreignKeyValue === null || foreignKeyValue === undefined) {
            return null;
        }
        return this.first();
    }
}
