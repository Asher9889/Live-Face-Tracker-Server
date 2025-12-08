import axios from "axios";
import FormData from "form-data";
import { ApiError } from "../../utils";
import { StatusCodes } from "http-status-codes";

export abstract class EmbeddingBase {
  constructor(protected apiUrl: string) {}

  protected async requestEmbedding(files: Express.Multer.File[]) {
    try {
      const form = new FormData();

      files.forEach((file, _) => {
        form.append("faces", file.buffer, {
          filename: file.originalname, 
          contentType: file.mimetype,
        });
      });

      const response = await axios.post(`${this.apiUrl}/register-face`, form, {
        headers: {
          ...form.getHeaders(),
        },
      });

      return response.data; // assume API returns embeddings array
    } catch (err: any) {
        throw new ApiError(StatusCodes.BAD_REQUEST, err.messages);
    }
  }
}
