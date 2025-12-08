/**
 * HasManyThrough Relation Class
 *
 * Represents a has-many-through relationship.
 * Example: Country hasManyThrough Posts through Users
 * (countries -> users -> posts)
 */

import type Eloquent from '../Eloquent';
import { type Collection } from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';

/**
 * Base class for through relationships
 */
abstract class ThroughRelation<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
  constructor(
    parent: Eloquent,
    related: typeof Eloquent,
    protected through: typeof Eloquent,
    protected firstKey?: string,
    protected secondKey?: string,
    protected localKey: string = 'id',
    protected secondLocalKey: string = 'id',
  ) {
    super(parent, related);
  }

  /**
   * Add the base constraints - join through intermediate table
   */
  protected addConstraints(): void {
    const parentKey = (this.parent as any)[this.localKey];
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
  protected getRelatedTable(): string {
    return (this.related as any).table || this.related.name.toLowerCase() + 's';
  }

  /**
   * Get the through model's table name
   */
  protected getThroughTable(): string {
    return (this.through as any).table || this.through.name.toLowerCase() + 's';
  }

  /**
   * Get the first key (on the through table, pointing to parent)
   */
  protected getFirstKey(): string {
    return this.firstKey || `${this.parent.constructor.name.toLowerCase()}_id`;
  }

  /**
   * Get the second key (on the related table, pointing to through)
   */
  protected getSecondKey(): string {
    return this.secondKey || `${this.through.name.toLowerCase()}_id`;
  }
}

export class HasManyThrough<TRelated extends Eloquent = Eloquent> extends ThroughRelation<TRelated> {
  public readonly type = 'hasManyThrough';

  /**
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
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
  public async getResults(): Promise<TRelated[]> {
    const parentKey = (this.parent as any)[this.localKey];
    if (parentKey === null || parentKey === undefined) {
      return [];
    }
    return this.get() as unknown as Promise<TRelated[]>;
  }
}

/**
 * HasOneThrough - returns single record through intermediate table
 */
export class HasOneThrough<TRelated extends Eloquent = Eloquent> extends ThroughRelation<TRelated> {
  public readonly type = 'hasOneThrough';

  /**
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
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
  public async getResults(): Promise<TRelated | null> {
    const parentKey = (this.parent as any)[this.localKey];
    if (parentKey === null || parentKey === undefined) {
      return null;
    }
    return this.first();
  }
}
