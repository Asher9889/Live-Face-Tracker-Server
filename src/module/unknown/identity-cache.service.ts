import { Model } from "mongoose";
import { IUnknownIdentity } from "./unknown-identity.model";

type IdentityCacheItem = {
  id: string;
  emb: Float32Array;
};

export default class IdentityCacheService {

  private cache: IdentityCacheItem[] = [];
  private isLoaded = false;

  constructor(private identityModel: Model<IUnknownIdentity>) {}

  async warmup() {

    if (this.isLoaded) return;

    const identities = await this.identityModel.find({}, { representativeEmbedding: 1 }).lean();

    this.cache = identities.map((i: any) => ({
      id: i._id.toString(),
      emb: new Float32Array(i.representativeEmbedding),
    }));

    this.isLoaded = true;

    console.log(`[IdentityCache] Loaded ${this.cache.length} identities`);
  }

  getAll() {
    return this.cache;
  }

  // update cache when new identity created
  add(identity: any) {
    this.cache.push({
      id: identity._id.toString(),
      emb: new Float32Array(identity.representativeEmbedding),
    });
  }
}
