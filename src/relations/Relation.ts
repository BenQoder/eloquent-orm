/**
 * Base Relation Class
 *
 * Abstract base class for all relationship types.
 * Provides chainable query building and execution methods.
 */

import type Eloquent from '../Eloquent';
import { type QueryBuilder, type Collection } from '../Eloquent';

export interface RelationshipConfig {
  type: string;
  model: typeof Eloquent | string;
  foreignKey?: string;
  localKey?: string;
  ownerKey?: string;
  morphName?: string;
  typeColumn?: string;
  idColumn?: string;
  table?: string;
  foreignPivotKey?: string;
  relatedPivotKey?: string;
  parentKey?: string;
  relatedKey?: string;
  column?: string;
  aggregate?: 'min' | 'max';
  through?: typeof Eloquent;
  firstKey?: string;
  secondKey?: string;
  secondLocalKey?: string;
}

export abstract class Relation<TRelated extends Eloquent = Eloquent> {
  protected query: QueryBuilder<typeof Eloquent>;
  public abstract readonly type: string;

  constructor(
    protected parent: Eloquent,
    protected related: typeof Eloquent,
  ) {
    this.query = (related as any).query();
    this.addConstraints();
  }

  /**
   * Add the base constraints to the relation query
   * Subclasses implement this to add WHERE clauses specific to the relationship type
   */
  protected abstract addConstraints(): void;

  /**
   * Get the relationship configuration for eager loading
   */
  public abstract getConfig(): RelationshipConfig;

  /**
   * Get the results of the relationship
   */
  public abstract getResults(): Promise<TRelated | TRelated[] | null>;

  // ============================================================================
  // Query Builder Delegation - Chainable Methods
  // ============================================================================

  /**
   * Add a where clause to the query
   */
  where(column: string | Record<string, any> | ((query: QueryBuilder<any>) => void), operatorOrValue?: any, value?: any): this {
    (this.query as any).where(column as any, operatorOrValue, value);
    return this;
  }

  orWhere(column: string | Record<string, any> | ((query: QueryBuilder<any>) => void), operatorOrValue?: any, value?: any): this {
    (this.query as any).orWhere(column as any, operatorOrValue, value);
    return this;
  }

  whereColumn(first: string, operatorOrSecond: string, second?: string): this {
    this.query.whereColumn(first, operatorOrSecond, second as any);
    return this;
  }

  orWhereColumn(first: string, operatorOrSecond: string, second?: string): this {
    this.query.orWhereColumn(first, operatorOrSecond, second as any);
    return this;
  }

  whereKey(id: any | any[]): this {
    this.query.whereKey(id);
    return this;
  }

  whereKeyNot(id: any | any[]): this {
    this.query.whereKeyNot(id);
    return this;
  }

  /**
   * Add a where in clause to the query
   */
  whereIn(column: string, values: any[]): this {
    this.query.whereIn(column, values);
    return this;
  }

  /**
   * Add a where not in clause to the query
   */
  whereNotIn(column: string, values: any[]): this {
    this.query.whereNotIn(column, values);
    return this;
  }

  orWhereIn(column: string, values: any[]): this {
    this.query.orWhereIn(column, values);
    return this;
  }

  orWhereNotIn(column: string, values: any[]): this {
    this.query.orWhereNotIn(column, values);
    return this;
  }

  /**
   * Add a where null clause to the query
   */
  whereNull(column: string): this {
    this.query.whereNull(column);
    return this;
  }

  /**
   * Add a where not null clause to the query
   */
  whereNotNull(column: string): this {
    this.query.whereNotNull(column);
    return this;
  }

  orWhereNull(column: string): this {
    this.query.orWhereNull(column);
    return this;
  }

  orWhereNotNull(column: string): this {
    this.query.orWhereNotNull(column);
    return this;
  }

  whereBetween(column: string, values: [any, any]): this {
    this.query.whereBetween(column, values);
    return this;
  }

  whereNotBetween(column: string, values: [any, any]): this {
    this.query.whereNotBetween(column, values);
    return this;
  }

  orWhereBetween(column: string, values: [any, any]): this {
    this.query.orWhereBetween(column, values);
    return this;
  }

  orWhereNotBetween(column: string, values: [any, any]): this {
    this.query.orWhereNotBetween(column, values);
    return this;
  }

  whereDate(column: string, operatorOrValue: string, value?: string): this {
    this.query.whereDate(column, operatorOrValue, value);
    return this;
  }

  whereMonth(column: string, operatorOrValue: string | number, value?: string | number): this {
    this.query.whereMonth(column, operatorOrValue, value);
    return this;
  }

