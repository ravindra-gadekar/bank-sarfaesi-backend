import { Model, QueryFilter, UpdateQuery, QueryOptions, Document } from 'mongoose';

/**
 * Base repository that auto-injects branchId into every query.
 * All feature repositories must extend this class.
 */
export class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  protected scopeQuery(branchId: string, filter: QueryFilter<T> = {}): QueryFilter<T> {
    return { branchId, ...filter } as QueryFilter<T>;
  }

  async findAll(branchId: string, filter: QueryFilter<T> = {}, options?: QueryOptions): Promise<T[]> {
    return this.model.find(this.scopeQuery(branchId, filter), null, options).exec();
  }

  async findOne(branchId: string, filter: QueryFilter<T> = {}): Promise<T | null> {
    return this.model.findOne(this.scopeQuery(branchId, filter)).exec();
  }

  async findById(branchId: string, id: string): Promise<T | null> {
    return this.model.findOne(this.scopeQuery(branchId, { _id: id } as QueryFilter<T>)).exec();
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async updateOne(
    branchId: string,
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
  ): Promise<T | null> {
    return this.model
      .findOneAndUpdate(this.scopeQuery(branchId, filter), update, { returnDocument: 'after' })
      .exec();
  }

  async deleteOne(branchId: string, filter: QueryFilter<T>): Promise<T | null> {
    return this.model.findOneAndDelete(this.scopeQuery(branchId, filter)).exec();
  }

  async count(branchId: string, filter: QueryFilter<T> = {}): Promise<number> {
    return this.model.countDocuments(this.scopeQuery(branchId, filter)).exec();
  }
}
