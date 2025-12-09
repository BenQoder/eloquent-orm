/**
 * Base Relation Class
 *
 * Abstract base class for all relationship types.
 * Provides chainable query building and execution methods.
 */
export class Relation {
    constructor(parent, related) {
        this.parent = parent;
        this.related = related;
        this.query = related.query();
        this.addConstraints();
    }
    // ============================================================================
    // Query Builder Delegation - Chainable Methods
    // ============================================================================
    /**
     * Add a where clause to the query
     */
    where(column, operatorOrValue, value) {
        this.query.where(column, operatorOrValue, value);
        return this;
    }
    /**
     * Add a where in clause to the query
     */
    whereIn(column, values) {
        this.query.whereIn(column, values);
        return this;
    }
    /**
     * Add a where not in clause to the query
     */
    whereNotIn(column, values) {
        this.query.whereNotIn(column, values);
        return this;
    }
    /**
     * Add a where null clause to the query
     */
    whereNull(column) {
        this.query.whereNull(column);
        return this;
    }
    /**
     * Add a where not null clause to the query
     */
    whereNotNull(column) {
        this.query.whereNotNull(column);
        return this;
    }
    /**
     * Add a raw where clause to the query
     */
    whereRaw(sql, bindings) {
        this.query.whereRaw(sql, bindings);
        return this;
    }
    /**
     * Add an order by clause to the query
     */
    orderBy(column, direction = 'asc') {
        this.query.orderBy(column, direction);
        return this;
    }
    /**
     * Limit the number of results
     */
    limit(count) {
        this.query.limit(count);
        return this;
    }
    /**
     * Skip a number of results
     */
    offset(count) {
        this.query.offset(count);
        return this;
    }
    /**
     * Select specific columns
     */
    select(...columns) {
        this.query.select(...columns);
        return this;
    }
    // ============================================================================
    // Query Execution Methods
    // ============================================================================
    /**
     * Execute the query and get all results
     */
    async get() {
        return this.query.get();
    }
    /**
     * Execute the query and get the first result
     */
    async first() {
        return this.query.first();
    }
    /**
     * Get the count of related records
     */
    async count() {
        return this.query.count();
    }
    /**
     * Check if any related records exist
     */
    async exists() {
        return this.query.exists();
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Get the underlying query builder
     */
    getQuery() {
        return this.query;
    }
    /**
     * Get the parent model instance
     */
    getParent() {
        return this.parent;
    }
    /**
     * Get the related model class
     */
    getRelated() {
        return this.related;
    }
}