  whereYear(column: string, operatorOrValue: string | number, value?: string | number): this {
    this.query.whereYear(column, operatorOrValue, value);
    return this;
  }

  whereDay(column: string, operatorOrValue: string | number, value?: string | number): this {
    this.query.whereDay(column, operatorOrValue, value);
    return this;
  }

  whereTime(column: string, operatorOrValue: string, value?: string): this {
    this.query.whereTime(column, operatorOrValue, value);
    return this;
  }

  /**
   * Add a raw where clause to the query
   */
  whereRaw(sql: string, bindings?: any[]): this {
    this.query.whereRaw(sql, bindings);
    return this;
  }

  orWhereRaw(sql: string, bindings?: any[]): this {
    this.query.orWhereRaw(sql, bindings);
    return this;
  }

  whereHas(relation: string, callback?: (query: QueryBuilder) => void, operator?: string, count?: number): this {
    this.query.whereHas(relation, callback, operator, count);
    return this;
  }

  orWhereHas(relation: string, callback?: (query: QueryBuilder) => void, operator?: string, count?: number): this {
    this.query.orWhereHas(relation, callback, operator, count);
    return this;
  }

  whereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): this {
    this.query.whereDoesntHave(relation, callback);
    return this;
  }

  with(relations: string | string[] | Record<string, string[] | ((query: QueryBuilder<any>) => void)>): this {
    this.query.with(relations as any);
    return this;
  }

  withCount(relations: string | string[] | Record<string, (query: QueryBuilder) => void>): this {
    this.query.withCount(relations);
    return this;
  }

  withSum(relations: string | string[] | Record<string, (query: QueryBuilder) => void>, column: string): this {
    this.query.withSum(relations, column);
    return this;
  }

  withAvg(relations: string | string[] | Record<string, (query: QueryBuilder) => void>, column: string): this {
    this.query.withAvg(relations, column);
    return this;
  }

  withMin(relations: string | string[] | Record<string, (query: QueryBuilder) => void>, column: string): this {
    this.query.withMin(relations, column);
    return this;
  }

  withMax(relations: string | string[] | Record<string, (query: QueryBuilder) => void>, column: string): this {
    this.query.withMax(relations, column);
    return this;
  }

  /**
   * Add an order by clause to the query
   */
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.query.orderBy(column, direction);
    return this;
  }

  orderByDesc(column: string): this {
    this.query.orderByDesc(column);
    return this;
  }

  latest(column = 'created_at'): this {
    this.query.latest(column);
    return this;
  }

  oldest(column = 'created_at'): this {
    this.query.oldest(column);
    return this;
  }

  /**
   * Limit the number of results
   */
  limit(count: number): this {
    this.query.limit(count);
    return this;
  }

  /**
   * Skip a number of results
   */
  offset(count: number): this {
    this.query.offset(count);
    return this;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.query.select(...columns);
    return this;
  }

  addSelect(...columns: string[]): this {
    this.query.addSelect(...columns);
    return this;
  }

  scope(name: string, ...args: any[]): this {
    this.query.scope(name, ...args);
    return this;
  }

  // ============================================================================
  // Query Execution Methods
  // ============================================================================

  /**
   * Execute the query and get all results
   */
  async get(): Promise<Collection<TRelated>> {
    return this.query.get() as Promise<Collection<TRelated>>;
  }

  /**
   * Execute the query and get the first result
   */
  async first(): Promise<TRelated | null> {
    return this.query.first() as Promise<TRelated | null>;
  }

  async firstOrFail(): Promise<TRelated> {
    return this.query.firstOrFail() as Promise<TRelated>;
  }

  /**
   * Get the count of related records
   */
  async count(): Promise<number> {
    return this.query.count();
  }

  async sum(column: string): Promise<number> {
    return this.query.sum(column);
  }

  async avg(column: string): Promise<number> {
    return this.query.avg(column);
  }

  async min(column: string): Promise<number> {
    return this.query.min(column);
  }

  async max(column: string): Promise<number> {
    return this.query.max(column);
  }

  async value(column: string): Promise<any> {
    return this.query.value(column);
  }

  async pluck(column: string, key?: string): Promise<any> {
    return this.query.pluck(column, key);
  }

  /**
   * Check if any related records exist
   */
  async exists(): Promise<boolean> {
    return this.query.exists();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the underlying query builder
   */
  getQuery(): QueryBuilder<typeof Eloquent> {
    return this.query;
  }

  /**
   * Get the parent model instance
   */
  getParent(): Eloquent {
    return this.parent;
  }

  /**
   * Get the related model class
   */
  getRelated(): typeof Eloquent {
    return this.related;
  }
}
