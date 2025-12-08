import { EmbeddingBase } from "./embedding.base";

export default class EmployeeEmbeddingService extends EmbeddingBase {
   
    async generateEmbeddingsForEmployee(files: Express.Multer.File[]){
        return this.requestEmbedding(files);
    }
}