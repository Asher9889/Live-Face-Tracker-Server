import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    department: {
        type: String,
        enum: ["Engineering", "HR", "Marketing", "Sales", "Admin", "Operations"],
        default: null,
    },
    role: {
        type: String,
        enum: ["Admin", "Manager", "Employee", "Intern"],
        default: null,
    },
    faceImages: {
        type: [String],
        default: null
    },
    embeddings: {
        type: Array,
        default: null
    },
    meanEmbedding: {
        type: Array,
        default: null
    },
}, { versionKey: false });

const EmployeeModel = mongoose.model("Employee", employeeSchema);

export default EmployeeModel;
