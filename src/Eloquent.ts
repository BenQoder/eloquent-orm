import { createConnection } from "mysql2/promise";
import type { z } from 'zod';
type InferModel<M extends typeof Eloquent> = M extends { schema: infer S }
    ? S extends z.ZodTypeAny
    ? z.infer<S>
    : unknown
    : unknown;

type Condition = { operator: 'AND' | 'OR'; type: 'basic'; conditionOperator: string; column: string; value: any } | { operator: 'AND' | 'OR'; type: 'in' | 'not_in'; column: string; value: any[] } | { operator: 'AND' | 'OR'; type: 'null' | 'not_null'; column: string } | { operator: 'AND' | 'OR'; type: 'between' | 'not_between'; column: string; value: [any, any] } | { operator: 'AND' | 'OR'; type: 'raw'; sql: string; bindings: any[] } | { operator: 'AND' | 'OR'; group: Condition[] };

class QueryBuilder<M extends typeof Eloquent = typeof Eloquent> {
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
    private static readonly IN_CHUNK_SIZE = 1000;
    private trashedMode: 'default' | 'with' | 'only' = 'default';
    private selectBindings: any[] = [];
    private pivotConfig?: { table: string; alias: string; columns: Set<string> };

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

    async insert(values: Record<string, any>): Promise<void> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        const columns = Object.keys(values);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const params = columns.map(col => values[col]);
        await (Eloquent.connection as any).query(sql, params);
    }

    async insertGetId(values: Record<string, any>): Promise<number> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        const columns = Object.keys(values);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const params = columns.map(col => values[col]);
        const [result] = await (Eloquent.connection as any).query(sql, params);
        return (result as any).insertId;
    }

    async update(values: Record<string, any>): Promise<number> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        const sets = Object.keys(values).map(col => `${col} = ?`).join(', ');
        let sql = `UPDATE ${table} SET ${sets}`;
        const whereClause = this.conditions.length > 0 ? this.buildWhereClause(this.conditions) : { sql: '', params: [] };
        if (whereClause.sql) sql += ` WHERE ${whereClause.sql}`;
        const params = [...Object.values(values), ...whereClause.params];
        const [result] = await (Eloquent.connection as any).query(sql, params);
        return result.affectedRows;
    }

    async delete(): Promise<number> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const table = this.tableName || (this.model as any).table || this.model.name.toLowerCase() + 's';
        let sql = `DELETE FROM ${table}`;
        const whereClause = this.conditions.length > 0 ? this.buildWhereClause(this.conditions) : { sql: '', params: [] };
        if (whereClause.sql) sql += ` WHERE ${whereClause.sql}`;
        const [result] = await (Eloquent.connection as any).query(sql, whereClause.params);
        return result.affectedRows;
    }

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
        this.selectColumns.push(sql);
        if (bindings && bindings.length) this.selectBindings.push(...bindings);
        return this;
    }

    whereRaw(sql: string, bindings?: any[]): this {
        this.conditions.push({ operator: 'AND', type: 'raw', sql, bindings: bindings || [] });
        return this;
    }

    orWhereRaw(sql: string, bindings?: any[]): this {
        this.conditions.push({ operator: 'OR', type: 'raw', sql, bindings: bindings || [] });
        return this;
    }

    when(condition: any, callback: (query: QueryBuilder<any>) => void, defaultCallback?: (query: QueryBuilder<any>) => void): this {
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

    with(relations: string | string[] | Record<string, (query: QueryBuilder<any>) => void>, callback?: (query: QueryBuilder<any>) => void): this {
        if (!this.withRelations) this.withRelations = [];
        if (!this.withCallbacks) this.withCallbacks = {};
        if (typeof relations === 'string') {
            this.withRelations.push(relations);
            if (callback) this.withCallbacks[relations] = callback;
        } else if (Array.isArray(relations)) {
            for (const name of relations as string[]) {
                this.withRelations.push(name);
            }
        } else if (relations && typeof relations === 'object') {
            for (const [name, cb] of Object.entries(relations as Record<string, (q: QueryBuilder<any>) => void>)) {
                this.withRelations.push(name);
                if (cb) this.withCallbacks[name] = cb;
            }
        }
        return this;
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

    clone(): QueryBuilder<M> {
        const cloned = new QueryBuilder<M>(this.model);
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

    private async loadRelations(instances: any[], relations: string[], model?: typeof Eloquent, prefix?: string) {
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
                if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                (inst as any).__relations[relationName] = target;
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
                if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                (inst as any).__relations[relationName] = map.get(inst[localKey]) || [];
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
                if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                (inst as any).__relations[relationName] = map.get(inst[localKey]) || null;
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
                if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                (inst as any).__relations[relationName] = map.get(inst[localKey]) || null;
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
                if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                (inst as any).__relations[relationName] = map.get(inst[localKey]) || [];
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
                        if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                        (inst as any).__relations[relationName] = null;
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
                    if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                    (inst as any).__relations[relationName] = map.get(inst[idColumn]) || null;
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
                if (!(inst as any).__relations) Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                (inst as any).__relations[relationName] = map.get(inst[parentKey]) || [];
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

    async first(): Promise<(InstanceType<M> & InferModel<M>) | null> {
        if (!Eloquent.connection) throw new Error('Database connection not initialized');
        const one = this.clone().limit(1);
        const rows = await one.get();
        const result = (rows as any[])[0] as (InstanceType<M> & InferModel<M>) | undefined;
        if (result) {
            await this.loadRelations([result], this.withRelations || []);
        }
        return result ?? null;
    }

    async get(): Promise<Array<InstanceType<M> & InferModel<M>>> {
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
        const [rows] = await (Eloquent.connection as any).query(sql, allParams);
        const instances = (rows as any[]).map(row => {
            const instance = new (this.model as any)() as InstanceType<M> & InferModel<M>;
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
        return instances as Array<InstanceType<M> & InferModel<M>>;
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
    static connection: any = null;
    private static morphMap: Record<string, typeof Eloquent> = {};

    static raw(value: string): string {
        return value;
    }

    static async init(env: any, morphs?: Record<string, typeof Eloquent>) {
        Eloquent.connection = await createConnection({
            host: env.HYPERDRIVE.host,
            user: env.HYPERDRIVE.user,
            password: env.HYPERDRIVE.password,
            database: env.HYPERDRIVE.database,
            port: Number(env.HYPERDRIVE.port),
            disableEval: true
        });
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

    belongsTo(related: typeof Eloquent, foreignKey: string, ownerKey = 'id') {
        return related.query().where(ownerKey, (this as any)[foreignKey]);
    }

    hasMany(related: typeof Eloquent, foreignKey: string, localKey = 'id') {
        return related.query().where(foreignKey, (this as any)[localKey]);
    }

    hasOne(related: typeof Eloquent, foreignKey: string, localKey = 'id') {
        return related.query().where(foreignKey, (this as any)[localKey]);
    }

    morphOne(related: typeof Eloquent, name: string, typeColumn?: string, idColumn?: string, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes: string[] = (Eloquent as any).getPossibleMorphTypesForModel(this.constructor as typeof Eloquent);
        return related.query().whereIn(tCol, morphTypes).where(iCol, (this as any)[localKey]);
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

    belongsToMany(related: typeof Eloquent, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey = 'id', relatedKey = 'id') {
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

    static query<T extends typeof Eloquent>(this: T): QueryBuilder<T> {
        return new QueryBuilder<T>(this);
    }

    static schema?: z.ZodTypeAny;

    toJSON() {
        const hidden: string[] = ((this.constructor as any).hidden as string[]) || [];
        const out: any = {};
        for (const key of Object.keys(this as any)) {
            if (hidden.includes(key)) continue;
            out[key] = (this as any)[key];
        }
        const rels = (this as any).__relations as Record<string, any> | undefined;
        if (rels) {
            for (const [k, v] of Object.entries(rels)) {
                out[k] = v;
            }
        }
        return out;
    }
}

export default Eloquent;