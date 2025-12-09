/**
 * HasOne Relation Class
 *
 * Represents a one-to-one relationship where the parent has one related record.
 * Example: User hasOne Profile (profiles table has user_id foreign key)
 */
import { Relation } from './Relation';
export class HasOne extends Relation {
    constructor(parent, related, foreignKey, localKey = 'id') {
        // Store properties BEFORE calling super (which calls addConstraints)
        parent.__tempForeignKey = foreignKey;
        parent.__tempLocalKey = localKey;
        super(parent, related);
        this.type = 'hasOne';
        this.foreignKey = foreignKey;
        this.localKey = localKey;
        // Clean up
        delete parent.__tempForeignKey;
        delete parent.__tempLocalKey;
    }
    /**
     * Add the base constraints - filter by parent's local key
     */
    addConstraints() {
        const foreignKey = this.parent.__tempForeignKey || this.foreignKey;
        const localKey = this.parent.__tempLocalKey || this.localKey;
        const parentKey = this.parent[localKey];
        if (parentKey !== null && parentKey !== undefined) {
            this.query.where(foreignKey, parentKey);
        }
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'hasOne',
            model: this.related,
            foreignKey: this.foreignKey,
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
