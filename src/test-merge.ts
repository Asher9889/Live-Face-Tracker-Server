import axios from "axios";
import { UnknownIdentityModel } from "./module/unknown/unknown-identity.model";


export default async function test() {
  try {
    const ids = ["69b8fbff0993999b34132f6a", "69b8e240c731c34ceceb118b"];
  
    const identities = await UnknownIdentityModel.find({
      _id: { $in: ids }
    });
  
    const embeddings = identities.map(i => i.representativeEmbedding);
    const counts = identities.map(i => i.embeddingCount);
  
    const res = await axios.post("http://localhost:4001/merge", {
      embeddings,
      counts
    });
  
    console.log(res.data);
  } catch (error) {
    console.log("error is", error)
  }
}
