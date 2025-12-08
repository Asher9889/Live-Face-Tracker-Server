import axios from "axios";
import FormData from "form-data";
import { ApiError } from "../../../utils";
import { StatusCodes } from "http-status-codes";

interface IEmbeddingBase {
    success: boolean;
    num_valid_images: number;
    raw_embeddings: number[][];
    mean_embedding: number[];
    errors: any;
} 

export abstract class EmbeddingBase {
  constructor(protected apiUrl: string) {}

  protected async requestEmbedding(files: Express.Multer.File[]) {
    try {
      const form = new FormData();

      files.forEach((file, _) => {
        form.append("files", file.buffer, {
          filename: file.originalname, 
          contentType: file.mimetype,
        });
      });

      const response = await axios.post(`${this.apiUrl}/register-face`, form, { headers: form.getHeaders() });
      return response.data as IEmbeddingBase; // assume API returns embeddings array
    } catch (err: any) {
      console.log("error is:", err)
        throw new ApiError(StatusCodes.BAD_REQUEST, err.messages);
    }
  }
}
