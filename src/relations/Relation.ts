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
  where(column: string, operatorOrValue?: any, value?: any): this {
    this.query.where(column, operatorOrValue, value);
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

  /**
   * Add a raw where clause to the query
   */
  whereRaw(sql: string, bindings?: any[]): this {
    this.query.whereRaw(sql, bindings);
    return this;
  }

  /**
   * Add an order by clause to the query
   */
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.query.orderBy(column, direction);
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

  /**
   * Get the count of related records
   */
  async count(): Promise<number> {
    return this.query.count();
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
