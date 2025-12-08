/**
 * HasMany Relation Class
 *
 * Represents a one-to-many relationship where the parent has many related records.
 * Example: User hasMany Posts (posts table has user_id foreign key)
 */

import type Eloquent from '../Eloquent';
import { type Collection } from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';

export class HasMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
  public readonly type = 'hasMany';
  protected foreignKey: string;
  protected localKey: string;

  constructor(
    parent: Eloquent,
    related: typeof Eloquent,
    foreignKey: string,
    localKey: string = 'id',
  ) {
    // Store properties BEFORE calling super (which calls addConstraints)
    (parent as any).__tempForeignKey = foreignKey;
    (parent as any).__tempLocalKey = localKey;

    super(parent, related);

    this.foreignKey = foreignKey;
    this.localKey = localKey;

    // Clean up
    delete (parent as any).__tempForeignKey;
    delete (parent as any).__tempLocalKey;
  }

  /**
   * Add the base constraints - filter by parent's local key
   */
  protected addConstraints(): void {
    const foreignKey = (this.parent as any).__tempForeignKey || this.foreignKey;
    const localKey = (this.parent as any).__tempLocalKey || this.localKey;
    const parentKey = (this.parent as any)[localKey];
    if (parentKey !== null && parentKey !== undefined) {
      this.query.where(foreignKey, parentKey);
    }
  }

  /**
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
    return {
      type: 'hasMany',
      model: this.related,
      foreignKey: this.foreignKey,
      localKey: this.localKey,
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

  /**
   * Get all results as a collection
   */
  async get(): Promise<Collection<TRelated>> {
    return super.get();
  }
}
