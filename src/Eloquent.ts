/**
 * READ-ONLY ORM (Intentional Design)
 *
 * - This ORM is designed strictly for read operations.
 * - Mutating APIs (insert/update/delete, DDL, transactions, attach/detach/sync, save/create, etc.)
 *   must NOT be added. Raw SQL is restricted to SELECT statements only.
 * - A runtime guard rejects non-SELECT SQL (see ensureReadOnlySql/ensureReadOnlySnippet).
 * - Initialization requires a pre-created connection; this library will not open new connections.
 *
 * Contributor notes:
 * - If you add new raw-SQL entry points, call ensureReadOnlySql/ensureReadOnlySnippet.
 * - Keep the public surface read-only unless an explicit, opt-in write mode is introduced.
 * - Document any new APIs clearly as read-only.
 *
 * @readonly
 */
import type { z } from 'zod';
// Schema and relation typing helpers
type ModelInstance<M> = M extends abstract new (...args: any) => infer I ? I : any;
// Relations map is optional per model via static relationsTypes
type RelationsOf<T> = T extends { relationsTypes: infer RT } ? RT : {};
// Schema map from static schema (Zod) - infer from constructor
type SchemaOf<T> = T extends { constructor: infer C }
    ? C extends { schema: infer S }
        ? S extends z.ZodTypeAny
            ? z.infer<S>
            : never
        : never
    : never;

// Alternative: try to infer schema from model constructor directly
type ModelSchemaType<M> = M extends { schema: infer S }
    ? S extends z.ZodTypeAny
        ? z.infer<S>
        : never
    : never;
// Final result type merges model instance with schema (fields) and declared relation properties
type ResultType<M> = ModelInstance<M> & SchemaOf<ModelInstance<M>> & Partial<RelationsOf<ModelInstance<M>>>;
// Helper to extract only the relation data we want to add
type RelationData<M, K extends string> = {
    [P in K]: P extends keyof RelationsOf<M>
        ? RelationsOf<M>[P]
        : any;
};

// Type that adds loaded relation data to the model
type WithRelations<M, K extends string> = M & RelationData<M, K>;

// Helper to infer relation types from model methods
type InferRelationType<T, K extends string> =
    T extends { prototype: { [P in K]: () => infer R } }
        ? R extends { model: infer M }
            ? M extends typeof Eloquent
                ? InstanceType<M>
                : any
            : any
        : any;

// Map relation names to their actual types
type RelationTypes<T, K extends string> = {
    [P in K]: InferRelationType<T, P>
};

type Condition = { operator: 'AND' | 'OR'; type: 'basic'; conditionOperator: string; column: string; value: any } | { operator: 'AND' | 'OR'; type: 'in' | 'not_in'; column: string; value: any[] } | { operator: 'AND' | 'OR'; type: 'null' | 'not_null'; column: string } | { operator: 'AND' | 'OR'; type: 'between' | 'not_between'; column: string; value: [any, any] } | { operator: 'AND' | 'OR'; type: 'raw'; sql: string; bindings: any[] } | { operator: 'AND' | 'OR'; group: Condition[] };

class QueryBuilder<M extends typeof Eloquent = typeof Eloquent, TWith extends string = never> {
    private model: M;
    private conditions: Condition[] = [];
    private tableName?: string;
    private selectColumns: string[] = ['*'];
    private isDistinct: boolean = false;
    private joins: { type: 'inner' | 'left' | 'right' | 'cross', table: string, first?: string, operator?: string, second?: string }[] = [];
    private unions: { query: QueryBuilder, all: boolean }[] = [];
    private limitValue?: number;
    private offsetValue?: number;
    private orderByClauses: { column: string, direction: 'asc' | 'desc' }[] = [];
    private groupByColumns: string[] = [];
    private havingConditions: Condition[] = [];
    private withRelations?: string[];
    private withCallbacks?: Record<string, (query: QueryBuilder<any>) => void>;
    private withColumns?: Record<string, string[]>;
    private static readonly IN_CHUNK_SIZE = 1000;
    private trashedMode: 'default' | 'with' | 'only' = 'default';
    private selectBindings: any[] = [];
    private pivotConfig?: { table: string; alias: string; columns: Set<string> };
    private static readonly FORBIDDEN_SQL = [
        'insert', 'update', 'delete', 'replace', 'create', 'drop', 'alter', 'truncate',
        'grant', 'revoke', 'load data', 'into outfile'
    ];

    constructor(model: M) {
        this.model = model;
    }

    table(name: string): this {
        this.tableName = name;
        return this;
    }

    select(...columns: string[]): this {
        this.selectColumns = columns;
        return this;
    }

    addSelect(...columns: string[]): this {
        this.selectColumns.push(...columns);
        return this;
    }

    distinct(): this {
        this.isDistinct = true;
        return this;
    }

    orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
        this.orderByClauses.push({ column, direction });
        return this;
    }

    orderByDesc(column: string): this {
        return this.orderBy(column, 'desc');
    }

    latest(column = 'created_at'): this {
        return this.orderBy(column, 'desc');
    }

    oldest(column = 'created_at'): this {
        return this.orderBy(column, 'asc');
    }

    inRandomOrder(): this {
        this.orderByClauses.push({ column: 'RAND()', direction: 'asc' });
        return this;
    }

    groupBy(...columns: string[]): this {
        this.groupByColumns.push(...columns);
        return this;
    }

    having(column: string, operator: string, value: any): this;
    having(callback: (query: QueryBuilder<any>) => void): this;
    having(columnOrCallback: string | ((query: QueryBuilder<any>) => void), operator?: string, value?: any): this {
        if (typeof columnOrCallback === 'function') {
            const subQuery = new QueryBuilder<any>(this.model);
            (columnOrCallback as (query: QueryBuilder<any>) => void)(subQuery);
            if (subQuery.conditions.length > 0) {
                this.havingConditions.push({ operator: 'AND', group: subQuery.conditions });
            }
        } else {
            const column = columnOrCallback;
            const op = operator || '=';
            const val = value;
            this.havingConditions.push({ operator: 'AND', type: 'basic', conditionOperator: op, column, value: val });
        }
        return this;
    }

    limit(value: number): this {
        this.limitValue = value;
        return this;
    }

    offset(value: number): this {
        this.offsetValue = value;
        return this;
    }

    join(table: string, first: string, operator: string, second: string): this {
        this.joins.push({ type: 'inner', table, first, operator, second });
        return this;
    }

    leftJoin(table: string, first: string, operator: string, second: string): this {
        this.joins.push({ type: 'left', table, first, operator, second });
        return this;
    }

    rightJoin(table: string, first: string, operator: string, second: string): this {
        this.joins.push({ type: 'right', table, first, operator, second });
        return this;
    }

    crossJoin(table: string): this {
        this.joins.push({ type: 'cross', table });
        return this;
    }

    union(query: QueryBuilder): this {
        this.unions.push({ query, all: false });
        return this;
    }

    unionAll(query: QueryBuilder): this {
        this.unions.push({ query, all: true });
        return this;
    }

    async count(column = '*'): Promise<number> {
        return this.aggregate('COUNT', column);
    }

    async max(column: string): Promise<number> {
        return this.aggregate('MAX', column);
    }

    async min(column: string): Promise<number> {
        return this.aggregate('MIN', column);
    }

    async avg(column: string): Promise<number> {
        return this.aggregate('AVG', column);
    }

    async sum(column: string): Promise<number> {
        return this.aggregate('SUM', column);
    }

    async exists(): Promise<boolean> {
        const result = await this.count();
        return result > 0;
    }

    async doesntExist(): Promise<boolean> {
        return !(await this.exists());
    }

    async pluck(column: string, key?: string): Promise<any> {
        const results = await this.get();
        if (key) {
            return (results as any[]).reduce((acc: Record<string, any>, row: any) => {
                acc[row[key as string]] = row[column as string];
                return acc;
            }, {} as Record<string, any>);
        } else {
            return (results as any[]).map((row: any) => row[column as string]);
        }
    }

    async value(column: string): Promise<any> {
        const row = await this.first();
        return row ? (row as any)[column as string] : null;
    }

    async find(id: any): Promise<any> {
        return this.where('id', id).first();
    }

    // Removed write operations (insert, insertGetId, update, delete) to keep ORM read-only

    private async aggregate(functionName: string, column: string): Promise<any> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        let sql = `SELECT ${functionName}(${column}) as aggregate FROM ${table}`;
        const allConditions: Condition[] = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        const soft = (this.model as any).softDeletes;
        if (soft) {
            if (this.trashedMode === 'default') {
                allConditions.push({ operator: 'AND', type: 'null', column: `${table}.deleted_at` } as any);
            } else if (this.trashedMode === 'only') {
                allConditions.push({ operator: 'AND', type: 'not_null', column: `${table}.deleted_at` } as any);
            }
        }
        const whereClause = allConditions.length > 0 ? this.buildWhereClause(allConditions) : { sql: '', params: [] };
        if (whereClause.sql) sql += ` WHERE ${whereClause.sql}`;
        this.ensureReadOnlySql(sql, 'aggregate');
        const [rows] = await (Eloquent.connection as any).query(sql, whereClause.params);
        return (rows as any[])[0].aggregate;
    }

    where(column: string, value: any): this;
    where(column: string, operator: string, value: any): this;
    where(callback: (query: QueryBuilder<any>) => void): this;
    where(columnOrCallback: string | ((query: QueryBuilder<any>) => void), operatorOrValue?: any, value?: any): this {
        if (typeof columnOrCallback === 'function') {
            const subQuery = new QueryBuilder<any>(this.model);
            (columnOrCallback as (query: QueryBuilder<any>) => void)(subQuery);
            if (subQuery.conditions.length > 0) {
                this.conditions.push({ operator: 'AND', group: subQuery.conditions });
            }
        } else {
            const column = columnOrCallback;
            let conditionOperator: string;
            let val: any;
            if (value !== undefined) {
                conditionOperator = operatorOrValue;
                val = value;
            } else {
                conditionOperator = '=';
                val = operatorOrValue;
            }
            this.conditions.push({ operator: 'AND', type: 'basic', conditionOperator, column, value: val });
        }
        return this;
    }

    orWhere(column: string, value: any): this;
    orWhere(column: string, operator: string, value: any): this;
    orWhere(callback: (query: QueryBuilder<any>) => void): this;
    orWhere(columnOrCallback: string | ((query: QueryBuilder<any>) => void), operatorOrValue?: any, value?: any): this {
        if (typeof columnOrCallback === 'function') {
            const subQuery = new QueryBuilder<any>(this.model);
            (columnOrCallback as (query: QueryBuilder<any>) => void)(subQuery);
            this.conditions.push({ operator: 'OR', group: subQuery.conditions });
        } else {
            const column = columnOrCallback;
            let conditionOperator: string;
            let val: any;
            if (value !== undefined) {
                conditionOperator = operatorOrValue;
                val = value;
            } else {
                conditionOperator = '=';
                val = operatorOrValue;
            }
            this.conditions.push({ operator: 'OR', type: 'basic', conditionOperator, column, value: val });
        }
        return this;
    }

    whereIn(column: string, values: any[]): this {
        this.conditions.push({ operator: 'AND', type: 'in', column, value: values });
        return this;
    }

    whereNotIn(column: string, values: any[]): this {
        this.conditions.push({ operator: 'AND', type: 'not_in', column, value: values });
        return this;
    }

    orWhereIn(column: string, values: any[]): this {
        this.conditions.push({ operator: 'OR', type: 'in', column, value: values });
        return this;
    }

    orWhereNotIn(column: string, values: any[]): this {
        this.conditions.push({ operator: 'OR', type: 'not_in', column, value: values });
        return this;
    }

    whereNull(column: string): this {
        this.conditions.push({ operator: 'AND', type: 'null', column });
        return this;
    }

    whereNotNull(column: string): this {
        this.conditions.push({ operator: 'AND', type: 'not_null', column });
        return this;
    }

    orWhereNull(column: string): this {
        this.conditions.push({ operator: 'OR', type: 'null', column });
        return this;
    }

    orWhereNotNull(column: string): this {
        this.conditions.push({ operator: 'OR', type: 'not_null', column });
        return this;
    }

    whereBetween(column: string, values: [any, any]): this {
        this.conditions.push({ operator: 'AND', type: 'between', column, value: values });
        return this;
    }

    whereNotBetween(column: string, values: [any, any]): this {
        this.conditions.push({ operator: 'AND', type: 'not_between', column, value: values });
        return this;
    }

    orWhereBetween(column: string, values: [any, any]): this {
        this.conditions.push({ operator: 'OR', type: 'between', column, value: values });
        return this;
    }

    orWhereNotBetween(column: string, values: [any, any]): this {
        this.conditions.push({ operator: 'OR', type: 'not_between', column, value: values });
        return this;
    }

    selectRaw(sql: string, bindings?: any[]): this {
        this.ensureReadOnlySnippet(sql, 'selectRaw');
        this.selectColumns.push(sql);
        if (bindings && bindings.length) this.selectBindings.push(...bindings);
        return this;
    }

    whereRaw(sql: string, bindings?: any[]): this {
        this.ensureReadOnlySnippet(sql, 'whereRaw');
        this.conditions.push({ operator: 'AND', type: 'raw', sql, bindings: bindings || [] });
        return this;
    }

    orWhereRaw(sql: string, bindings?: any[]): this {
        this.ensureReadOnlySnippet(sql, 'orWhereRaw');
        this.conditions.push({ operator: 'OR', type: 'raw', sql, bindings: bindings || [] });
        return this;
    }

    when(condition: any, callback: (query: this) => void, defaultCallback?: (query: this) => void): this {
        if (condition) {
            callback(this);
        } else if (defaultCallback) {
            defaultCallback(this);
        }
        return this;
    }

    whereHas(relation: string, callback?: (query: QueryBuilder) => void): this {
        const exists = this.buildHasSubquery(relation, callback);
        this.whereRaw(`EXISTS (${exists.sql})`, exists.params);
        return this;
    }

    orWhereHas(relation: string, callback?: (query: QueryBuilder) => void): this {
        const exists = this.buildHasSubquery(relation, callback);
        this.orWhereRaw(`EXISTS (${exists.sql})`, exists.params);
        return this;
    }

    doesntHave(relation: string, callback?: (query: QueryBuilder) => void): this {
        const exists = this.buildHasSubquery(relation, callback);
        this.whereRaw(`NOT EXISTS (${exists.sql})`, exists.params);
        return this;
    }

    whereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this {
        return this.doesntHave(relation, callback);
    }

    whereBelongsTo(model: any | any[], relation?: string): this {
        if (Array.isArray(model)) {
            const ids = model.map(m => m.id).filter(id => id !== null && id !== undefined);
            if (ids.length === 0) {
                this.whereRaw('0=1'); // No matches
                return this;
            }
            return this.whereIn(this.getBelongsToForeignKey(relation), ids);
        } else {
            return this.where(this.getBelongsToForeignKey(relation), model.id);
        }
    }

    private getBelongsToForeignKey(relation?: string): string {
        if (relation) {
            const cfg = (Eloquent as any).getRelationConfig(this.model, relation);
            if (cfg && cfg.type === 'belongsTo') {
                return cfg.foreignKey;
            }
            throw new Error(`Relation '${relation}' is not a belongsTo relationship`);
        } else {
            // Infer from model type - this is a simplified version
            // In a full implementation, you'd need to map model types to foreign keys
            throw new Error('Relation name must be provided for whereBelongsTo when not inferring from model type');
        }
    }

    whereRelation(relation: string, callback?: (query: QueryBuilder) => void): this {
        return this.whereHas(relation, callback);
    }

    orWhereRelation(relation: string, callback?: (query: QueryBuilder) => void): this {
        return this.orWhereHas(relation, callback);
    }

    whereHasMorph(relation: string, modelType: string | typeof Eloquent, callback?: (query: QueryBuilder) => void): this {
        const cfg = (Eloquent as any).getRelationConfig(this.model, relation);
        if (!cfg || (cfg.type !== 'morphMany' && cfg.type !== 'morphOne')) {
            throw new Error(`Relation '${relation}' is not a morph relationship`);
        }
        const typeValue = typeof modelType === 'string' ? modelType : Eloquent.getMorphTypeForModel(modelType);
        const exists = this.buildHasSubquery(relation, callback);
        // Modify the subquery to filter by morph type
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const modifiedSql = exists.sql.replace(
            `FROM ${cfg.model.name.toLowerCase()}s`,
            `FROM ${cfg.model.name.toLowerCase()}s WHERE ${cfg.model.name.toLowerCase()}s.${typeColumn} = ?`
        );
        this.whereRaw(`EXISTS (${modifiedSql})`, [typeValue, ...exists.params]);
        return this;
    }

    whereMorphedTo(relation: string, model: any): this {
        const cfg = (Eloquent as any).getRelationConfig(this.model, relation);
        if (!cfg || cfg.type !== 'morphTo') {
            throw new Error(`Relation '${relation}' is not a morphTo relationship`);
        }
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const idColumn = cfg.idColumn || `${cfg.morphName}_id`;
        const typeValue = Eloquent.getMorphTypeForModel(model.constructor as typeof Eloquent);
        return this.where(typeColumn, typeValue).where(idColumn, model.id);
    }

    has(relation: string): this {
        return this.whereHas(relation);
    }

    withCount(relations: string | string[] | Record<string, (query: QueryBuilder) => void>): this {
        const list: Array<{ name: string, cb?: (q: QueryBuilder) => void }> = [];
        if (typeof relations === 'string') {
            list.push({ name: relations });
        } else if (Array.isArray(relations)) {
            for (const name of relations) list.push({ name });
        } else if (relations && typeof relations === 'object') {
            for (const [name, cb] of Object.entries(relations)) list.push({ name, cb });
        }
        for (const item of list) {
            const count = this.buildCountSubquery(item.name, item.cb);
            const alias = `${item.name.replace(/\./g, '_')}_count`;
            // Push a placeholder for params to keep them bound correctly
            this.selectRaw(`(${count.sql}) as ${alias}`, count.params);
        }
        return this;
    }

    private buildCountSubquery(relation: string, callback?: (query: QueryBuilder) => void): { sql: string, params: any[] } {
        const exists = this.buildHasSubquery(relation, callback, true);
        // convert SELECT 1 ... to SELECT COUNT(*) ... by replacing prefix
        const sql = exists.sql.replace(/^SELECT\s+1\s+/i, 'SELECT COUNT(*) ');
        return { sql, params: exists.params };
    }

    private buildHasSubquery(relationName: string, callback?: (query: QueryBuilder) => void, isCount = false): { sql: string, params: any[] } {
        const cfg = (Eloquent as any).getRelationConfig(this.model, relationName);
        if (!cfg) {
            return { sql: 'SELECT 1 WHERE 0=1', params: [] };
        }
        const parentTable = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        const RelatedModel = cfg.model as typeof Eloquent;
        const relatedTable = (RelatedModel as any).table || RelatedModel.name.toLowerCase() + 's';
        const relQB = RelatedModel.query();
        if (callback) callback(relQB);

        // apply soft delete scope to related
        const relSoft = (RelatedModel as any).softDeletes;
        const relConditions: Condition[] = (relQB as any).conditions ? JSON.parse(JSON.stringify((relQB as any).conditions)) : [];
        if (relSoft) {
            const mode = (relQB as any).trashedMode as 'default' | 'with' | 'only';
            if (mode === 'default') relConditions.push({ operator: 'AND', type: 'null', column: `${relatedTable}.deleted_at` } as any);
            else if (mode === 'only') relConditions.push({ operator: 'AND', type: 'not_null', column: `${relatedTable}.deleted_at` } as any);
        }
        const where = this.buildWhereClause(relConditions);
        const parts: string[] = [];
        const params: any[] = [];
        // relationship linkage
        if (cfg.type === 'hasMany' || cfg.type === 'hasOne') {
            const foreignKey = cfg.foreignKey;
            const localKey = cfg.localKey || 'id';
            parts.push(`${relatedTable}.${foreignKey} = ${parentTable}.${localKey}`);
        } else if (cfg.type === 'belongsTo') {
            const foreignKey = cfg.foreignKey;
            const ownerKey = cfg.ownerKey || 'id';
            parts.push(`${relatedTable}.${ownerKey} = ${parentTable}.${foreignKey}`);
        } else if (cfg.type === 'morphMany' || cfg.type === 'morphOne') {
            const name = cfg.morphName;
            const typeColumn = cfg.typeColumn || `${name}_type`;
            const idColumn = cfg.idColumn || `${name}_id`;
            const localKey = cfg.localKey || 'id';
            const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(this.model as any);
            parts.push(`${relatedTable}.${idColumn} = ${parentTable}.${localKey}`);
            parts.push(`${relatedTable}.${typeColumn} IN (${morphTypes.map(() => '?').join(', ')})`);
            params.push(...morphTypes);
        } else if (cfg.type === 'belongsToMany') {
            const pivotTable = cfg.table || [this.model.name.toLowerCase(), RelatedModel.name.toLowerCase()].sort().join('_');
            const fpk = cfg.foreignPivotKey || `${this.model.name.toLowerCase()}_id`;
            const rpk = cfg.relatedPivotKey || `${RelatedModel.name.toLowerCase()}_id`;
            const parentKey = cfg.parentKey || 'id';
            const relatedKey = cfg.relatedKey || 'id';
            // Build join in FROM clause
            const join = `FROM ${relatedTable} JOIN ${pivotTable} ON ${relatedTable}.${relatedKey} = ${pivotTable}.${rpk}`;
            const link = `${pivotTable}.${fpk} = ${parentTable}.${parentKey}`;
            const whereSql = where.sql ? ` AND ${where.sql}` : '';
            const sql = `SELECT 1 ${join} WHERE ${link}${whereSql}`;
            return { sql, params: [...where.params] };
        } else {
            // morphTo and others not supported yet here
            return { sql: 'SELECT 1 WHERE 0=1', params: [] };
        }
        const whereSql = where.sql ? ` AND ${where.sql}` : '';
        const sql = `SELECT 1 FROM ${relatedTable} WHERE ${parts.join(' AND ')}${whereSql}`;
        params.push(...where.params);
        return { sql, params };
    }

    with<K extends string>(relations: K | K[] | Record<K, string[] | ((query: QueryBuilder<any>) => void)>, callback?: (query: QueryBuilder<any>) => void): QueryBuilder<M, TWith | K> {
        if (!this.withRelations) this.withRelations = [];
        if (!this.withCallbacks) this.withCallbacks = {};
        if (!this.withColumns) this.withColumns = {};

        if (typeof relations === 'string') {
            const parsed = this.parseRelationWithColumns(relations);
            this.withRelations.push(parsed.relation);
            if (parsed.columns) this.withColumns[parsed.relation] = parsed.columns;
            if (callback) this.withCallbacks[parsed.relation] = callback;
        } else if (Array.isArray(relations)) {
            for (const name of relations as string[]) {
                const parsed = this.parseRelationWithColumns(name);
                this.withRelations.push(parsed.relation);
                if (parsed.columns) this.withColumns[parsed.relation] = parsed.columns;
            }
        } else if (relations && typeof relations === 'object') {
            for (const [name, value] of Object.entries(relations as Record<string, string[] | ((q: QueryBuilder<any>) => void)>)) {
                this.withRelations.push(name);
                if (Array.isArray(value)) {
                    this.withColumns[name] = value;
                } else if (typeof value === 'function') {
                    this.withCallbacks[name] = value;
                }
            }
        }
        return this as any;
    }

    private parseRelationWithColumns(relation: string): { relation: string, columns?: string[] } {
        const colonIndex = relation.indexOf(':');
        if (colonIndex === -1) {
            return { relation };
        }
        const relName = relation.substring(0, colonIndex);
        const columnsStr = relation.substring(colonIndex + 1);
        const columns = columnsStr.split(',').map(col => col.trim()).filter(col => col.length > 0);
        return { relation: relName, columns };
    }

    withWhereHas(relation: string, callback?: (query: QueryBuilder) => void): any {
        // withWhereHas both constrains the query and eager loads the relation
        this.whereHas(relation, callback);
        return this.with(relation, callback);
    }

    without(relations: string | string[]): this {
        if (!this.withRelations) return this;

        const relationsToRemove = Array.isArray(relations) ? relations : [relations];
        this.withRelations = this.withRelations.filter(rel => !relationsToRemove.includes(rel));

        // Also remove from callbacks and columns
        for (const rel of relationsToRemove) {
            if (this.withCallbacks) delete this.withCallbacks[rel];
            if (this.withColumns) delete this.withColumns[rel];
        }

        return this;
    }

    withOnly(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): any {
        // Clear existing relations and set only the specified ones
        this.withRelations = [];
        this.withCallbacks = {};
        this.withColumns = {};

        return this.with(relations);
    }

    withTrashed(): this {
        this.trashedMode = 'with';
        return this;
    }

    onlyTrashed(): this {
        this.trashedMode = 'only';
        return this;
    }

    withoutTrashed(): this {
        this.trashedMode = 'default';
        return this;
    }

    latestOfMany(column = 'created_at'): this {
        return this.ofMany(column, 'max');
    }

    oldestOfMany(column = 'created_at'): this {
        return this.ofMany(column, 'min');
    }

    ofMany(column: string, aggregate: 'min' | 'max'): this {
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';

        // Build the subquery to find the aggregate value
        const subQuery = this.clone();
        subQuery.selectColumns = [`${aggregate.toUpperCase()}(${column}) as aggregate_value`];
        subQuery.limitValue = undefined;
        subQuery.offsetValue = undefined;
        subQuery.orderByClauses = [];

        const subQuerySql = subQuery.buildSelectSql();

        // Add condition to match the aggregate value
        this.whereRaw(`${column} = (${subQuerySql.sql})`, subQuerySql.params);

        // Add ordering and limit to ensure we get only one record
        this.orderBy(column, aggregate === 'max' ? 'desc' : 'asc').limit(1);

        return this;
    }

    clone(): QueryBuilder<M, TWith> {
        const cloned = new QueryBuilder<M, TWith>(this.model);
        cloned.tableName = this.tableName;
        cloned.conditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        cloned.selectColumns = this.selectColumns ? [...this.selectColumns] : ['*'];
        cloned.joins = this.joins ? [...this.joins] : [];
        cloned.unions = this.unions ? [...this.unions] : [];
        cloned.limitValue = this.limitValue;
        cloned.offsetValue = this.offsetValue;
        cloned.orderByClauses = this.orderByClauses ? [...this.orderByClauses] : [];
        cloned.groupByColumns = this.groupByColumns ? [...this.groupByColumns] : [];
        cloned.havingConditions = this.havingConditions ? JSON.parse(JSON.stringify(this.havingConditions)) : [];
        cloned.withRelations = this.withRelations ? [...this.withRelations] : [];
        cloned.withCallbacks = this.withCallbacks ? { ...this.withCallbacks } : undefined;
        cloned.withColumns = this.withColumns ? { ...this.withColumns } : undefined;
        cloned.trashedMode = this.trashedMode;
        cloned.selectBindings = this.selectBindings ? [...this.selectBindings] : [];
        cloned.pivotConfig = this.pivotConfig
            ? { table: this.pivotConfig.table, alias: this.pivotConfig.alias, columns: new Set(this.pivotConfig.columns) }
            : undefined;
        return cloned;
    }

    private chunkArray<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    private async getInBatches<T>(ids: any[], fetcher: (idsChunk: any[]) => Promise<T[]>): Promise<T[]> {
        if (!ids || ids.length === 0) return [] as T[];
        const unique = Array.from(new Set(ids));
        const chunks = this.chunkArray(unique, QueryBuilder.IN_CHUNK_SIZE);
        const all: T[] = [];
        for (const c of chunks) {
            const rows = await fetcher(c);
            if (rows && rows.length) all.push(...rows);
        }
        return all;
    }

    // BelongsToMany helpers
    private setPivotSource(table: string, alias = 'pivot'): this {
        if (!this.pivotConfig) this.pivotConfig = { table, alias, columns: new Set<string>() };
        return this;
    }

    as(alias: string): this {
        if (!this.pivotConfig) return this;
        this.pivotConfig.alias = alias;
        return this;
    }

    withPivot(...columns: string[]): this {
        if (!this.pivotConfig) return this;
        for (const col of columns) {
            if (!col) continue;
            this.pivotConfig.columns.add(col);
            const alias = `${this.pivotConfig.alias}__${col}`;
            this.addSelect(`${this.pivotConfig.table}.${col} AS ${alias}`);
        }
        return this;
    }

    async loadRelations(instances: any[], relations: string[], model?: typeof Eloquent, prefix?: string) {
        if (!relations || relations.length === 0) return;
        const currentModel = model || this.model;
        for (const relation of relations) {
            const parts = relation.split('.');
            const relationKey = parts[0];
            const fullPath = prefix ? `${prefix}.${relationKey}` : relationKey;
            const cfg = (Eloquent as any).getRelationConfig(currentModel, relationKey);
            await this.loadSingleRelation(instances, relationKey, currentModel, fullPath);
            if (parts.length > 1) {
                const subRelations = [parts.slice(1).join('.')];
                const relValues = instances
                    .map(inst => (inst as any).__relations && (inst as any).__relations[relationKey])
                    .filter((v: any) => v !== null && v !== undefined);
                if (!cfg) continue;
                if (cfg.type === 'morphTo') {
                    // Group by constructor to recurse per concrete model
                    const groups = new Map<any, any[]>();
                    for (const val of relValues) {
                        if (Array.isArray(val)) {
                            for (const item of val) {
                                const ctor = item && item.constructor;
                                if (!ctor) continue;
                                let arr = groups.get(ctor);
                                if (!arr) { arr = []; groups.set(ctor, arr); }
                                arr.push(item);
                            }
                        } else {
                            const ctor = val && val.constructor;
                            if (!ctor) continue;
                            let arr = groups.get(ctor);
                            if (!arr) { arr = []; groups.set(ctor, arr); }
                            arr.push(val);
                        }
                    }
                    for (const [ctor, list] of groups) {
                        if (!ctor) continue;
                        await this.loadRelations(list, subRelations, ctor as typeof Eloquent, fullPath);
                    }
                } else {
                    // Non-polymorphic: flatten arrays if morphMany/hasMany
                    let list: any[] = [];
                    for (const v of relValues) {
                        if (Array.isArray(v)) list.push(...v);
                        else list.push(v);
                    }
                    await this.loadRelations(list, subRelations, cfg.model, fullPath);
                }
            }
        }
    }

    private async loadSingleRelation(instances: any[], relationName: string, model: typeof Eloquent, fullPath: string) {
        const config = (Eloquent as any).getRelationConfig(model, relationName);
        if (!config) return;
        const type = config.type;
        if (type === 'belongsTo') {
            const RelatedModel = config.model;
            const foreignKey = config.foreignKey;
            const ownerKey = config.ownerKey || 'id';
            const foreignKeys = instances.map(inst => inst[foreignKey]).filter(id => id !== null && id !== undefined);
            if (foreignKeys.length === 0) return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(foreignKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(ownerKey, chunk);
                if (cb) cb(qb);
                return qb.get();
            });
            const map = new Map(relatedInstances.map((rel: any) => [rel[ownerKey], rel]));
            for (const inst of instances) {
                const target = map.get(inst[foreignKey]) || null;
                (inst as any)[relationName] = target;
            }
        } else if (type === 'hasMany') {
            const RelatedModel = config.model;
            const foreignKey = config.foreignKey;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter(id => id !== null && id !== undefined);
            if (localKeys.length === 0) return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(foreignKey, chunk);
                if (cb) cb(qb);
                return qb.get();
            });
            const map = new Map<any, any[]>();
            for (const rel of relatedInstances as any[]) {
                const key = rel[foreignKey];
                if (!map.has(key)) map.set(key, []);
                (map.get(key) as any[]).push(rel);
            }
            for (const inst of instances) {
                (inst as any)[relationName] = map.get(inst[localKey]) || [];
            }
        } else if (type === 'hasOne') {
            const RelatedModel = config.model;
            const foreignKey = config.foreignKey;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter(id => id !== null && id !== undefined);
            if (localKeys.length === 0) return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(foreignKey, chunk);
                if (cb) cb(qb);
                return qb.get();
            });
            const map = new Map<any, any>();
            for (const rel of relatedInstances as any[]) {
                const key = rel[foreignKey];
                map.set(key, rel);
            }
            for (const inst of instances) {
                (inst as any)[relationName] = map.get(inst[localKey]) || null;
            }
        } else if (type === 'morphOne') {
            const RelatedModel = config.model;
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter((id: any) => id !== null && id !== undefined);
            if (localKeys.length === 0) return;
            const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(model);
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk);
                if (cb) cb(qb);
                return qb.get();
            });
            const map = new Map<any, any>();
            for (const rel of relatedInstances as any[]) {
                const key = rel[idColumn];
                map.set(key, rel);
            }
            for (const inst of instances) {
                (inst as any)[relationName] = map.get(inst[localKey]) || null;
            }
        } else if (type === 'morphMany') {
            const RelatedModel = config.model;
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter((id: any) => id !== null && id !== undefined);
            if (localKeys.length === 0) return;
            const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(model);
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk);
                if (cb) cb(qb);
                return qb.get();
            });
            const map = new Map<any, any[]>();
            for (const rel of relatedInstances as any[]) {
                const key = rel[idColumn];
                if (!map.has(key)) map.set(key, []);
                (map.get(key) as any[]).push(rel);
            }
            for (const inst of instances) {
                (inst as any)[relationName] = map.get(inst[localKey]) || [];
            }
        } else if (type === 'morphTo') {
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const byType = new Map<any, any[]>();
            for (const inst of instances) {
                const t = inst[typeColumn];
                const id = inst[idColumn];
                if (t === null || t === undefined || id === null || id === undefined) continue;
                let arr = byType.get(t);
                if (!arr) { arr = []; byType.set(t, arr); }
                arr.push(inst);
            }
            for (const [t, list] of byType) {
                const ModelCtor = (Eloquent as any).getModelForMorphType(t);
                if (!ModelCtor) {
                    for (const inst of list) {
                        (inst as any)[relationName] = null;
                    }
                    continue;
                }
                const ids = list.map((inst: any) => inst[idColumn]);
                const cb = this.withCallbacks && this.withCallbacks[fullPath];
                const relatedInstances = await this.getInBatches(ids, async (chunk) => {
                    const qb = (ModelCtor as any).query().whereIn('id', chunk);
                    if (cb) cb(qb);
                    return qb.get();
                });
                const map = new Map(relatedInstances.map((rel: any) => [rel.id, rel]));
                for (const inst of list) {
                    (inst as any)[relationName] = map.get(inst[idColumn]) || null;
                }
            }
        } else if (type === 'belongsToMany') {
            const RelatedModel = config.model as typeof Eloquent;
            const relatedTable = (RelatedModel as any).table || RelatedModel.name.toLowerCase() + 's';
            const pivotTable = config.table || [model.name.toLowerCase(), RelatedModel.name.toLowerCase()].sort().join('_');
            const fpk = config.foreignPivotKey || `${model.name.toLowerCase()}_id`;
            const rpk = config.relatedPivotKey || `${RelatedModel.name.toLowerCase()}_id`;
            const parentKey = config.parentKey || 'id';
            const relatedKey = config.relatedKey || 'id';
            const parentIds = instances.map(inst => inst[parentKey]).filter((id: any) => id !== null && id !== undefined);
            if (parentIds.length === 0) return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const rows = await this.getInBatches(parentIds, async (chunk) => {
                const qb = RelatedModel.query()
                    .addSelect(`${relatedTable}.*`)
                    .addSelect(`${pivotTable}.${fpk} as __pivot_fk`)
                    .join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`)
                    .whereIn(`${pivotTable}.${fpk}`, chunk);
                // Expose pivot columns if requested via child query builder
                const columns = this.pivotConfig?.columns ? Array.from(this.pivotConfig.columns) : [];
                if (columns.length > 0) {
                    qb.setPivotSource?.(pivotTable, this.pivotConfig?.alias || 'pivot');
                    for (const col of columns) {
                        qb.addSelect(`${pivotTable}.${col} AS ${(qb as any).pivotConfig.alias}__${col}`);
                    }
                }
                if (cb) cb(qb);
                return qb.get();
            });
            const map = new Map<any, any[]>();
            for (const rel of rows as any[]) {
                const owner = (rel as any)['__pivot_fk'];
                if (owner === null || owner === undefined) continue;
                let arr = map.get(owner);
                if (!arr) { arr = []; map.set(owner, arr); }
                delete (rel as any)['__pivot_fk'];
                arr.push(rel);
            }
            for (const inst of instances) {
                (inst as any)[relationName] = map.get(inst[parentKey]) || [];
            }
        }
    }

    async chunk(size: number, callback: (results: any[]) => Promise<void> | void): Promise<void> {
        let page = 0;
        while (true) {
            const results = await this.clone().offset(page * size).limit(size).get();
            if (results.length === 0) break;
            await callback(results);
            page++;
        }
    }

    private buildWhereClause(conditions: Condition[]): { sql: string; params: any[] } {
        let sql = '';
        const params: any[] = [];
        for (let i = 0; i < conditions.length; i++) {
            const cond = conditions[i];
            if (i > 0) sql += ` ${cond.operator} `;
            if ('group' in cond) {
                const sub = this.buildWhereClause(cond.group);
                if (sub.sql) {
                    sql += `(${sub.sql})`;
                    params.push(...sub.params);
                } else {
                    // Skip empty groups entirely so we don't emit ()
                    // If this was the first condition, also trim any dangling operator spacing
                    if (sql.endsWith(` ${cond.operator} `)) {
                        sql = sql.slice(0, -(` ${cond.operator} `.length));
                    }
                }
            } else if (cond.type === 'basic') {
                sql += `${cond.column} ${(cond as { conditionOperator: string }).conditionOperator} ?`;
                params.push(cond.value);
            } else if (cond.type === 'in') {
                const values: any[] = cond.value || [];
                if (values.length === 0) {
                    sql += `0=1`;
                } else {
                    sql += `${cond.column} IN (${values.map(() => '?').join(', ')})`;
                    params.push(...values);
                }
            } else if (cond.type === 'not_in') {
                const values: any[] = cond.value || [];
                if (values.length === 0) {
                    sql += `1=1`;
                } else {
                    sql += `${cond.column} NOT IN (${values.map(() => '?').join(', ')})`;
                    params.push(...values);
                }
            } else if (cond.type === 'null') {
                sql += `${cond.column} IS NULL`;
            } else if (cond.type === 'not_null') {
                sql += `${cond.column} IS NOT NULL`;
            } else if (cond.type === 'between') {
                sql += `${cond.column} BETWEEN ? AND ?`;
                params.push(cond.value[0], cond.value[1]);
            } else if (cond.type === 'not_between') {
                sql += `${cond.column} NOT BETWEEN ? AND ?`;
                params.push(cond.value[0], cond.value[1]);
            } else if (cond.type === 'raw') {
                sql += `(${cond.sql})`;
                params.push(...cond.bindings);
            }
        }
        return { sql, params };
    }

    async first(): Promise<WithRelations<InstanceType<M>, TWith> | null> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const one = this.clone().limit(1);
        const rows = await one.get();
        const result = (rows as any[])[0] as InstanceType<M> | undefined;
        if (result) {
            await this.loadRelations([result], this.withRelations || []);
        }
        return result as any ?? null;
    }

    async get(): Promise<Array<WithRelations<InstanceType<M>, TWith>>> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const hasUnions = this.unions.length > 0;
        const main = this.buildSelectSql({ includeOrderLimit: !hasUnions });
        let sql = main.sql;
        let allParams = [...main.params];
        if (hasUnions) {
            for (const union of this.unions) {
                const unionData = union.query.buildSelectSql({ includeOrderLimit: false });
                sql += ` UNION ${union.all ? 'ALL ' : ''}${unionData.sql}`;
                allParams.push(...unionData.params);
            }
            // Apply ORDER BY / LIMIT / OFFSET at the end for the unioned result
            if (this.orderByClauses.length > 0) {
                const order = this.orderByClauses
                    .map(o => (o.column === 'RAND()' ? `RAND()` : `${o.column} ${o.direction}`))
                    .join(', ');
                sql += ` ORDER BY ${order}`;
            }
            if (this.limitValue !== undefined) sql += ` LIMIT ${this.limitValue}`;
            if (this.offsetValue !== undefined) sql += ` OFFSET ${this.offsetValue}`;
        }
        this.ensureReadOnlySql(sql, 'get');
        const [rows] = await (Eloquent.connection as any).query(sql, allParams);
        const instances = (rows as any[]).map(row => {
            const instance = new (this.model as any)() as InstanceType<M>;
            // Extract pivot data if requested
            if (this.pivotConfig) {
                const pivotObj: any = {};
                const prefix = `${this.pivotConfig.alias}__`;
                for (const key of Object.keys(row)) {
                    if (key.startsWith(prefix)) {
                        const pkey = key.slice(prefix.length);
                        pivotObj[pkey] = (row as any)[key];
                        delete (row as any)[key];
                    }
                }
                if (Object.keys(pivotObj).length > 0) {
                    (instance as any)[this.pivotConfig.alias] = pivotObj;
                }
            }
            // Zod validation/casting if schema provided
            const schema = (this.model as any).schema as import('zod').ZodTypeAny | undefined;
            const data = schema ? schema.parse(row) : row;
            Object.assign(instance, data);
            return instance;
        });
        await this.loadRelations(instances, this.withRelations || []);
        return instances as any;
    }

    private buildSelectSql(options?: { includeOrderLimit?: boolean }): { sql: string; params: any[] } {
        const includeOrderLimit = options?.includeOrderLimit !== false;
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        let sql = `SELECT ${this.isDistinct ? 'DISTINCT ' : ''}${this.selectColumns.join(', ')} FROM ${table}`;
        for (const j of this.joins) {
            if (j.type === 'cross') {
                sql += ` CROSS JOIN ${j.table}`;
            } else {
                sql += ` ${j.type.toUpperCase()} JOIN ${j.table} ON ${j.first} ${j.operator} ${j.second}`;
            }
        }
        const allConditions: Condition[] = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        const soft = (this.model as any).softDeletes;
        if (soft) {
            if (this.trashedMode === 'default') {
                allConditions.push({ operator: 'AND', type: 'null', column: `${table}.deleted_at` } as any);
            } else if (this.trashedMode === 'only') {
                allConditions.push({ operator: 'AND', type: 'not_null', column: `${table}.deleted_at` } as any);
            }
        }
        const where = allConditions.length > 0 ? this.buildWhereClause(allConditions) : { sql: '', params: [] };
        if (where.sql) sql += ` WHERE ${where.sql}`;
        if (this.groupByColumns.length > 0) sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
        if (this.havingConditions.length > 0) {
            const having = this.buildWhereClause(this.havingConditions);
            if (having.sql) sql += ` HAVING ${having.sql}`;
            where.params.push(...having.params);
        }
        if (includeOrderLimit) {
            if (this.orderByClauses.length > 0) {
                const order = this.orderByClauses
                    .map(o => (o.column === 'RAND()' ? `RAND()` : `${o.column} ${o.direction}`))
                    .join(', ');
                sql += ` ORDER BY ${order}`;
            }
            if (this.limitValue !== undefined) sql += ` LIMIT ${this.limitValue}`;
            if (this.offsetValue !== undefined) sql += ` OFFSET ${this.offsetValue}`;
        }
        const params = [...this.selectBindings, ...where.params];
        return { sql, params };
    }

    private ensureReadOnlySnippet(snippet: string, context: string) {
        const text = (snippet || '').toLowerCase();
        if (text.includes(';')) {
            throw new Error(`Read-only ORM violation in ${context}: semicolons are not allowed`);
        }
        for (const k of QueryBuilder.FORBIDDEN_SQL) {
            // Use word boundaries to avoid false positives like "created_at" matching "create"
            const regex = new RegExp(`\\b${k}\\b`, 'i');
            if (regex.test(text)) {
                throw new Error(`Read-only ORM violation in ${context}: disallowed keyword '${k}'`);
            }
        }
    }

    private ensureReadOnlySql(sql: string, context: string) {
        const lc = sql.toLowerCase().trim();
        if (!lc.startsWith('select')) {
            throw new Error(`Read-only ORM violation in ${context}: only SELECT statements are permitted`);
        }
        this.ensureReadOnlySnippet(sql, context);
    }
}

class ThroughBuilder {
    constructor(private instance: Eloquent, private throughRelation: string) { }

    has(finalRelation: string) {
        const throughModel = this.instance.constructor as typeof Eloquent;
        const throughConfig = Eloquent.getRelationConfig(throughModel, this.throughRelation);
        if (!throughConfig) throw new Error(`Through relation ${this.throughRelation} not found`);
        const throughClass = throughConfig.model;
        const finalConfig = Eloquent.getRelationConfig(throughClass, finalRelation);
        if (!finalConfig) throw new Error(`Final relation ${finalRelation} not found`);
        const finalClass = finalConfig.model;
        const isOne = finalConfig.type === 'belongsTo' || finalConfig.type === 'hasOne';
        const firstKey = throughConfig.foreignKey;
        const secondKey = finalConfig.type === 'belongsTo' ? `${throughClass.name.toLowerCase()}_id` : finalConfig.foreignKey;
        const localKey = throughConfig.localKey || 'id';
        const secondLocalKey = finalConfig.type === 'belongsTo' ? (finalConfig.ownerKey || 'id') : (finalConfig.localKey || 'id');
        if (isOne) {
            return this.instance.hasOneThrough(finalClass, throughClass, firstKey, secondKey, localKey, secondLocalKey);
        } else {
            return this.instance.hasManyThrough(finalClass, throughClass, firstKey, secondKey, localKey, secondLocalKey);
        }
    }
}

class Eloquent {
    [key: string]: any;
    protected static table?: string;
    protected static fillable: string[] = [];
    protected static hidden: string[] = [];
    protected static with: string[] = [];
    static connection: any = null;
    private static morphMap: Record<string, typeof Eloquent> = {};

    static raw(value: string): string {
        return value;
    }

    static async init(connection: any, morphs?: Record<string, typeof Eloquent>) {
        // Require an already-created connection
        Eloquent.connection = connection;
        if (morphs) {
            Eloquent.morphMap = { ...morphs };
        }
    }

    static useConnection(connection: any, morphs?: Record<string, typeof Eloquent>) {
        Eloquent.connection = connection;
        if (morphs) {
            Eloquent.morphMap = { ...morphs };
        }
    }

    // Infer relation config from instance relation methods (Laravel-style),
    // falling back to optional static relations map if present.
    static getRelationConfig(model: typeof Eloquent, relationName: string): any | null {
        const staticMap = (model as any).relations && (model as any).relations[relationName];
        if (staticMap) return staticMap;
        return (Eloquent as any).describeRelation(model, relationName);
    }

    static describeRelation(model: typeof Eloquent, relationName: string): any | null {
        const proto = (model as any).prototype;
        const relationFn = proto && proto[relationName];
        if (typeof relationFn !== 'function') return null;
        const fake: any = Object.create(proto);
        fake.belongsTo = (related: typeof Eloquent, foreignKey: string, ownerKey = 'id') => ({ __relation: { type: 'belongsTo', model: related, foreignKey, ownerKey } });
        fake.hasMany = (related: typeof Eloquent, foreignKey: string, localKey = 'id') => ({ __relation: { type: 'hasMany', model: related, foreignKey, localKey } });
        fake.hasOne = (related: typeof Eloquent, foreignKey: string, localKey = 'id') => ({ __relation: { type: 'hasOne', model: related, foreignKey, localKey } });
        fake.morphOne = (related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey = 'id') => ({ __relation: { type: 'morphOne', model: related, morphName: name, typeColumn, idColumn, localKey } });
        fake.morphMany = (related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey = 'id') => ({ __relation: { type: 'morphMany', model: related, morphName: name, typeColumn, idColumn, localKey } });
        fake.morphTo = (name: string, typeColumn?: string, idColumn?: string) => ({ __relation: { type: 'morphTo', morphName: name, typeColumn, idColumn } });
        fake.belongsToMany = (
            related: typeof Eloquent,
            table?: string,
            foreignPivotKey?: string,
            relatedPivotKey?: string,
            parentKey = 'id',
            relatedKey = 'id'
        ) => ({ __relation: { type: 'belongsToMany', model: related, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey } });
        const result = relationFn.call(fake);
        if (result && typeof result === 'object' && '__relation' in result) {
            return (result as any).__relation;
        }
        return null;
    }

    belongsTo<T extends typeof Eloquent>(related: T, foreignKey: string, ownerKey = 'id'): QueryBuilder<T, never> {
        return related.query().where(ownerKey, (this as any)[foreignKey]);
    }

    hasMany<T extends typeof Eloquent>(related: T, foreignKey: string, localKey = 'id'): QueryBuilder<T, never> {
        return related.query().where(foreignKey, (this as any)[localKey]);
    }

    hasOne<T extends typeof Eloquent>(related: T, foreignKey: string, localKey = 'id'): QueryBuilder<T, never> {
        return related.query().where(foreignKey, (this as any)[localKey]);
    }

    hasOneOfMany<T extends typeof Eloquent>(related: T, foreignKey: string, column = 'created_at', aggregate: 'min' | 'max' = 'max', localKey = 'id'): QueryBuilder<T, never> {
        return related.query().where(foreignKey, (this as any)[localKey]).ofMany(column, aggregate);
    }

    latestOfMany(related: typeof Eloquent, foreignKey: string, column = 'created_at', localKey = 'id') {
        return this.hasOneOfMany(related, foreignKey, column, 'max', localKey);
    }

    oldestOfMany(related: typeof Eloquent, foreignKey: string, column = 'created_at', localKey = 'id') {
        return this.hasOneOfMany(related, foreignKey, column, 'min', localKey);
    }

    morphOne(related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(this.constructor as typeof Eloquent);
        return related.query().whereIn(tCol, morphTypes).where(iCol, (this as any)[localKey]);
    }

    morphOneOfMany(related: typeof Eloquent, name: string, column = 'created_at', aggregate: 'min' | 'max' = 'max', typeColumn?: string, idColumn?: string, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(this.constructor as typeof Eloquent);
        return related.query().whereIn(tCol, morphTypes).where(iCol, (this as any)[localKey]).ofMany(column, aggregate);
    }

    latestMorphOne(related: typeof Eloquent, name: string, column = 'created_at', typeColumn?: string, idColumn?: string, localKey = 'id') {
        return this.morphOneOfMany(related, name, column, 'max', typeColumn, idColumn, localKey);
    }

    oldestMorphOne(related: typeof Eloquent, name: string, column = 'created_at', typeColumn?: string, idColumn?: string, localKey = 'id') {
        return this.morphOneOfMany(related, name, column, 'min', typeColumn, idColumn, localKey);
    }

    morphMany(related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(this.constructor as typeof Eloquent);
        return related.query().whereIn(tCol, morphTypes).where(iCol, (this as any)[localKey]);
    }

    morphTo(name: string, typeColumn?: string, idColumn?: string) {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const typeValue = (this as any)[tCol];
        const idValue = (this as any)[iCol];
        const ModelCtor = (Eloquent as any).getModelForMorphType(typeValue);
        if (!ModelCtor) return {
            first: async () => null,
            get: async () => []
        };
        return ModelCtor.query().where('id', idValue);
    }

    static registerMorphMap(map: Record<string, typeof Eloquent>) {
        Eloquent.morphMap = { ...Eloquent.morphMap, ...map };
    }

    static getMorphTypeForModel(model: typeof Eloquent): string {
        const explicit = (model as any).morphClass as string | undefined;
        if (explicit) return explicit;
        for (const [alias, ctor] of Object.entries(Eloquent.morphMap)) {
            if (ctor === model) return alias;
        }
        return model.name; // fallback to class name
    }

    static getModelForMorphType(type: string): typeof Eloquent | null {
        if (!type) return null;
        if (Eloquent.morphMap[type]) return Eloquent.morphMap[type];
        // fallback: global class name
        const anyGlobal: any = globalThis as any;
        if (anyGlobal[type]) return anyGlobal[type];
        // fallback: search known constructors by morphClass/static
        // Note: without a central registry, we rely on provided map/global.
        return null;
    }

    static getPossibleMorphTypesForModel(model: typeof Eloquent): string[] {
        const set = new Set<string>();
        const explicitTypes = (model as any).morphTypes as string[] | undefined;
        const explicitClass = (model as any).morphClass as string | undefined;
        if (explicitTypes && Array.isArray(explicitTypes)) {
            for (const t of explicitTypes) if (t) set.add(t);
        }
        if (explicitClass) set.add(explicitClass);
        for (const [alias, ctor] of Object.entries(Eloquent.morphMap)) {
            if (ctor === model) set.add(alias);
        }
        const className = model.name;
        set.add(className);
        return Array.from(set);
    }

    hasOneThrough(related: typeof Eloquent, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey = 'id', secondLocalKey = 'id') {
        const fk1 = firstKey || `${through.name.toLowerCase()}_id`;
        const fk2 = secondKey || `${related.name.toLowerCase()}_id`;
        const throughTable = (through as any).table || through.name.toLowerCase() + 's';
        const relatedTable = (related as any).table || related.name.toLowerCase() + 's';
        return related.query().join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${secondLocalKey}`).where(`${throughTable}.${fk1}`, (this as any)[localKey]);
    }

    hasManyThrough(related: typeof Eloquent, through: typeof Eloquent, firstKey?: string, secondKey?: string, localKey = 'id', secondLocalKey = 'id') {
        const fk1 = firstKey || `${through.name.toLowerCase()}_id`;
        const fk2 = secondKey || `${related.name.toLowerCase()}_id`;
        const throughTable = (through as any).table || through.name.toLowerCase() + 's';
        const relatedTable = (related as any).table || related.name.toLowerCase() + 's';
        return related.query().join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${secondLocalKey}`).where(`${throughTable}.${fk1}`, (this as any)[localKey]);
    }

    belongsToMany<T extends typeof Eloquent>(related: T, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey = 'id', relatedKey = 'id'): QueryBuilder<T, never> {
        const pivotTable = table || [this.constructor.name.toLowerCase(), related.name.toLowerCase()].sort().join('_');
        const fpk = foreignPivotKey || `${this.constructor.name.toLowerCase()}_id`;
        const rpk = relatedPivotKey || `${related.name.toLowerCase()}_id`;
        const relatedTable = (related as any).table || related.name.toLowerCase() + 's';
        return related.query().join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`).where(`${pivotTable}.${fpk}`, (this as any)[parentKey]);
    }

    static getProperty(key: string) {
        return (this as any)[key];
    }

    through(relationship: string) {
        return new ThroughBuilder(this, relationship);
    }

    static query<T extends typeof Eloquent>(this: T): QueryBuilder<T, never> {
        const qb = new QueryBuilder<T, never>(this);

        // Apply default eager loading if defined
        const defaultWith = (this as any).with;
        if (defaultWith && Array.isArray(defaultWith) && defaultWith.length > 0) {
            qb.with(defaultWith);
        }

        return qb;
    }

    static schema?: z.ZodTypeAny;

    toJSON() {
        const hidden: string[] = ((this.constructor as any).hidden as string[]) || [];
        const out: any = {};
        for (const key of Object.keys(this as any)) {
            if (hidden.includes(key)) continue;
            out[key] = (this as any)[key];
        }
        return out;
    }

    async load(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<this> {
        await (this.constructor as any).load([this], relations);
        return this;
    }

    async loadMissing(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<this> {
        await (this.constructor as any).loadMissing([this], relations);
        return this;
    }

    static async load(instances: Eloquent[], relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<void> {
        if (instances.length === 0) return;

        const model = instances[0].constructor as typeof Eloquent;
        const qb = model.query();

        // Apply the relations to the query builder
        qb.with(relations);

        // Load the relations by calling get() on a query that matches the instances
        // This is a simplified approach - get all instances with relations loaded
        const ids = instances.map(inst => (inst as any).id).filter(id => id !== null && id !== undefined);
        if (ids.length === 0) return;

        const loadedInstances = await model.query().with(relations).whereIn('id', ids).get();

        // Create a map of loaded instances by ID
        const loadedMap = new Map(loadedInstances.map(inst => [(inst as any).id, inst]));

        // Determine relation names to copy onto instances
        const names = this.parseRelationNames(relations);

        // Copy relations from loaded instances to original instances at top-level
        for (const instance of instances) {
            const loaded = loadedMap.get((instance as any).id);
            if (!loaded) continue;
            for (const name of names) {
                if ((loaded as any)[name] !== undefined) {
                    (instance as any)[name] = (loaded as any)[name];
                }
            }
        }
    }

    static async loadMissing(instances: Eloquent[], relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): Promise<void> {
        if (instances.length === 0) return;

        // Parse relations to get relation names
        const relationNames = this.parseRelationNames(relations);

        // Filter instances that don't have the relations loaded
        const instancesToLoad = instances.filter(inst => {
            const rels = (inst as any).__relations || {};
            return relationNames.some(name => !(name in rels));
        });

        if (instancesToLoad.length === 0) return;

        await this.load(instancesToLoad, relations);
    }

    private static parseRelationNames(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): string[] {
        if (typeof relations === 'string') {
            const base = relations.split(':')[0];
            return [base.split('.')[0]];
        } else if (Array.isArray(relations)) {
            return relations.map(r => r.split(':')[0]).map(n => n.split('.')[0]);
        } else if (relations && typeof relations === 'object') {
            return Object.keys(relations).map(n => n.split('.')[0]);
        }
        return [];
    }
}

export default Eloquent;