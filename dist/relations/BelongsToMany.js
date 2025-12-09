/**
 * BelongsToMany Relation Class
 *
 * Represents a many-to-many relationship through a pivot table.
 * Example: User belongsToMany Roles (through user_roles pivot table)
 */
import { Relation } from './Relation';
export class BelongsToMany extends Relation {
    constructor(parent, related, table, foreignPivotKey, relatedPivotKey, parentKey = 'id', relatedKey = 'id') {
        // Store properties BEFORE calling super (which calls addConstraints)
        parent.__tempTable = table;
        parent.__tempForeignPivotKey = foreignPivotKey;
        parent.__tempRelatedPivotKey = relatedPivotKey;
        parent.__tempParentKey = parentKey;
        parent.__tempRelatedKey = relatedKey;
        super(parent, related);
        this.type = 'belongsToMany';
        this.pivotColumns = [];
        this.table = table;
        this.foreignPivotKey = foreignPivotKey;
        this.relatedPivotKey = relatedPivotKey;
        this.parentKey = parentKey;
        this.relatedKey = relatedKey;
        // Clean up
        delete parent.__tempTable;
        delete parent.__tempForeignPivotKey;
        delete parent.__tempRelatedPivotKey;
        delete parent.__tempParentKey;
        delete parent.__tempRelatedKey;
    }
    /**
     * Add the base constraints - join through pivot table
     */
    addConstraints() {
        const parentKey = this.parent.__tempParentKey || this.parentKey || 'id';
        const parentKeyValue = this.parent[parentKey];
        if (parentKeyValue === null || parentKeyValue === undefined) {
            return;
        }
        const pivotTable = this.getPivotTable();
        const relatedTable = this.getRelatedTable();
        const fpk = this.getForeignPivotKey();
        const rpk = this.getRelatedPivotKey();
        const relatedKey = this.parent.__tempRelatedKey || this.relatedKey || 'id';
        // Join through pivot table
        this.query
            .join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`)
            .where(`${pivotTable}.${fpk}`, parentKeyValue);
    }
    /**
     * Get the relationship configuration for eager loading
     */
    getConfig() {
        return {
            type: 'belongsToMany',
            model: this.related,
            table: this.getPivotTable(),
            foreignPivotKey: this.getForeignPivotKey(),
            relatedPivotKey: this.getRelatedPivotKey(),
            parentKey: this.parentKey,
            relatedKey: this.relatedKey,
        };
    }
    /**
     * Get the results of the relationship
     */
    async getResults() {
        const parentKeyValue = this.parent[this.parentKey];
        if (parentKeyValue === null || parentKeyValue === undefined) {
            return [];
        }
        return this.get();
    }
    /**
     * Specify which pivot columns to include
     */
    withPivot(...columns) {
        this.pivotColumns.push(...columns);
        const pivotTable = this.getPivotTable();
        for (const col of columns) {
            this.query.addSelect(`${pivotTable}.${col} as pivot_${col}`);
        }
        return this;
    }
    /**
     * Get the pivot table name
     */
    getPivotTable() {
        const table = this.parent.__tempTable || this.table;
        if (table)
            return table;
        // Generate default pivot table name from model names (alphabetical order)
        const parentName = this.parent.constructor.name.toLowerCase();
        const relatedName = this.related.name.toLowerCase();
        return [parentName, relatedName].sort().join('_');
    }
    /**
     * Get the related model's table name
     */
    getRelatedTable() {
        return this.related.table || this.related.name.toLowerCase() + 's';
    }
    /**
     * Get the foreign pivot key
     */
    getForeignPivotKey() {
        const fpk = this.parent.__tempForeignPivotKey || this.foreignPivotKey;
        return fpk || `${this.parent.constructor.name.toLowerCase()}_id`;
    }
    /**
     * Get the related pivot key
     */
    getRelatedPivotKey() {
        const rpk = this.parent.__tempRelatedPivotKey || this.relatedPivotKey;
        return rpk || `${this.related.name.toLowerCase()}_id`;
    }
}
