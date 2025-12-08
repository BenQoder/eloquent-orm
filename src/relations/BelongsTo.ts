/**
 * BelongsTo Relation Class
 *
 * Represents an inverse one-to-one or one-to-many relationship.
 * Example: Post belongsTo User (posts table has user_id foreign key)
 */

import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';

export class BelongsTo<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
  public readonly type = 'belongsTo';
  protected foreignKey: string;
  protected ownerKey: string;

  constructor(
    parent: Eloquent,
    related: typeof Eloquent,
    foreignKey: string,
    ownerKey: string = 'id',
  ) {
    // Store properties BEFORE calling super (which calls addConstraints)
    (parent as any).__tempForeignKey = foreignKey;
    (parent as any).__tempOwnerKey = ownerKey;

    super(parent, related);

    this.foreignKey = foreignKey;
    this.ownerKey = ownerKey;

    // Clean up
    delete (parent as any).__tempForeignKey;
    delete (parent as any).__tempOwnerKey;
  }

  /**
   * Add the base constraints - filter by the foreign key value
   */
  protected addConstraints(): void {
    const foreignKey = (this.parent as any).__tempForeignKey || this.foreignKey;
    const ownerKey = (this.parent as any).__tempOwnerKey || this.ownerKey;
    const foreignKeyValue = (this.parent as any)[foreignKey];
    if (foreignKeyValue !== null && foreignKeyValue !== undefined) {
      this.query.where(ownerKey, foreignKeyValue);
    }
  }

  /**
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
    return {
      type: 'belongsTo',
      model: this.related,
      foreignKey: this.foreignKey,
      ownerKey: this.ownerKey,
    };
  }

  /**
   * Get the results of the relationship (single record or null)
   */
  public async getResults(): Promise<TRelated | null> {
    const foreignKeyValue = (this.parent as any)[this.foreignKey];
    if (foreignKeyValue === null || foreignKeyValue === undefined) {
      return null;
    }
    return this.first();
  }
}
