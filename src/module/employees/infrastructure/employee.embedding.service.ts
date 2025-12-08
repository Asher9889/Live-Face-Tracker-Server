import { EmbeddingBase } from "../../shared/embedding/embedding.base";

export default class EmployeeEmbeddingService extends EmbeddingBase {
    constructor(apiUrl: string) {
        super(apiUrl);
    }
   
    async generateEmbeddingsForEmployee(files: Express.Multer.File[]){
        return this.requestEmbedding(files);
    }
}