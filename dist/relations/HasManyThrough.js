/**
 * HasManyThrough Relation Class
 *
 * Represents a has-many-through relationship.
 * Example: Country hasManyThrough Posts through Users
 * (countries -> users -> posts)
 */
import { Relation } from './Relation';
/**
 * Base class for through relationships
 */
class ThroughRelation extends Relation {
    constructor(parent, related, through, firstKey, secondKey, localKey = 'id', secondLocalKey = 'id') {
        super(parent, related);
        this.through = through;
        this.firstKey = firstKey;
        this.secondKey = secondKey;
        this.localKey = localKey;
        this.secondLocalKey = secondLocalKey;
    }
    /**
     * Add the base constraints - join through intermediate table
     */
    addConstraints() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === undefined) {
            return;
        }
        const relatedTable = this.getRelatedTable();
        const throughTable = this.getThroughTable();
        const fk1 = this.getFirstKey();
        const fk2 = this.getSecondKey();
        // Join through the intermediate table
        this.query
            .join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${this.secondLocalKey}`)
            .where(`${throughTable}.${fk1}`, parentKey);
    }
    /**
     * Get the related model's table name
     */
    getRelatedTable() {
        return this.related.table || this.related.name.toLowerCase() + 's';
    }
    /**
     * Get the through model's table name
     */
    getThroughTable() {
        return this.through.table || this.through.name.toLowerCase() + 's';
    }
    /**
     * Get the first key (on the through table, pointing to parent)
     */
    getFirstKey() {
        return this.firstKey || `${this.parent.constructor.name.toLowerCase()}_id`;
    }
    /**
     * Get the second key (on the related table, pointing to through)
     */
    getSecondKey() {
        return this.secondKey || `${this.through.name.toLowerCase()}_id`;
    }
}
export class HasManyThrough extends ThroughRelation {
    constructor() {
        super(...arguments);
        this.type = 'hasManyThrough';
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'hasManyThrough',
            model: this.related,
            through: this.through,
            firstKey: this.getFirstKey(),
            secondKey: this.getSecondKey(),
            localKey: this.localKey,
            secondLocalKey: this.secondLocalKey,
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
}
/**
 * HasOneThrough - returns single record through intermediate table
 */
export class HasOneThrough extends ThroughRelation {
    constructor() {
        super(...arguments);
        this.type = 'hasOneThrough';
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'hasOneThrough',
            model: this.related,
            through: this.through,
            firstKey: this.getFirstKey(),
            secondKey: this.getSecondKey(),
            localKey: this.localKey,
            secondLocalKey: this.secondLocalKey,
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
